import axios from 'axios';
export const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
axios.defaults.withCredentials = true;


export const getDirectory = (dirPath) => axios.post(`${API_URL}/directory/get`, {dir_path: dirPath});
export const deleteDirectory = (dirPath) => axios.post(`${API_URL}/directory/delete-directory`, {dir_path: dirPath});
export const deletePathBatch = (pathList) => axios.post(`${API_URL}/directory/delete-path-batch`, {path_list: pathList});

export const movePathBatch = (pathChangeDict) => axios.post(`${API_URL}/directory/move-path-batch`, {path_change_dict: pathChangeDict});
export const setImageDirectoryBatch = (dirPath, imageIds) => axios.post(`${API_URL}/directory/set-image-batch`, {dir_path: dirPath, image_ids: imageIds});
export const editDirPath = (prevPath, newPath) => axios.post(`${API_URL}/directory/edit-path`, {prev_path: prevPath, new_path: newPath});

export const createImagesBatch = (imageRequestData) => axios.post(`${API_URL}/images/create-batch`, imageRequestData);
export const createImagesBatchFromImage = (formData) => {
    return axios.post(`${API_URL}/images/create-batch-from-image`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
      },
    });
};
export const getImageDetail = (imageId) => axios.post(`${API_URL}/images/get-detail`, {id: imageId});
export const searchFromPrompt = (prompt) => axios.post(`${API_URL}/images/search-from-prompt`, {prompt: prompt});