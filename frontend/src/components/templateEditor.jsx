import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

const API_BASE = process.env.REACT_APP_API_URL || '';

const TemplateEditor = ({ editMode = false }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({
    template: {
      title: '',
      description: '',
      isPublic: false,
      topic: 'Other'
    },
    questions: [],
    loading: false,
    error: ''
  });

  const { template, questions, loading, error } = state;

  // Memoized token refresh function
  const refreshToken = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (!response.ok) throw new Error('Token refresh failed');
      
      const { token } = await response.json();
      localStorage.setItem('token', token);
      return token;
    } catch (err) {
      localStorage.removeItem('token');
      navigate('/login');
      throw err;
    }
  }, [navigate]);

  // Enhanced fetch with token refresh
  const fetchWithAuth = useCallback(async (url, options = {}) => {
    let token = localStorage.getItem('token');
    
    // First attempt
    let response = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
      },
      credentials: 'include'
    });

    // If token expired, try refreshing
    if (response.status === 401) {
      try {
        token = await refreshToken();
        response = await fetch(`${API_BASE}${url}`, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
          },
          credentials: 'include'
        });
      } catch (refreshError) {
        throw new Error('Session expired. Please login again.');
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Request failed');
    }

    return response.json();
  }, [refreshToken]);

  // Check token on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp * 1000 < Date.now()) {
        throw new Error('Token expired');
      }
    } catch (err) {
      localStorage.removeItem('token');
      navigate('/login');
    }
  }, [navigate]);

  // Data fetching with abort controller
  useEffect(() => {
    if (!editMode || !id) return;

    const abortController = new AbortController();

    const fetchData = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: '' }));
        
        const [templateData, questionsData] = await Promise.all([
          fetchWithAuth(`/api/templates/${id}`),
          fetchWithAuth(`/api/templates/${id}/questions`)
        ]);

        setState(prev => ({
          ...prev,
          template: templateData,
          questions: questionsData.sort((a, b) => a.position - b.position)
        }));
      } catch (err) {
        if (err.name !== 'AbortError') {
          setState(prev => ({
            ...prev,
            error: err.message,
            loading: false
          }));
          setTimeout(() => navigate('/templates'), 3000);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setState(prev => ({ ...prev, loading: false }));
        }
      }
    };

    fetchData();

    return () => abortController.abort();
  }, [id, editMode, navigate, fetchWithAuth]);

  // Consolidated save function
  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    setState(prev => ({ ...prev, loading: true, error: '' }));

    try {
      const url = editMode ? `/api/templates/${id}` : '/api/templates';
      const method = editMode ? 'PUT' : 'POST';

      const data = await fetchWithAuth(url, {
        method,
        body: JSON.stringify({
          ...template,
          questions: editMode ? undefined : questions.map(q => ({
            type: q.type,
            title: q.text,
            description: q.description,
            isRequired: q.isRequired
          }))
        })
      });

      navigate(editMode ? `/templates/${id}` : `/templates/${data.id}/edit`);
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err.message,
        loading: false
      }));
    }
  };

  // Optimized drag and drop
  const onDragEnd = useCallback((result) => {
    if (!result.destination) return;

    const updatedQuestions = [...questions];
    const [movedQuestion] = updatedQuestions.splice(result.source.index, 1);
    updatedQuestions.splice(result.destination.index, 0, movedQuestion);

    const reorderedQuestions = updatedQuestions.map((q, idx) => ({
      ...q,
      position: idx
    }));

    setState(prev => ({
      ...prev,
      questions: reorderedQuestions
    }));

    // Debounced API update
    const updateOrder = async () => {
      try {
        await fetchWithAuth(`/api/templates/${id}/questions/order`, {
          method: 'PUT',
          body: JSON.stringify({
            questionIds: reorderedQuestions.map(q => q.id)
          })
        });
      } catch (err) {
        console.error('Reordering failed:', err);
        setState(prev => ({
          ...prev,
          questions: questions // Rollback on error
        }));
      }
    };

    const debounceTimer = setTimeout(updateOrder, 500);
    return () => clearTimeout(debounceTimer);
  }, [questions, id, fetchWithAuth]);

  // Add new question
  const addQuestion = useCallback((type) => {
    setState(prev => ({
      ...prev,
      questions: [
        ...prev.questions,
        {
          id: `temp-${Date.now()}`,
          type,
          text: '',
          description: '',
          isRequired: false,
          position: prev.questions.length
        }
      ]
    }));
  }, []);

  // Update question field
  const updateQuestion = useCallback((index, field, value) => {
    setState(prev => {
      const updatedQuestions = [...prev.questions];
      updatedQuestions[index] = {
        ...updatedQuestions[index],
        [field]: value
      };
      return { ...prev, questions: updatedQuestions };
    });
  }, []);

  if (loading && !questions.length) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
        <p>Loading template...</p>
      </div>
    );
  }

  return (
    <div className="template-editor">
      <h2>{editMode ? 'Edit Template' : 'New Template'}</h2>
      
      {error && (
        <div className="alert alert-danger">
          {error}
          <button 
            onClick={() => setState(prev => ({ ...prev, error: '' }))}
            className="close-btn"
            aria-label="Close error"
          >
            &times;
          </button>
        </div>
      )}

      <form onSubmit={handleSaveTemplate}>
        <div className="editor-section">
          <h3>Template Details</h3>
          
          <div className="form-group">
            <label htmlFor="template-title">Title*</label>
            <input
              id="template-title"
              type="text"
              value={template.title}
              onChange={(e) => setState(prev => ({
                ...prev,
                template: { ...prev.template, title: e.target.value }
              }))}
              required
              disabled={loading}
              minLength={3}
              maxLength={100}
            />
          </div>

          <div className="form-group">
            <label htmlFor="template-description">Description</label>
            <textarea
              id="template-description"
              value={template.description}
              onChange={(e) => setState(prev => ({
                ...prev,
                template: { ...prev.template, description: e.target.value }
              }))}
              disabled={loading}
              maxLength={500}
            />
          </div>

          <div className="form-group-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={template.isPublic}
                onChange={(e) => setState(prev => ({
                  ...prev,
                  template: { ...prev.template, isPublic: e.target.checked }
                }))}
                disabled={loading}
              />
              <span>Public Template</span>
            </label>

            <div className="form-group">
              <label htmlFor="template-topic">Topic</label>
              <select
                id="template-topic"
                value={template.topic}
                onChange={(e) => setState(prev => ({
                  ...prev,
                  template: { ...prev.template, topic: e.target.value }
                }))}
                disabled={loading}
              >
                {['Education', 'Quiz', 'Other'].map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="editor-section">
          <h3>Questions</h3>
          <div className="question-actions">
            {['text', 'number', 'checkbox'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => addQuestion(type)}
                disabled={loading}
                className={`add-btn ${type}`}
              >
                Add {type.charAt(0).toUpperCase() + type.slice(1)} Question
              </button>
            ))}
          </div>

          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="questions">
              {(provided) => (
                <div 
                  {...provided.droppableProps} 
                  ref={provided.innerRef}
                  className="questions-list"
                  aria-label="Questions list"
                >
                  {questions.map((question, index) => (
                    <Draggable 
                      key={question.id} 
                      draggableId={question.id.toString()} 
                      index={index}
                    >
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className="question-card"
                          aria-label={`Question ${index + 1}`}
                        >
                          <div className="question-header" {...provided.dragHandleProps}>
                            <span className="drag-handle" aria-hidden="true">≡</span>
                            
                            <select
                              value={question.type}
                              onChange={(e) => updateQuestion(index, 'type', e.target.value)}
                              className="question-type"
                              aria-label="Question type"
                            >
                              {['text', 'number', 'checkbox'].map((type) => (
                                <option key={type} value={type}>
                                  {type.charAt(0).toUpperCase() + type.slice(1)}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => setState(prev => ({
                                ...prev,
                                questions: prev.questions.filter((_, i) => i !== index)
                              }))}
                              className="delete-btn"
                              aria-label={`Delete question ${index + 1}`}
                            >
                              &times;
                            </button>
                          </div>
                          
                          <input
                            type="text"
                            value={question.text}
                            onChange={(e) => updateQuestion(index, 'text', e.target.value)}
                            placeholder="Question text"
                            className="question-input"
                            required
                            minLength={3}
                            aria-label="Question text"
                          />

                          <textarea
                            value={question.description}
                            onChange={(e) => updateQuestion(index, 'description', e.target.value)}
                            placeholder="Description (optional)"
                            className="question-description"
                            rows={2}
                            aria-label="Question description"
                          />

                          <label className="required-checkbox">
                            <input
                              type="checkbox"
                              checked={question.isRequired}
                              onChange={(e) => updateQuestion(index, 'isRequired', e.target.checked)}
                              aria-label="Required question"
                            />
                            <span>Required</span>
                          </label>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>

        <div className="form-actions">
          <button 
            type="submit" 
            disabled={loading || !template.title || questions.length === 0}
            className="save-btn"
          >
            {loading ? (
              <>
                <span className="spinner" aria-hidden="true"></span>
                Saving...
              </>
            ) : (
              'Save Template'
            )}
          </button>
          <button
            type="button"
            onClick={() => navigate('/templates')}
            className="cancel-btn"
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default TemplateEditor;
