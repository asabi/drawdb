import axios from 'axios';

// Dynamically determine the backend URL based on the current location
const getBackendUrl = () => {
  const currentHost = window.location.hostname;
  
  // If accessing from localhost, use localhost backend
  if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
    return 'http://localhost:3001/api';
  }
  
  // If accessing from a different machine, use the server's IP
  // We'll use the same hostname but different port for the backend
  return `http://${currentHost}:3001/api`;
};

// Try multiple backend URLs if the first one fails
const tryBackendUrls = async (apiCall) => {
  const urls = [
    getBackendUrl(),
    'http://localhost:3001/api',
    'http://127.0.0.1:3001/api'
  ];
  
  // Add server IP as fallback if we're accessing from a different machine
  const currentHost = window.location.hostname;
  if (currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
    // Try the server's IP address directly
    urls.unshift(`http://${currentHost}:3001/api`);
  }
  
  for (const url of urls) {
    try {
      console.log(`Trying backend URL: ${url}`);
      const api = axios.create({
        baseURL: url,
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const result = await apiCall(api);
      console.log(`Success with URL: ${url}`);
      return result;
    } catch (error) {
      console.log(`Failed with URL ${url}:`, error.message);
      if (url === urls[urls.length - 1]) {
        throw error; // Re-throw if all URLs failed
      }
    }
  }
};

const API_BASE_URL = getBackendUrl();

// Log the backend URL for debugging
console.log('Primary Backend URL:', API_BASE_URL);
console.log('Current hostname:', window.location.hostname);

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
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
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
    console.error('Full error:', error);
    return Promise.reject(error);
  }
);

// Health check
export const healthCheck = async () => {
  try {
    return await tryBackendUrls(async (api) => {
      const response = await api.get('/health');
      return response.data;
    });
  } catch (error) {
    console.error('Health check failed:', error);
    throw error;
  }
};

// Create a new diagram
export const createDiagram = async (title, databaseType, content) => {
  try {
    return await tryBackendUrls(async (api) => {
      const response = await api.post('/diagrams', {
        title,
        databaseType,
        content
      });
      return response.data;
    });
  } catch (error) {
    console.error('createDiagram error:', error);
    throw error;
  }
};

// Get a diagram by ID
export const getDiagram = async (id) => {
  try {
    return await tryBackendUrls(async (api) => {
      const response = await api.get(`/diagrams/${id}`);
      return response.data;
    });
  } catch (error) {
    console.error('getDiagram error:', error);
    throw error;
  }
};

// Update a diagram
export const updateDiagram = async (id, title, databaseType, content) => {
  try {
    return await tryBackendUrls(async (api) => {
      const response = await api.put(`/diagrams/${id}`, {
        title,
        databaseType,
        content
      });
      return response.data;
    });
  } catch (error) {
    console.error('updateDiagram error:', error);
    throw error;
  }
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