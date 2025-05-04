import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const FormsList = () => {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchForms = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:5000/api/forms', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) throw new Error('Failed to load forms');
        
        const data = await response.json();
        setForms(data.forms || []); // Ensure we always get an array
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchForms();
  }, []);

  if (loading) return <div>Loading forms...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="forms-list">
      <h2>My Forms</h2>
      {forms.length === 0 ? (
        <div>No forms found</div>
      ) : (
        <ul>
          {forms.map(form => (
            <li key={form.id}>
              <Link to={`/forms/${form.id}`}>
                <h3>{form.template_title || 'Untitled Form'}</h3>
                <p>Created: {new Date(form.created_at).toLocaleDateString()}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default FormsList;