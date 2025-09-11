import axios from 'axios';
export const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
axios.defaults.withCredentials = true;

export const createKeywordsBatch = (keywordsData) => axios.post(`${API_URL}/keywords/create-batch`, keywordsData);
export const sortKeywordsByKey = () => axios.get(`${API_URL}/keywords/sort-by-key`);
export const filterKeywords = (keywordFilterData) => axios.post(`${API_URL}/keywords/filter`, keywordFilterData);
export const updateKeyword = (keywordData) => axios.post(`${API_URL}/keywords/update`, keywordData);
export const deleteKeywordsBatch = (keywordIds) => axios.post(`${API_URL}/keywords/delete-batch`, keywordIds);

export const createImagesBatch = (imagesData) => axios.post(`${API_URL}/images/create-batch`, imagesData);
export const filterImages = (imageFilterData) => axios.post(`${API_URL}/images/filter`, imageFilterData);
export const getImageDetail = (imageId) => axios.get(`${API_URL}/images/get-detail/${imageId}`);
export const deleteImagesBatch = (imageIds) => axios.post(`${API_URL}/images/delete-batch`, imageIds);

// NOTE: FastAPI 엔드포인트가 쿼리 파라미터로 정의되어 있어 쿼리로 전달합니다.
export const setImageGroupBatch = (groupImageData) => axios.post(`${API_URL}/images/set-group-batch`, groupImageData);
export const getGroupPreviewBatch = () => axios.get(`${API_URL}/images/get-group-preview-batch`);
export const deleteGroupBatch = (groupNames) => axios.post(`${API_URL}/images/delete-group-batch`, groupNames);