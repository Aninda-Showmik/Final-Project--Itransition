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
  const [validationErrors, setValidationErrors] = useState({
    name: '',
    email: '',
    password: ''
  });

  const validateForm = () => {
    const errors = {};
    let isValid = true;

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
      isValid = false;
    } else if (formData.name.length < 2) {
      errors.name = 'Name must be at least 2 characters';
      isValid = false;
    }

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email';
      isValid = false;
    }

    if (!formData.password) {
      errors.password = 'Password is required';
      isValid = false;
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
      isValid = false;
    }

    setValidationErrors(errors);
    return isValid;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear validation error when user types
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important for cookies
        body: JSON.stringify(formData),
      });

      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned unexpected response');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Registration failed (${response.status})`);
      }

      navigate('/login', {
        state: { 
          registrationSuccess: true,
          email: formData.email,
          autoLogin: true // Consider auto-logging in the user
        }
      });

    } catch (err) {
      console.error('Registration error:', err);
      setError(err.message || 'Registration failed. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <h1>Create Your Account</h1>
      {error && (
        <div className="error-message" role="alert">
          <p>{error}</p>
          <button 
            onClick={() => setError('')}
            className="retry-btn"
            aria-label="Dismiss error message"
          >
            Dismiss
          </button>
        </div>
      )}
      
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label htmlFor="name">Full Name</label>
          <input
            type="text"
            id="name"
            name="name"
            placeholder="Enter your full name"
            value={formData.name}
            onChange={handleChange}
            required
            minLength="2"
            maxLength="50"
            autoComplete="name"
            aria-describedby="nameError"
            aria-invalid={!!validationErrors.name}
          />
          {validationErrors.name && (
            <span id="nameError" className="error-text">{validationErrors.name}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input
            type="email"
            id="email"
            name="email"
            placeholder="Enter your email"
            value={formData.email}
            onChange={handleChange}
            required
            autoComplete="email"
            aria-describedby="emailError"
            aria-invalid={!!validationErrors.email}
          />
          {validationErrors.email && (
            <span id="emailError" className="error-text">{validationErrors.email}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            placeholder="Create a password (min 6 characters)"
            value={formData.password}
            onChange={handleChange}
            required
            minLength="6"
            autoComplete="new-password"
            aria-describedby="passwordError"
            aria-invalid={!!validationErrors.password}
          />
          {validationErrors.password && (
            <span id="passwordError" className="error-text">{validationErrors.password}</span>
          )}
        </div>

        <button 
          type="submit" 
          disabled={isLoading}
          className="primary-btn"
          aria-busy={isLoading}
        >
          {isLoading ? (
            <>
              <span className="spinner" aria-hidden="true"></span>
              Creating Account...
            </>
          ) : 'Create Account'}
        </button>
      </form>

      <div className="auth-footer">
        <p>Already have an account?</p>
        <button 
          onClick={() => navigate('/login')}
          className="text-btn"
          disabled={isLoading}
        >
          Sign In
        </button>
      </div>
    </div>
  );
};

export default Register;
