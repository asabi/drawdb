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
    // Always use the same hostname as the current page but port 3001
    const hostname = window.location.hostname;
    const port = window.location.port;
    
    // If we're accessing via IP address (remote access), use that IP
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `http://${hostname}:3001`;
    }
    
    // For localhost access, use 127.0.0.1:3001 to avoid IPv6 issues
    return 'http://127.0.0.1:3001';
  }

  // Helper method to get full URL for any endpoint
  getUrl(endpoint) {
    return `${this.baseUrl}${endpoint}`;
  }
}

// Create a singleton instance
const apiConfig = new ApiConfig();

export default apiConfig; 