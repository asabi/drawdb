import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.currentDiagramId = null;
    this.isConnected = false;
  }

  // Get backend URL dynamically
  getBackendUrl() {
    // Use environment variable if available (for production)
    if (import.meta.env.VITE_BACKEND_URL) {
      return import.meta.env.VITE_BACKEND_URL;
    }
    
    const hostname = window.location.hostname;
    
    // If we're in development and using Vite proxy, use localhost:3001
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3001';
    }
    
    // For production, we'll use the same hostname but different port
    // This assumes the backend is running on port 3001 on the same server
    return `http://${hostname}:3001`;
  }

  // Connect to Socket.IO server
  connect() {
    if (this.socket && this.isConnected) {
      console.log('Socket already connected');
      return;
    }

    const backendUrl = this.getBackendUrl();
    console.log('Connecting to Socket.IO server:', backendUrl);
    
    this.socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket.IO connected:', this.socket.id);
      this.isConnected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Socket.IO disconnected');
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.log('❌ Socket.IO connection error:', error);
      this.isConnected = false;
    });
  }

  // Disconnect from Socket.IO server
  disconnect() {
    if (this.socket) {
      console.log('Disconnecting from Socket.IO server');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.currentDiagramId = null;
    }
  }

  // Join a diagram room
  joinDiagram(diagramId) {
    if (!this.socket || !this.isConnected) {
      console.log('Socket not connected, connecting first...');
      this.connect();
      // Wait a bit for connection to establish
      setTimeout(() => this.joinDiagram(diagramId), 1000);
      return;
    }

    if (this.currentDiagramId === diagramId) {
      console.log('Already in diagram room:', diagramId);
      return;
    }

    // Leave previous room if any
    if (this.currentDiagramId) {
      this.leaveDiagram(this.currentDiagramId);
    }

    console.log('Joining diagram room:', diagramId);
    this.socket.emit('join-diagram', diagramId);
    this.currentDiagramId = diagramId;
  }

  // Leave a diagram room
  leaveDiagram(diagramId) {
    if (!this.socket || !this.isConnected) {
      return;
    }

    console.log('Leaving diagram room:', diagramId);
    this.socket.emit('leave-diagram', diagramId);
    
    if (this.currentDiagramId === diagramId) {
      this.currentDiagramId = null;
    }
  }

  // Emit diagram update to all clients in the same room
  emitDiagramUpdate(diagramId, updateData) {
    if (!this.socket || !this.isConnected) {
      console.log('Socket not connected, cannot emit update');
      return;
    }

    console.log('Emitting diagram update for:', diagramId);
    this.socket.emit('diagram-updated', {
      diagramId,
      timestamp: new Date().toISOString(),
      ...updateData
    });
  }

  // Listen for diagram updates from other clients
  onDiagramUpdate(callback) {
    if (!this.socket) {
      console.log('Socket not available for listening');
      return;
    }

    this.socket.on('diagram-updated', (data) => {
      console.log('Received diagram update:', data);
      callback(data);
    });
  }

  // Remove diagram update listener
  offDiagramUpdate() {
    if (this.socket) {
      this.socket.off('diagram-updated');
    }
  }

  // Get connection status
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      socketId: this.socket?.id,
      currentDiagramId: this.currentDiagramId
    };
  }
}

// Export singleton instance
export const socketService = new SocketService(); 