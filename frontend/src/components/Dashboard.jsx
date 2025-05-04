import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Dashboard.css'; // Make sure to create this CSS file

const Dashboard = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user'));

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  // Navigation actions
  const navActions = [
    {
      title: 'Create Template',
      path: '/templates/new',
      icon: '📝',
      available: true
    },
    {
      title: 'My Templates',
      path: '/templates',
      icon: '📋',
      available: true
    },
    {
      title: 'My Forms',
      path: '/forms',
      icon: '📄',
      available: true
    },
    {
      title: 'Admin Panel',
      path: '/admin',
      icon: '⚙️',
      available: user?.role === 'admin'
    },
    {
      title: 'Manage All Templates',
      path: '/templates/manage',
      icon: '🛠️',
      available: user?.role === 'admin'
    }
  ];

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Welcome, {user?.name}!</h1>
        <div className="user-info">
          <p><strong>Email:</strong> {user?.email}</p>
          <p>
            <strong>Role:</strong> 
            <span className={`role-badge ${user?.role}`}>
              {user?.role?.toUpperCase()}
            </span>
          </p>
        </div>
      </div>

      <div className="dashboard-actions">
        {navActions.map((action) => (
          action.available && (
            <div 
              key={action.title}
              className="action-card"
              onClick={() => navigate(action.path)}
            >
              <span className="action-icon">{action.icon}</span>
              <h3>{action.title}</h3>
            </div>
          )
        ))}
      </div>

      <div className="recent-activity">
        <h2>Recent Activity</h2>
        {/* Placeholder for actual activity feed */}
        <div className="activity-item">
          <p>No recent activity yet</p>
        </div>
      </div>

      <button className="logout-button" onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
};

export default Dashboard;