import axios from 'axios';
export const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
axios.defaults.withCredentials = true;

//GroupPreviewData 리스트 가져오기로 대체
//export const sortKeywordsByKey = () => axios.get(`${API_URL}/keywords/sort-by-key`);
//export const filterKeywords = (keywordFilterData) => axios.post(`${API_URL}/keywords/filter`, keywordFilterData);
export const deleteKeywordsBatch = (keywordIds) => axios.post(`${API_URL}/keywords/delete-batch`, keywordIds);


export const createImagesBatch = (imagesData) => axios.post(`${API_URL}/images/create-batch`, imagesData);
export const filterImages = (imageFilterData) => axios.post(`${API_URL}/images/filter`, imageFilterData);

//to do later
//export const getImageDetail = (imageId) => axios.get(`${API_URL}/images/get-detail/${imageId}`);

export const deleteImagesBatch = (imageIds) => axios.post(`${API_URL}/images/delete-batch`, imageIds);

// NOTE: FastAPI 엔드포인트가 쿼리 파라미터로 정의되어 있어 쿼리로 전달합니다.
export const setImageGroupBatch = (groupImageData) => axios.post(`${API_URL}/images/set-group-batch`, groupImageData);
export const unsetImageGroupBatch = (groupImageData) => axios.post(`${API_URL}/images/unset-group-batch`, groupImageData);
export const deleteGroupBatch = (groupIds) => axios.post(`${API_URL}/images/delete-group-batch`, groupIds);
export const getGroupPreviewBatch = () => axios.get(`${API_URL}/images/get-group-preview-batch`);
export const editGroupName = (groupData) => axios.post(`${API_URL}/group/edit-name`, groupData);