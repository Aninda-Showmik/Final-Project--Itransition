import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/App.css';

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      console.log('Attempting registration with:', formData); // Debug log
      
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const responseData = await response.json();
      console.log('Registration response:', responseData); // Debug log

      if (!response.ok) {
        throw new Error(responseData.message || `Registration failed with status ${response.status}`);
      }

      navigate('/login', {
        state: { 
          registrationSuccess: true,
          email: formData.email 
        }
      });
    } catch (err) {
      console.error('Registration error:', err); // Debug log
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <h2>Register</h2>
      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => window.location.reload()} className="retry-btn">
            Try Again
          </button>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="name"
          placeholder="Full Name"
          value={formData.name}
          onChange={handleChange}
          required
          minLength="2"
          maxLength="50"
          autoComplete="name"
          aria-label="Full Name"
        />
        <input
          type="email"
          name="email"
          placeholder="Email Address"
          value={formData.email}
          onChange={handleChange}
          required
          autoComplete="email"
          aria-label="Email Address"
        />
        <input
          type="password"
          name="password"
          placeholder="Password (min 6 characters)"
          value={formData.password}
          onChange={handleChange}
          required
          minLength="6"
          autoComplete="new-password"
          aria-label="Password"
        />
        <button 
          type="submit" 
          disabled={isLoading}
          aria-busy={isLoading}
          aria-label={isLoading ? 'Processing registration' : 'Create Account'}
        >
          {isLoading ? (
            <>
              <span className="spinner" aria-hidden="true"></span>
              Registering...
            </>
          ) : 'Create Account'}
        </button>
      </form>

      <div className="auth-links">
        <button 
          onClick={() => navigate('/login')}
          className="text-button"
          aria-label="Navigate to login page"
        >
          Already have an account? Sign In
        </button>
      </div>
    </div>
  );
};

export default Register;
