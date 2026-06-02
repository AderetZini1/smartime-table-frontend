import axios from 'axios';

const API_URL = '';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// מוסיף token לכל בקשה אוטומטית
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export const login = (username, password) => {
  const formData = new FormData();
  formData.append('username', username);
  formData.append('password', password);
  return axios.post(`${API_URL}/auth/login`, formData);
};

export const getMe = () => api.get('/auth/me');

// Teachers
export const getTeachers = () => api.get('/teachers/');
export const createTeacher = (data) => api.post('/teachers/', data);
export const updateTeacher = (id, data) => api.patch(`/teachers/${id}`, data);
export const deleteTeacher = (id) => api.delete(`/teachers/${id}`);

// Rooms
export const getRooms = () => api.get('/rooms/');
export const createRoom = (data) => api.post('/rooms/', data);
export const updateRoom = (id, data) => api.patch(`/rooms/${id}`, data);
export const deleteRoom = (id) => api.delete(`/rooms/${id}`);

// Subjects
export const getSubjects = () => api.get('/subjects/');
export const createSubject = (data) => api.post('/subjects/', data);
export const updateSubject = (id, data) => api.patch(`/subjects/${id}`, data);
export const deleteSubject = (id) => api.delete(`/subjects/${id}`);

// Teacher Constraints
export const getMyConstraints = () => api.get('/teacher-constraints/');
export const createConstraint = (data) => api.post('/teacher-constraints/', data);
export const deleteConstraint = (id) => api.delete(`/teacher-constraints/${id}`);

// Student Groups
export const getStudentGroups = () => api.get('/student-groups/');
export const createStudentGroup = (data) => api.post('/student-groups/', data);
export const updateStudentGroup = (id, data) => api.patch(`/student-groups/${id}`, data);
export const deleteStudentGroup = (id) => api.delete(`/student-groups/${id}`);

// Submission Windows
export const getActiveWindow = () => api.get('/submission-windows/active');
export const getSubmissionWindows = () => api.get('/submission-windows/');
export const createSubmissionWindow = (data) => api.post('/submission-windows/', data);
export const deleteSubmissionWindow = (id) => api.delete(`/submission-windows/${id}`);

// Teacher Requests
export const getMyRequests = () => api.get('/teacher-requests/');
export const createRequest = (data) => api.post('/teacher-requests/', data);
export const respondToRequest = (id, data) => api.patch(`/teacher-requests/${id}/respond`, data);

export default api;