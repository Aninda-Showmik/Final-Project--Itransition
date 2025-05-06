import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import './AdminPanel.css';

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

  // Enhanced fetch with timeout and retry
  const fetchWithTimeout = async (url, options, timeout = 8000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(id);
      return response;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  };

  const fetchUsers = async (attempt = 1) => {
    try {
      setLoading(true);
      setError('');
      
      const token = localStorage.getItem('token');
      const user = JSON.parse(localStorage.getItem('user'));
      
      if (!user || user?.role !== 'admin') {
        navigate('/dashboard');
        return;
      }

      const response = await fetchWithTimeout(
        `${process.env.REACT_APP_API_URL}/api/admin/users?page=${pagination.page}&limit=${pagination.limit}`,
        {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if ([401, 403].includes(response.status) && attempt <= 2) {
          await attemptTokenRefresh();
          return fetchUsers(attempt + 1);
        }
        throw new Error(
          errorData.message || 
          `Request failed with status ${response.status}`
        );
      }

      const { data, pagination: paginationData } = await response.json();
      
      if (!Array.isArray(data)) {
        throw new Error('Invalid data format received from server');
      }

      setUsers(data);
      setPagination(prev => ({
        ...prev,
        ...paginationData,
        page: Math.min(paginationData.page, paginationData.totalPages)
      }));
    } catch (err) {
      console.error('Fetch error:', err);
      setError(
        err.name === 'AbortError' 
          ? 'Request timed out. Please try again.' 
          : err.message
      );
      
      if (err.message.includes('expired') || err.message.includes('401')) {
        setTimeout(handleLogout, 2000); // Delay logout to show message
      }
    } finally {
      setLoading(false);
    }
  };

  const attemptTokenRefresh = async () => {
    try {
      const response = await fetchWithTimeout(
        `${process.env.REACT_APP_API_URL}/api/auth/refresh`,
        {
          method: 'POST',
          credentials: 'include'
        }
      );
      
      if (!response.ok) throw new Error('Token refresh failed');
      
      const { token } = await response.json();
      localStorage.setItem('token', token);
      return true;
    } catch (err) {
      console.error('Refresh failed:', err);
      throw err;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      setError('');
      const token = localStorage.getItem('token');
      
      const response = await fetchWithTimeout(
        `${process.env.REACT_APP_API_URL}/api/admin/users/${userId}/role`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ role: newRole })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update role');
      }
      
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user._id === userId ? { ...user, role: newRole } : user
        )
      );
    } catch (err) {
      console.error('Role update error:', err);
      setError(err.message);
      if (err.message.includes('expired') || err.message.includes('401')) {
        handleLogout();
      }
    }
  };

  const handlePaginationChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, page: newPage }));
    }
  };

  useEffect(() => {
    const abortController = new AbortController();
    
    const loadData = async () => {
      await fetchUsers();
    };
    
    loadData();
    
    return () => abortController.abort();
  }, [pagination.page, pagination.limit]);

  // Render loading state
  if (loading) return (
    <div className="admin-loading">
      <div className="spinner"></div>
      <p>Loading user data...</p>
    </div>
  );

  // Render error state
  if (error) return (
    <div className="admin-error">
      <p className="error-message">{error}</p>
      <div className="error-actions">
        <button onClick={fetchUsers} className="retry-btn">
          Retry
        </button>
        <button onClick={handleLogout} className="logout-btn">
          Login Again
        </button>
      </div>
    </div>
  );

  // Main render
  return (
    <div className="admin-container">
      <header className="admin-header">
        <h1>User Management</h1>
        <div className="header-actions">
          <span className="user-count">
            Showing {users.length} of {pagination.total} users
          </span>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </header>

      <div className="admin-content">
        {users.length === 0 ? (
          <div className="no-users">
            <p>No users found</p>
            <button onClick={fetchUsers} className="refresh-btn">
              Refresh List
            </button>
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
                    <th>Status</th>
                    <th>Role</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user._id}>
                      <td>{user._id.substring(18)}</td>
                      <td>{user.username || 'N/A'}</td>
                      <td>{user.email}</td>
                      <td className={`status-${user.status || 'active'}`}>
                        {user.status || 'active'}
                      </td>
                      <td className={`role-${user.role}`}>{user.role}</td>
                      <td className="actions">
                        {user.role === 'admin' ? (
                          <button
                            className="btn-demote"
                            onClick={() => handleRoleChange(user._id, 'user')}
                            disabled={users.filter(u => u.role === 'admin').length <= 1}
                            title={
                              users.filter(u => u.role === 'admin').length <= 1 
                                ? "System must have at least one admin" 
                                : ""
                            }
                          >
                            Demote
                          </button>
                        ) : (
                          <button
                            className="btn-promote"
                            onClick={() => handleRoleChange(user._id, 'admin')}
                          >
                            Promote
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
                className="pagination-btn"
              >
                Previous
              </button>
              
              <div className="page-info">
                Page {pagination.page} of {pagination.totalPages}
              </div>
              
              <select
                value={pagination.limit}
                onChange={(e) => setPagination(prev => ({
                  ...prev,
                  limit: Number(e.target.value),
                  page: 1
                }))}
                className="limit-select"
              >
                {[5, 10, 20, 50].map(size => (
                  <option key={size} value={size}>
                    Show {size}
                  </option>
                ))}
              </select>
              
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => handlePaginationChange(pagination.page + 1)}
                className="pagination-btn"
              >
                Next
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
      _id: PropTypes.string.isRequired,
      username: PropTypes.string,
      email: PropTypes.string.isRequired,
      role: PropTypes.oneOf(['admin', 'user']).isRequired,
      status: PropTypes.oneOf(['active', 'banned', 'pending'])
    })
  )
};

export default AdminPanel;
