import axios from 'axios';
export const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
axios.defaults.withCredentials = true;


function get_refresh(url) {
  return axios.get(url)
  .catch(err => {
    if (err.response?.status === 401) {
      return axios.get(`${API_URL}/auth/refresh`)
      .then(res => axios.get(url));
    }
  })
}

function post_refresh(url, data) {
  return axios.post(url, data)
  .catch(err => {
    if (err.response?.status === 401) {
      return axios.get(`${API_URL}/auth/refresh`)
      .then(res => axios.post(url, data));
    }
  })
}

// === OAuth ===
export async function fetchMe() {
    return get_refresh(`${API_URL}/auth/me`)
    .then(res => res.data)
    .catch(err => null)
}
export function startGoogleLogin() {
  const returnTo = window.location.href;
  // 백엔드로 바로 리다이렉트(백엔드가 구글로 다시 리다이렉트)
  window.location.href = `${API_URL}/auth/google/start?return_to=${encodeURIComponent(returnTo)}`;
}
export async function logout() {await post_refresh(`${API_URL}/auth/logout`);}

// === Words CRUD ===
export const updateWordsBatch = (wordsData) => post_refresh(`${API_URL}/words/update/batch`, wordsData);
export const deleteWordsBatch = (wordIds) => post_refresh(`${API_URL}/words/delete/batch`, wordIds);
export const getAllWords = (limit = null, offset = null) => axios.post(`${API_URL}/words/all`, { limit, offset });
export const searchWordsByWord = (searchTerm) => get_refresh(`${API_URL}/words/search/${encodeURIComponent(searchTerm)}`);
export const createWordsPersonal = (fd) => post_refresh(`${API_URL}/words/create/personal`, fd, {headers: { "Content-Type": "multipart/form-data" },});
export const getRandomWordsToLearn = (limit) => get_refresh(`${API_URL}/words/personal/random/${limit}`);
export const filterWords = (wordFilterData) => post_refresh(`${API_URL}/words/filter`, wordFilterData);

// === Examples CRUD ===
export const createExamplesBatch = (examplesData) => post_refresh(`${API_URL}/examples/create/batch`, examplesData);
export const readExamplesBatch = (exampleIds) => post_refresh(`${API_URL}/examples/read/batch`, exampleIds);
export const updateExamplesBatch = (examplesData) => post_refresh(`${API_URL}/examples/update/batch`, examplesData);
export const deleteExamplesBatch = (exampleIds) => post_refresh(`${API_URL}/examples/delete/batch`, exampleIds);
export const filterExamples = (exampleFilterData) => post_refresh(`${API_URL}/examples/filter`, exampleFilterData);
export const getExamplesForUser = () => get_refresh(`${API_URL}/examples/get-examples-for-user`);

// === Text Analysis ===
export const analyzeText = (text) => post_refresh(`${API_URL}/text/analyze`, { text });

// === User Text CRUD ===
export const createUserText = (userTextData) => post_refresh(`${API_URL}/user_text/create`, userTextData);
export const getUserText = (userTextId) => get_refresh(`${API_URL}/user_text/get/${userTextId}`);
export const getUserTextList = (limit = null, offset = null) => get_refresh(`${API_URL}/user_text/all`, { params: { limit, offset } });
export const updateUserText = (userTextData) => post_refresh(`${API_URL}/user_text/update`, userTextData);
export const deleteUserText = (userTextId) => get_refresh(`${API_URL}/user_text/delete/${userTextId}`);

// === User Data CRUD ===
export const getAllUsersAdmin = (limit = null, offset = null) => get_refresh(`${API_URL}/user_admin/get_all_users/${encodeURIComponent(limit)}/${encodeURIComponent(offset)}`);
export const deleteUserAdmin = (id) => get_refresh(`${API_URL}/user_admin/delete/${id}`);
export const getUserSummaryAdmin = (userId) => get_refresh(`${API_URL}/user_data/summary/admin/${userId}`);
export const getUserSummaryUser = () => get_refresh(`${API_URL}/user_data/summary/user`);
export const getUserWordSkillsUser = () => get_refresh(`${API_URL}/user_data/word_skills/user`);

// === Quiz Records ===
//export const saveQuizRecord = (quizRecord) => post_refresh(`${API_URL}/quiz/record`, quizRecord);
//export const getQuizRecords = (filters = {}) => post_refresh(`${API_URL}/quiz/records`, filters);
//export const getQuizStatistics = (filters = {}) => post_refresh(`${API_URL}/quiz/statistics`, filters);
