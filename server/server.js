import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Database from './database.js';
import connectionManager from './db/connection.js';
import SchemaManager from './db/schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Rate limiting - DISABLED for internal use
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100 // limit each IP to 100 requests per windowMs
// });

// app.use(limiter);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
}));

// Compression
app.use(compression());

// CORS
app.use(cors());

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize connection manager and database
let isInitialized = false;
let database = null;

async function initializeServer() {
  try {
    await connectionManager.init();
    await connectionManager.connectToDefault();
    database = new Database();
    await database.connect();
    isInitialized = true;
    console.log('Server initialized successfully');
  } catch (error) {
    console.error('Failed to initialize server:', error);
    // Continue anyway, the server will work with SQLite fallback
  }
}

// Initialize on startup
initializeServer();

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    initialized: isInitialized,
    connected: connectionManager.isConnected()
  });
});

// Get recent diagrams
app.get('/api/diagrams', async (req, res) => {
  try {
    if (!database) {
      database = new Database();
      await database.connect();
    }
    const diagrams = await database.getRecentDiagrams();
    res.json(diagrams);
  } catch (error) {
    console.error('Error getting recent diagrams:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get diagram by ID
app.get('/api/diagrams/:id', async (req, res) => {
  try {
    if (!database) {
      database = new Database();
      await database.connect();
    }
    const diagram = await database.getDiagram(req.params.id);
    if (!diagram) {
      return res.status(404).json({ error: 'Diagram not found' });
    }
    res.json(diagram);
  } catch (error) {
    console.error('Error getting diagram:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new diagram
app.post('/api/diagrams', async (req, res) => {
  try {
    if (!database) {
      database = new Database();
      await database.connect();
    }
    const { id, title, content } = req.body;
    
    // Use the current database engine from connection manager
    const currentConfig = connectionManager.getConfig();
    const databaseType = currentConfig?.engine || 'sqlite';
    
    const diagram = await database.createDiagram(id, title, databaseType, content);
    res.json(diagram);
  } catch (error) {
    console.error('Error creating diagram:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update diagram
app.put('/api/diagrams/:id', async (req, res) => {
  try {
    if (!database) {
      database = new Database();
      await database.connect();
    }
    const { title, content } = req.body;
    
    // Use the current database engine from connection manager
    const currentConfig = connectionManager.getConfig();
    const databaseType = currentConfig?.engine || 'sqlite';
    
    const diagram = await database.updateDiagram(req.params.id, title, databaseType, content);
    res.json(diagram);
  } catch (error) {
    console.error('Error updating diagram:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete diagram
app.delete('/api/diagrams/:id', async (req, res) => {
  try {
    if (!database) {
      database = new Database();
      await database.connect();
    }
    await database.deleteDiagram(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting diagram:', error);
    res.status(500).json({ error: error.message });
  }
});

// Settings routes
app.post('/api/settings/test', async (req, res) => {
  try {
    const config = req.body;
    console.log('Test connection request received:', config);
    
    const result = await connectionManager.testConnection(config);
    console.log('Test connection result:', result);
    res.json(result);
  } catch (error) {
    console.error('Error testing connection:', error);
    res.status(500).json({ 
      success: false, 
      message: `Connection failed: ${error.message}` 
    });
  }
});

app.post('/api/settings/apply', async (req, res) => {
  try {
    const config = req.body;
    console.log('Apply settings request received:', config);
    
    // Test the connection first
    const testResult = await connectionManager.testConnection(config);
    if (!testResult.success) {
      return res.status(400).json(testResult);
    }
    
    // Disconnect current connection
    await connectionManager.disconnect();
    
    // Connect with new configuration
    await connectionManager.connect(config);
    
    // Ensure database schema
    const schemaManager = new SchemaManager(connectionManager);
    await schemaManager.ensureDatabaseAndSchema();
    
    // Reinitialize database with new connection
    if (database) {
      // Don't call database.close() as it disconnects the connection manager
      database = new Database();
      await database.connect();
    } else {
      database = new Database();
      await database.connect();
    }
    
    res.json({ success: true, message: 'Settings applied successfully' });
  } catch (error) {
    console.error('Error applying settings:', error);
    res.status(500).json({ 
      success: false, 
      message: `Connection failed: ${error.message}` 
    });
  }
});

app.get('/api/settings/status', async (req, res) => {
  try {
    const isConnected = connectionManager.isConnected();
    const config = connectionManager.getConfig();
    const defaultConfig = await connectionManager.getDefaultConfig();
    
    res.json({
      connected: isConnected,
      engine: config?.engine || defaultConfig?.engine || 'sqlite',
      database: config?.database || defaultConfig?.database || null,
      defaultSQLitePath: join(__dirname, 'drawdb.sqlite'),
      currentConfig: config,
      defaultConfig: defaultConfig
    });
  } catch (error) {
    console.error('Error getting settings status:', error);
    res.status(500).json({ error: error.message });
  }
});

// New configuration management endpoints
app.get('/api/configs', async (req, res) => {
  try {
    const configs = await connectionManager.getAllConfigs();
    res.json(configs);
  } catch (error) {
    console.error('Error getting configurations:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/configs/:engine', async (req, res) => {
  try {
    const config = await connectionManager.getConfigByEngine(req.params.engine);
    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }
    res.json(config);
  } catch (error) {
    console.error('Error getting configuration:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/configs', async (req, res) => {
  try {
    const config = req.body;
    const id = await connectionManager.saveConfig(config);
    res.json({ id, success: true });
  } catch (error) {
    console.error('Error saving configuration:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/configs/:id', async (req, res) => {
  try {
    const config = { ...req.body, id: parseInt(req.params.id) };
    const id = await connectionManager.saveConfig(config);
    res.json({ id, success: true });
  } catch (error) {
    console.error('Error updating configuration:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/configs/:id', async (req, res) => {
  try {
    await connectionManager.deleteConfig(parseInt(req.params.id));
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting configuration:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/configs/:engine/connect', async (req, res) => {
  try {
    const config = await connectionManager.getConfigByEngine(req.params.engine);
    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }
    
    // Disconnect current connection
    await connectionManager.disconnect();
    await connectionManager.connect(config);
    
    // Reinitialize database with new connection (but don't close the connection manager)
    if (database) {
      // Don't call database.close() as it disconnects the connection manager
      database = new Database();
      await database.connect();
    } else {
      database = new Database();
      await database.connect();
    }
    
    res.json({ success: true, message: `Connected to ${config.engine}` });
  } catch (error) {
    console.error('Error connecting to database:', error);
    res.status(500).json({ error: error.message });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);
  console.log('📍 Client IP:', socket.handshake.address);
  console.log('🌐 Client headers:', socket.handshake.headers.origin);

  socket.on('join-diagram', (diagramId) => {
    socket.join(`diagram-${diagramId}`);
    socket.to(`diagram-${diagramId}`).emit('user-joined', { userId: socket.id });
    console.log(`Client ${socket.id} joined diagram ${diagramId}`);
  });

  socket.on('leave-diagram', (diagramId) => {
    socket.leave(`diagram-${diagramId}`);
    socket.to(`diagram-${diagramId}`).emit('user-left', { userId: socket.id });
    console.log(`Client ${socket.id} left diagram ${diagramId}`);
  });

  socket.on('diagram-update', (data) => {
    const { diagramId, updates } = data;
    console.log(`📊 Diagram ${diagramId} updated by client ${socket.id}`);
    console.log(`📊 Update data:`, updates);
    
    // Broadcast to all clients in the room except the sender
    socket.to(`diagram-${diagramId}`).emit('diagram-updated', {
      diagramId,
      updates,
      updatedBy: socket.id
    });
    console.log(`📤 Broadcasted update to room diagram-${diagramId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  if (database) {
    await database.close();
  }
  await connectionManager.disconnect();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Network access: http://0.0.0.0:${PORT}/api/health`);
  console.log(`WebSocket server: ws://0.0.0.0:${PORT}`);
}); 