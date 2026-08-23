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
// Teacher Subjects
export const getMySubjects = () => api.get('/teacher-subjects/me');
export const addMySubject = (subjectId) => api.post(`/teacher-subjects/me/${subjectId}`);
export const removeMySubject = (subjectId) => api.delete(`/teacher-subjects/me/${subjectId}`);
// Teacher Grade Levels
export const getMyGradeLevels = () => api.get('/teacher-grade-levels/me');
export const addMyGradeLevel = (grade) => api.post(`/teacher-grade-levels/me/${grade}`);
export const removeMyGradeLevel = (grade) => api.delete(`/teacher-grade-levels/me/${grade}`);
// Teacher Homeroom Preferences
export const getMyHomeroomPref = () => api.get('/teacher-homeroom-prefs/me');
export const saveMyHomeroomPref = (data) => api.post('/teacher-homeroom-prefs/me', data);

export const getMyPreferences = () => api.get('/teacher-preferences/me');
export const saveMyPreferences = (data) => api.post('/teacher-preferences/me', data);

// Admin: read a SPECIFIC teacher's preferences (by teacher id)
export const getTeacherPreferencesById = (id) => api.get(`/teacher-preferences/for-teacher/${id}`);
export const getTeacherSubjectsById = (id) => api.get(`/teacher-subjects/for-teacher/${id}`);
export const getTeacherGradeLevelsById = (id) => api.get(`/teacher-grade-levels/for-teacher/${id}`);
export const getTeacherHomeroomById = (id) => api.get(`/teacher-homeroom-prefs/for-teacher/${id}`);

export const getViolations = () => api2.get('/schedule/violations');

// ========================================================================
// SmarTime generation/schedule backend (port 8001) — separate from 8000
// ========================================================================
const API2_URL = 'http://91.99.11.56:8001';

// A second axios instance pointed at 8001, with its OWN token.
const api2 = axios.create({
  baseURL: API2_URL,
  headers: { 'Content-Type': 'application/json' },
});
api2.interceptors.request.use((config) => {
  const token = localStorage.getItem('token8001');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Silent login to 8001 (same ID + password as 8000). Stores its token.
export const login8001 = (username, password) =>
  axios.post(`${API2_URL}/auth/login`, { username, password });

// Generation (admin)
export const runGeneration = () => api2.post('/generation/run');
export const getGenerationStatus = (jobId) => api2.get(`/generation/${jobId}`);

// Schedule display
export const getCurrentSchedule = () => api2.get('/schedule/current'); // admin: whole school
export const getMySchedule = () => api2.get('/schedule/me');           // teacher: own only
export const publishSchedule = () => api2.post('/schedule/publish');

// Password reset (no login needed)
export const forgotPassword = (email) =>
  axios.post(`${API2_URL}/auth/forgot-password`, { email });
export const verifyResetCode = (email, code) =>
  axios.post(`${API2_URL}/auth/verify-reset-code`, { email, code });
export const setNewPassword = (email, code, password, confirm_password) =>
  axios.post(`${API2_URL}/auth/set-new-password`, { email, code, password, confirm_password });

// Notifications
export const sendNotification = (data) => api.post('/notifications/', data);
export const getMyNotifications = () => api.get('/notifications/me');
export const markNotificationRead = (id) => api.patch(`/notifications/me/${id}/read`);
export const getNotifications = () => api.get('/notifications/admin');

export default api;
