import axios from 'axios';
export const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
axios.defaults.withCredentials = true;

export const getDirectory = (dirPath) => axios.post(`${API_URL}/directory/get`, {dir_path: dirPath});
export const setImageDirectoryBatch = (dirPath, imageIds) => axios.post(`${API_URL}/directory/set-image-batch`, {dir_path: dirPath, image_ids: imageIds});
export const deleteDirectory = (dirPath) => axios.post(`${API_URL}/directory/delete-directory`, {dir_path: dirPath});
export const deletePathBatch = (pathList) => axios.post(`${API_URL}/directory/delete-path-batch`, {path_list: pathList});
export const movePathBatch = (pathChangeDict) => axios.post(`${API_URL}/directory/move-path-batch`, {path_change_dict: pathChangeDict});
export const editDirPath = (prevPath, newPath) => axios.post(`${API_URL}/directory/edit-path`, {prev_path: prevPath, new_path: newPath});

export const getImageDetail = (imageId) => axios.post(`${API_URL}/images/get-detail`, {id: imageId});
export const searchFromPrompt = (prompt) => axios.post(`${API_URL}/images/search-from-prompt`, {prompt: prompt});

export const getGroup = (groupID, groupName) => axios.post(`${API_URL}/group/get`, {id: groupID, name: groupName});
export const createGroup = (groupName) => axios.post(`${API_URL}/group/create-group`, {name: groupName});
export const editGroupName = (groupID, groupName) => axios.post(`${API_URL}/group/edit-name`, {id: groupID, name: groupName});

//GroupPreviewData 리스트 가져오기로 대체
//export const sortKeywordsByKey = () => axios.get(`${API_URL}/keywords/sort-by-key`);
//export const filterKeywords = (keywordFilterData) => axios.post(`${API_URL}/keywords/filter`, keywordFilterData);
export const deleteKeywordsBatch = (keywordIds) => axios.post(`${API_URL}/keywords/delete-batch`, keywordIds);

export const createImagesBatch = (imageRequestData) => axios.post(`${API_URL}/images/create-batch`, imageRequestData);
export const filterImages = (imageFilterData) => axios.post(`${API_URL}/images/filter`, imageFilterData);

//to do later
//export const getImageDetail = (imageId) => axios.get(`${API_URL}/images/get-detail/${imageId}`);

export const deleteImagesBatch = (imageIds) => axios.post(`${API_URL}/images/delete-batch`, imageIds);

// NOTE: FastAPI 엔드포인트가 쿼리 파라미터로 정의되어 있어 쿼리로 전달합니다.
export const setImageGroupBatch = (groupImageData) => axios.post(`${API_URL}/images/set-group-batch`, groupImageData);
export const unsetImageGroupBatch = (groupImageData) => axios.post(`${API_URL}/images/unset-group-batch`, groupImageData);
export const deleteGroupBatch = (groupIds) => axios.post(`${API_URL}/images/delete-group-batch`, groupIds);
export const getGroupPreviewBatch = () => axios.get(`${API_URL}/images/get-group-preview-batch`);
