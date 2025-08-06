import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for logging
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.status, error.response?.data);
    return Promise.reject(error);
  }
);

// Health check
export const healthCheck = async () => {
  const response = await api.get('/health');
  return response.data;
};

// Create a new diagram
export const createDiagram = async (title, databaseType, content) => {
  const response = await api.post('/diagrams', {
    title,
    databaseType,
    content
  });
  return response.data;
};

// Get a diagram by ID
export const getDiagram = async (id) => {
  const response = await api.get(`/diagrams/${id}`);
  return response.data;
};

// Update a diagram
export const updateDiagram = async (id, title, databaseType, content) => {
  const response = await api.put(`/diagrams/${id}`, {
    title,
    databaseType,
    content
  });
  return response.data;
};

// Delete a diagram
export const deleteDiagram = async (id) => {
  const response = await api.delete(`/diagrams/${id}`);
  return response.data;
};

// Get recent diagrams
export const getRecentDiagrams = async (limit = 10) => {
  const response = await api.get(`/diagrams?limit=${limit}`);
  return response.data;
}; 