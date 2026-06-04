import axios from 'axios';

const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL,
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (user?.token) {
    config.headers.Authorization = `Bearer ${user.token}`;
  }
  return config;
});

// Handle 401 globally (token expired)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

// ── Audits ────────────────────────────────────────
export const auditsAPI = {
  getAll: (params) => api.get('/audits', { params }),
  getOne: (id) => api.get(`/audits/${id}`),
  create: (data) => api.post('/audits', data),
  update: (id, data) => api.put(`/audits/${id}`, data),
  delete: (id) => api.delete(`/audits/${id}`),
};

// ── Checklists ────────────────────────────────────
export const checklistsAPI = {
  getAll: (auditId) => api.get('/checklists', { params: { auditId } }),
  getOne: (id) => api.get(`/checklists/${id}`),
  create: (data) => api.post('/checklists', data),
  update: (id, data) => api.put(`/checklists/${id}`, data),
  updateItem: (checklistId, itemId, data) =>
    api.patch(`/checklists/${checklistId}/items/${itemId}`, data),
  delete: (id) => api.delete(`/checklists/${id}`),
};

export const roadmapAPI = {
  get: () => api.get('/roadmap'),
  save: (rows) => api.put('/roadmap', { rows }),
};

export const operatorUploadsAPI = {
  getAll: () => api.get('/operator-uploads'),
  create: (data) => api.post('/operator-uploads', data),
  update: (id, data) => api.put(`/operator-uploads/${id}`, data),
  delete: (id) => api.delete(`/operator-uploads/${id}`),
  clearAll: () => api.delete('/operator-uploads'),
};

export default api;
