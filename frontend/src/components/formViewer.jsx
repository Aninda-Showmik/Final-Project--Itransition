import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const FormViewer = () => {
  const { id: formId } = useParams(); // get form ID from URL
  const [form, setForm] = useState(null);
  const [answers, setAnswers] = useState([]);
  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    const fetchForm = async () => {
      try {
        const res = await fetch(`/api/forms/${formId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const data = await res.json();
        setForm(data.form);
        setAnswers(data.answers);
      } catch (err) {
        console.error('Failed to load form:', err);
      }
    };
    fetchForm();
  }, [formId]);

  const canEdit = user?.role === 'admin' ||
                  user?.id === form?.user_id ||
                  user?.id === form?.template_owner_id;

  const handleUpdate = (answerId, newValue) => {
    setAnswers(prev =>
      prev.map(ans => ans.id === answerId ? { ...ans, value: newValue } : ans)
    );
    // Optionally: send update to backend here
  };

  return (
    <div className="form-container">
      {form && (
        <>
          <h2>{form.title}</h2>
          <p>Submitted by: {form.user_name}</p>

          {answers.map(answer => (
            <div key={answer.id} className="answer-item">
              <h4>{answer.question_title}</h4>
              {canEdit ? (
                <input
                  value={answer.value}
                  onChange={(e) => handleUpdate(answer.id, e.target.value)}
                />
              ) : (
                <p>{answer.value}</p>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
};

export default FormViewer;
