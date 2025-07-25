import axios from 'axios';
const API_URL = 'http://localhost:8000';

// 비디오 관련 API
export const uploadVideo = (data) => axios.post(`${API_URL}/upload-video/`, data);
export const listVideos = () => axios.get(`${API_URL}/list-videos/`);
export const getVideo = (videoId) => axios.get(`${API_URL}/video/${videoId}`);
export const updateVideo = (videoId, data) => axios.post(`${API_URL}/video-update/${videoId}`, data);
export const deleteVideo = (videoId) => axios.delete(`${API_URL}/video/${videoId}`);

// 히스토리 관련 API
export const createHistory = (data) => axios.post(`${API_URL}/history/`, data);
export const getVideoHistory = (videoId) => axios.get(`${API_URL}/history/${videoId}`);
export const getAllFavorites = () => axios.get(`${API_URL}/favorites/`);
export const toggleFavorite = (historyId) => axios.put(`${API_URL}/history/${historyId}/favorite`);
export const deleteHistory = (historyId) => axios.delete(`${API_URL}/history/${historyId}`);

// 썸네일 생성 관련 API
export const createThumbnailForHistory = (historyId) => axios.post(`${API_URL}/history/${historyId}/thumbnail`);
export const batchCreateThumbnails = (historyIds) => axios.post(`${API_URL}/history/batch-create-thumbnails`, historyIds);

// 영상 파일 동기화 API
export const syncVideoFiles = () => axios.post(`${API_URL}/sync-video-files/`);


