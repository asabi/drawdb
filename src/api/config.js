// Centralized API configuration for both local and remote access
class ApiConfig {
  constructor() {
    this.baseUrl = this.getBaseUrl();
  }

  getBaseUrl() {
    // Always use relative URLs for API calls
    // This works with Vite proxy in development and can be configured for production
    return '/api';
  }

  getSocketUrl() {
    // For Socket.IO, we need the full URL
    // In development, use 127.0.0.1:3001 to avoid IPv6 issues
    // In production, use the same hostname but port 3001
    const hostname = window.location.hostname;
    const port = window.location.port;
    
    // If we're on localhost in development, use 127.0.0.1:3001
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://127.0.0.1:3001';
    }
    
    // In production, use the same hostname but port 3001
    return `http://${hostname}:3001`;
  }

  // Helper method to get full URL for any endpoint
  getUrl(endpoint) {
    return `${this.baseUrl}${endpoint}`;
  }
}

// Create a singleton instance
const apiConfig = new ApiConfig();

export default apiConfig; 