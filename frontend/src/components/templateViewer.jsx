import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const TemplateViewer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({
    template: null,
    loading: true,
    error: ''
  });
  const API_BASE = process.env.REACT_APP_API_URL || '';

  useEffect(() => {
    const abortController = new AbortController();

    const fetchTemplate = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          navigate('/login');
          return;
        }

        const response = await fetch(`${API_BASE}/api/templates/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          credentials: 'include',
          signal: abortController.signal
        });

        if (response.status === 401) {
          navigate('/login');
          return;
        }

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Received non-JSON response');
        }

        const data = await response.json();
        setState({
          template: data,
          loading: false,
          error: ''
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Fetch error:', err);
          setState(prev => ({
            ...prev,
            loading: false,
            error: err.message || 'Failed to load template. Please try again.'
          }));
        }
      }
    };

    fetchTemplate();

    return () => abortController.abort();
  }, [id, navigate, API_BASE]);

  if (state.loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading template...</p>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="error-container">
        <div className="error-message">
          {state.error}
          <button 
            onClick={() => window.location.reload()} 
            className="retry-btn"
          >
            Retry
          </button>
          <button 
            onClick={() => navigate('/templates')} 
            className="back-btn"
          >
            Back to Templates
          </button>
        </div>
      </div>
    );
  }

  if (!state.template) {
    return (
      <div className="empty-state">
        <p>No template found</p>
        <button 
          onClick={() => navigate('/templates')} 
          className="back-btn"
        >
          Back to Templates
        </button>
      </div>
    );
  }

  return (
    <div className="template-viewer-container">
      <header className="template-header">
        <h1>{state.template.title}</h1>
        <div className="template-meta">
          <span className={`template-visibility ${state.template.is_public ? 'public' : 'private'}`}>
            {state.template.is_public ? 'Public' : 'Private'}
          </span>
          <span className="template-topic">{state.template.topic || 'General'}</span>
          <span className="template-date">
            Created: {new Date(state.template.created_at).toLocaleDateString()}
          </span>
        </div>
      </header>

      <div className="template-content">
        {state.template.description && (
          <div className="template-description">
            <h2>Description</h2>
            <p>{state.template.description}</p>
          </div>
        )}

        <div className="template-actions">
          <button 
            onClick={() => navigate(`/templates/${id}/edit`)}
            className="edit-btn"
          >
            Edit Template
          </button>
          <button 
            onClick={() => navigate(`/templates/${id}/use`)}
            className="use-btn"
          >
            Use Template
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplateViewer;
