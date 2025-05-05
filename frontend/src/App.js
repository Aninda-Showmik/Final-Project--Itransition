import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner';
import ThemeToggle from './components/ThemeToggle';
import './styles/App.css';

// Lazy load components with named exports
const HomePage = React.lazy(() => import('./components/HomePage'));
const Login = React.lazy(() => import('./components/Login'));
const Register = React.lazy(() => import('./components/Register'));
const Dashboard = React.lazy(() => import('./components/Dashboard'));
const AdminPanel = React.lazy(() => import('./components/AdminPanel'));
const TemplateList = React.lazy(() => import('./components/templateList'));
const TemplateEditor = React.lazy(() => import('./components/templateEditor'));
const TemplateViewer = React.lazy(() => import('./components/templateViewer'));
const TemplateManagement = React.lazy(() => import('./components/TemplateManagement'));
const FormSubmit = React.lazy(() => import('./components/FormSubmit'));
const FormViewer = React.lazy(() => import('./components/formViewer'));
const FormsList = React.lazy(() => import('./components/FormList'));

// Enhanced PrivateRoute component with proper redirects
const PrivateRoute = ({ children, adminOnly = false }) => {
  const location = useLocation();
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  
  if (adminOnly && user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace state={{ from: location }} />;
  }

  return children;
};

// Layout component with error boundary and suspense
const Layout = ({ children }) => {
  return (
    <div className="app-container">
      <ThemeToggle className="theme-toggle" />
      <main className="main-content">
        <ErrorBoundary>
          <Suspense fallback={<LoadingSpinner fullPage />}>
            {children}
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
};

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Layout>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Template-related Routes */}
            <Route path="/templates" element={
              <PrivateRoute>
                <TemplateList />
              </PrivateRoute>
            } />
            <Route path="/templates/new" element={
              <PrivateRoute>
                <TemplateEditor />
              </PrivateRoute>
            } />
            <Route path="/templates/manage" element={
              <PrivateRoute adminOnly>
                <TemplateManagement />
              </PrivateRoute>
            } />
            <Route path="/templates/:id/edit" element={
              <PrivateRoute>
                <TemplateEditor editMode />
              </PrivateRoute>
            } />
            <Route path="/templates/:id" element={
              <PrivateRoute>
                <TemplateViewer />
              </PrivateRoute>
            } />

            {/* Form-related Routes */}
            <Route path="/forms/new/:templateId" element={
              <PrivateRoute>
                <FormSubmit />
              </PrivateRoute>
            } />
            <Route path="/forms/:id" element={
              <PrivateRoute>
                <FormViewer />
              </PrivateRoute>
            } />
            <Route path="/forms" element={
              <PrivateRoute>
                <FormsList />
              </PrivateRoute>
            } />

            {/* Authenticated Routes */}
            <Route path="/dashboard" element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } />

            {/* Admin-only Routes */}
            <Route path="/admin" element={
              <PrivateRoute adminOnly>
                <AdminPanel />
              </PrivateRoute>
            } />

            {/* Fallback Route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </Router>
    </ThemeProvider>
  );
}

export default App;
