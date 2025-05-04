// TemplateEditor.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

const TemplateEditor = ({ editMode = false }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [template, setTemplate] = useState({
    title: '',
    description: '',
    isPublic: false
  });
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editMode) {
      const fetchTemplateAndQuestions = async () => {
        try {
          const [templateRes, questionsRes] = await Promise.all([
            fetch(`http://localhost:5000/api/templates/${id}`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              }
            }),
            fetch(`http://localhost:5000/api/templates/${id}/questions`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              }
            })
          ]);

          if (!templateRes.ok || !questionsRes.ok) throw new Error('Failed to load data');

          const templateData = await templateRes.json();
          const questionsData = await questionsRes.json();

          setTemplate(templateData);
          setQuestions(questionsData);
        } catch (err) {
          setError(err.message);
        }
      };

      fetchTemplateAndQuestions();
    }
  }, [id, editMode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const url = editMode 
        ? `http://localhost:5000/api/templates/${id}`
        : 'http://localhost:5000/api/templates';

      const method = editMode ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(template)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to save template');
      }

      alert(editMode ? 'Template updated!' : 'Template created!');
      navigate(editMode ? `/templates/${id}` : '/templates');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onDragEnd = async (result) => {
    if (!result.destination) return;

    const reordered = Array.from(questions);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);

    setQuestions(reordered);

    try {
      await fetch(`http://localhost:5000/api/templates/${id}/questions/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          questionId: result.draggableId,
          newPosition: result.destination.index
        })
      });
    } catch (err) {
      console.error('Failed to reorder questions:', err);
    }
  };

  return (
    <div className="template-editor">
      <h2>{editMode ? 'Edit Template' : 'Create New Template'}</h2>
      
      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Title*</label>
          <input
            type="text"
            value={template.title}
            onChange={(e) => setTemplate({...template, title: e.target.value})}
            required
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea
            value={template.description}
            onChange={(e) => setTemplate({...template, description: e.target.value})}
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={template.isPublic}
              onChange={(e) => setTemplate({...template, isPublic: e.target.checked})}
              disabled={loading}
            />
            Make public
          </label>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Save Template'}
        </button>
      </form>

      {editMode && (
        <div className="question-reorder-section">
          <h3>Reorder Questions</h3>
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="questions">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef}>
                  {questions.map((q, i) => (
                    <Draggable key={q.id} draggableId={q.id.toString()} index={i}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className="question-item"
                        >
                          <div {...provided.dragHandleProps} className="drag-handle">≡</div>
                          <div className="question-text">{q.text || `Question ${i + 1}`}</div>
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
      )}
    </div>
  );
};

export default TemplateEditor;
