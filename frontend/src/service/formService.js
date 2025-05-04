import axios from 'axios';

const API_URL = 'http://localhost:5000/api/forms';

const getForm = async (formId) => {
  const token = localStorage.getItem('token');
  const response = await axios.get(`${API_URL}/${formId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

const submitForm = async (formData) => {
  const token = localStorage.getItem('token');
  const response = await axios.post(API_URL, formData, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

const updateAnswers = async (formId, answers) => {
  const token = localStorage.getItem('token');
  const response = await axios.put(
    `${API_URL}/${formId}/answers`,
    { answers },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
};

export default {
  getForm,
  submitForm,
  updateAnswers,
};