import axios from 'axios';

export const uploadVideo = (data) => axios.post('http://localhost:8000/upload-video/', data);
export const listVideos = () => axios.get('http://localhost:8000/list-videos/');
export const getVideo = (videoId) => axios.get(`http://localhost:8000/video/${videoId}`);
export const updateVideo = (videoId, data) => axios.put(`http://localhost:8000/video/${videoId}`, data);
export const deleteVideo = (videoId) => axios.delete(`http://localhost:8000/video/${videoId}`);
export const createHistory = (data) => axios.post('http://localhost:8000/history/', data);
export const getVideoHistory = (videoId) => axios.get(`http://localhost:8000/history/${videoId}`);
export const getAllFavorites = () => axios.get('http://localhost:8000/favorites/');
export const toggleFavorite = (historyId) => axios.put(`http://localhost:8000/history/${historyId}/favorite`);
export const deleteHistory = (historyId) => axios.delete(`http://localhost:8000/history/${historyId}`);
