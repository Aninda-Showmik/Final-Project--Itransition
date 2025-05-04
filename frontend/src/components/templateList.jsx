import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const TemplateList = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:5000/api/templates', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setTemplates(data);
      } catch (err) {
        console.error('Fetch error:', err);
        setError('Failed to load templates. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, []);

  if (loading) return <div>Loading templates...</div>;
  if (error) return <div className="error">{error}</div>;

// Keep all your existing logic, just ensure the header structure is:
return (
    <div className="template-list">
      <div className="header">
        <h2>My Templates</h2>
        <Link to="/templates/new" className="btn-new">
          Create New Template
        </Link>
      </div>

      {templates.length === 0 ? (
        <div className="empty">No templates found</div>
      ) : (
        <ul>
          {templates.map(template => (
            <li key={template.id}>
              <Link to={`/templates/${template.id}`}>
                <h3>{template.title}</h3>
                <p>{template.description}</p>
                <span className={`visibility ${template.is_public ? 'public' : 'private'}`}>
                  {template.is_public ? 'Public' : 'Private'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TemplateList;