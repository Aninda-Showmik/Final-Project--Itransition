import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const FormSubmit = () => {
  const { templateId } = useParams();
  const navigate = useNavigate();
  const [template, setTemplate] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState('');

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/templates/${templateId}`);
        if (!res.ok) throw new Error('Failed to fetch template');
        const data = await res.json();
        setTemplate(data.template);
        setQuestions(data.questions);

        const initialAnswers = {};
        data.questions.forEach(q => {
          initialAnswers[q.id] = '';
        });
        setAnswers(initialAnswers);
      } catch (err) {
        setError('Failed to load template');
      }
    };
    fetchTemplate();
  }, [templateId, API_BASE_URL]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const answerArray = Object.entries(answers).map(([question_id, value]) => ({
        question_id: parseInt(question_id),
        value
      }));

      const res = await fetch(`${API_BASE_URL}/api/forms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          template_id: parseInt(templateId),
          answers: answerArray
        })
      });

      if (!res.ok) throw new Error('Submission failed');
      const data = await res.json();
      navigate(`/forms/${data.formId}`);
    } catch (err) {
      setError(err.message);
    }
  };

  if (error) return <div className="error">{error}</div>;
  if (!template) return <div>Loading...</div>;

  return (
    <div className="form-container">
      <h2>{template.title}</h2>
      <p>{template.description}</p>

      <form onSubmit={handleSubmit}>
        {questions.map(question => (
          <div key={question.id} className="question">
            <label>
              {question.title}
              {question.is_required && <span className="required">*</span>}
            </label>
            {question.type === 'textarea' ? (
              <textarea
                value={answers[question.id] || ''}
                onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                required={question.is_required}
              />
            ) : (
              <input
                type={question.type}
                value={answers[question.id] || ''}
                onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                required={question.is_required}
              />
            )}
          </div>
        ))}
        <button type="submit">Submit Form</button>
      </form>
    </div>
  );
};

export default FormSubmit;
