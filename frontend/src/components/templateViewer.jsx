import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const TemplateViewer = () => {
  const { id } = useParams();
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`http://localhost:5000/api/templates/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        // First check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text();
          throw new Error(`Expected JSON but got: ${text.substring(0, 100)}...`);
        }

        const data = await response.json();
        setTemplate(data);
      } catch (err) {
        console.error('Failed to load template:', err);
        setError('Failed to load template. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchTemplate();
  }, [id]);

  if (loading) return <div>Loading template...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!template) return <div>No template found</div>;

  return (
    <div className="template-viewer">
      <h1>{template.title}</h1>
      <p>{template.description}</p>
      {/* Rest of your template viewing code */}
    </div>
  );
};

export default TemplateViewer;