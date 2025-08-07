import axios from 'axios';

// === Figure ===
export const getRandomPrompt = () => axios.get('http://localhost:8000/random-prompt/');
export const addFigure = (formData) => axios.post("http://localhost:8000/add-figure/", formData, { headers: {'Content-Type': 'multipart/form-data'} });
export const getFiguresFromPrompt = (prompt) => axios.post(`http://localhost:8000/figures-from-prompt/`, { prompt: prompt });
export const fetchFigure = (figureId) => axios.get(`http://localhost:8000/get-figure/${figureId}`);
export const updateFigure = (formData) => axios.post(`http://localhost:8000/update-figure/`, formData, { headers: {'Content-Type': 'multipart/form-data'} });
export const deleteFigure = (figureId) => axios.get(`http://localhost:8000/delete-figure/${figureId}`);

