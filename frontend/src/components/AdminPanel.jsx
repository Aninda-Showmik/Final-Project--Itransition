import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import './AdminPanel.css'; // Create this for custom styles

const AdminPanel = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1
  });
  const navigate = useNavigate();

  // Base URL should be environment specific
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  // Fetch users with retry logic
  const fetchUsers = async (attempt = 1) => {
    try {
      const token = localStorage.getItem('token');
      const user = JSON.parse(localStorage.getItem('user'));
      
      // Redirect if not admin
      if (user?.role !== 'admin') {
        navigate('/dashboard');
        return;
      }

      const response = await fetch(
        `${API_URL}/api/admin/users?page=${pagination.page}&limit=${pagination.limit}`,
        {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        }
      );

      // Handle token expiration
      if (response.status === 401 || response.status === 403) {
        if (attempt <= 1) {
          await attemptTokenRefresh();
          return fetchUsers(attempt + 1);
        }
        throw new Error('Session expired. Please login again.');
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch users');
      }
      
      const { data, pagination: paginationData } = await response.json();
      
      if (!Array.isArray(data)) {
        throw new Error('Invalid user data format received');
      }

      setUsers(data);
      setPagination(paginationData);
      setError('');
    } catch (err) {
      console.error('User fetch error:', err);
      setError(err.message);
      if (err.message.includes('expired')) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  // Token refresh logic
  const attemptTokenRefresh = async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (!response.ok) throw new Error('Token refresh failed');
      
      const { token } = await response.json();
      localStorage.setItem('token', token);
    } catch (refreshError) {
      console.error('Refresh failed:', refreshError);
      handleLogout();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_URL}/api/admin/users/${userId}/role`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ role: newRole })
        }
      );

      if (response.status === 401 || response.status === 403) {
        await attemptTokenRefresh();
        return handleRoleChange(userId, newRole);
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update role');
      }
      
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === userId ? { ...user, role: newRole } : user
        )
      );
    } catch (err) {
      console.error('Role update error:', err);
      setError(err.message);
      if (err.message.includes('expired')) {
        handleLogout();
      }
    }
  };

  const handlePaginationChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  useEffect(() => {
    fetchUsers();
  }, [pagination.page, pagination.limit]);

  if (loading) return (
    <div className="admin-loading">
      <div className="spinner"></div>
      <p>Loading user data...</p>
    </div>
  );

  if (error) return (
    <div className="admin-error">
      <p>{error}</p>
      <button onClick={fetchUsers}>Retry</button>
      <button onClick={handleLogout}>Login Again</button>
    </div>
  );

  return (
    <div className="admin-container">
      <header className="admin-header">
        <h1>User Management</h1>
        <button className="logout-btn" onClick={handleLogout}>Logout</button>
      </header>

      <div className="admin-content">
        {users.length === 0 ? (
          <div className="no-users">
            <p>No users found</p>
            <button onClick={fetchUsers}>Refresh List</button>
          </div>
        ) : (
          <>
            <div className="users-table-container">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id}>
                      <td>{user.id}</td>
                      <td>{user.name || 'N/A'}</td>
                      <td>{user.email}</td>
                      <td className={`role-${user.role}`}>{user.role}</td>
                      <td className="actions">
                        {user.role === 'admin' ? (
                          <button
                            className="btn-demote"
                            onClick={() => handleRoleChange(user.id, 'user')}
                            disabled={users.filter(u => u.role === 'admin').length <= 1}
                            title={users.filter(u => u.role === 'admin').length <= 1 ? 
                              "System must have at least one admin" : ""}
                          >
                            Demote to User
                          </button>
                        ) : (
                          <button
                            className="btn-promote"
                            onClick={() => handleRoleChange(user.id, 'admin')}
                          >
                            Promote to Admin
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination-controls">
              <button
                disabled={pagination.page <= 1}
                onClick={() => handlePaginationChange(pagination.page - 1)}
              >
                &laquo; Previous
              </button>
              <span>
                Page {pagination.page} of {pagination.totalPages} 
                (Total: {pagination.total} users)
              </span>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => handlePaginationChange(pagination.page + 1)}
              >
                Next &raquo;
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

AdminPanel.propTypes = {
  users: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      name: PropTypes.string,
      email: PropTypes.string.isRequired,
      role: PropTypes.oneOf(['admin', 'user']).isRequired
    })
  )
};

export default AdminPanel;
