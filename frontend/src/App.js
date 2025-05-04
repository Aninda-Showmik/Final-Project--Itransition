// frontend/src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './components/HomePage';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';
import TemplateList from './components/templateList';
import TemplateEditor from './components/templateEditor';
import TemplateViewer from './components/templateViewer';
import TemplateManagement from './components/TemplateManagement';
import FormSubmit from './components/FormSubmit';
import FormViewer from './components/formViewer';
import ThemeToggle from './components/ThemeToggle';
import FormsList from './components/FormList';
import ErrorBoundary from './components/ErrorBoundary';
import './styles/App.css';
import { ThemeProvider } from './contexts/ThemeContext';

const PrivateRoute = ({ children, adminOnly = false }) => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user'));

  if (!token) return <Navigate to="/login" replace />;
  if (adminOnly && user?.role !== 'admin') return <Navigate to="/dashboard" replace />;

  return children;
};

const Layout = ({ children }) => {
  return (
    <div className="app-container">
      <ThemeToggle className="theme-toggle" />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Layout>
          <ErrorBoundary>
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
                  <TemplateEditor editMode={true} />
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

              {/* Forms List Route */}
              <Route path="/forms" element={
                <PrivateRoute>
                  <FormsList />
                </PrivateRoute>
              } />
            </Routes>
          </ErrorBoundary>
        </Layout>
      </Router>
    </ThemeProvider>
  );
}

export default App;
