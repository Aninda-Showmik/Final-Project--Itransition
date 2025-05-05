import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const TemplateList = () => {
  const [state, setState] = useState({
    templates: [],
    loading: true,
    error: ''
  });
  const navigate = useNavigate();
  const API_BASE = process.env.REACT_APP_API_URL || '';

  useEffect(() => {
    const abortController = new AbortController();

    const fetchTemplates = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          navigate('/login');
          return;
        }

        const response = await fetch(`${API_BASE}/api/templates`, {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          credentials: 'include',
          signal: abortController.signal
        });

        if (response.status === 401) {
          // Handle token refresh if needed
          navigate('/login');
          return;
        }

        if (!response.ok) {
          throw new Error(`Failed to load templates: ${response.status}`);
        }

        const data = await response.json();
        setState(prev => ({ ...prev, templates: data, error: '' }));
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Fetch error:', err);
          setState(prev => ({
            ...prev,
            error: err.message || 'Failed to load templates. Please try again.'
          }));
        }
      } finally {
        if (!abortController.signal.aborted) {
          setState(prev => ({ ...prev, loading: false }));
        }
      }
    };

    fetchTemplates();

    return () => abortController.abort();
  }, [navigate, API_BASE]);

  if (state.loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading templates...</p>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="error-container">
        <div className="error-message">
          {state.error}
          <button onClick={() => window.location.reload()} className="retry-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="template-list-container">
      <header className="template-list-header">
        <h1>My Templates</h1>
        <Link to="/templates/new" className="create-template-btn">
          + Create New Template
        </Link>
      </header>

      {state.templates.length === 0 ? (
        <div className="empty-state">
          <p>No templates found</p>
          <Link to="/templates/new" className="create-template-btn">
            Create Your First Template
          </Link>
        </div>
      ) : (
        <div className="template-grid">
          {state.templates.map(template => (
            <div key={template.id} className="template-card">
              <Link to={`/templates/${template.id}`} className="template-link">
                <div className="template-card-header">
                  <h2>{template.title}</h2>
                  <span className={`template-visibility ${template.is_public ? 'public' : 'private'}`}>
                    {template.is_public ? 'Public' : 'Private'}
                  </span>
                </div>
                <p className="template-description">
                  {template.description || 'No description provided'}
                </p>
                <div className="template-meta">
                  <span className="template-topic">{template.topic || 'General'}</span>
                  <span className="template-date">
                    {new Date(template.created_at).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TemplateList;
