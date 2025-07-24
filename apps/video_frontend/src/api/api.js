import axios from 'axios';

// 비디오 관련 API
export const uploadVideo = (data) => axios.post('/api/upload-video/', data);
export const listVideos = () => axios.get('/api/list-videos/');
export const getVideo = (videoId) => axios.get(`/api/video/${videoId}`);
export const updateVideo = (videoId, data) => axios.post(`/api/video-update/${videoId}`, data);
export const deleteVideo = (videoId) => axios.delete(`/api/video/${videoId}`);

// 히스토리 관련 API
export const createHistory = (data) => axios.post('/api/history/', data);
export const getVideoHistory = (videoId) => axios.get(`/api/history/${videoId}`);
export const getAllFavorites = () => axios.get('/api/favorites/');
export const toggleFavorite = (historyId) => axios.put(`/api/history/${historyId}/favorite`);
export const deleteHistory = (historyId) => axios.delete(`/api/history/${historyId}`);


