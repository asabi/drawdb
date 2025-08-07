import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { nanoid } from 'nanoid';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Database from './database.js';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://drawdb.com'] 
      : true, // Allow all origins in development
    credentials: true
  }
});

const PORT = process.env.PORT || 3001;

// Initialize database
const db = new Database();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Join a diagram room
  socket.on('join-diagram', (diagramId) => {
    socket.join(`diagram-${diagramId}`);
    console.log(`Client ${socket.id} joined diagram ${diagramId}`);
  });

  // Leave a diagram room
  socket.on('leave-diagram', (diagramId) => {
    socket.leave(`diagram-${diagramId}`);
    console.log(`Client ${socket.id} left diagram ${diagramId}`);
  });

  // Handle diagram updates and broadcast to other clients
  socket.on('diagram-updated', (data) => {
    const { diagramId, timestamp, ...updateData } = data;
    console.log(`Diagram ${diagramId} updated by client ${socket.id}`);
    
    // Get all clients in the room
    const room = io.sockets.adapter.rooms.get(`diagram-${diagramId}`);
    const clientsInRoom = room ? Array.from(room) : [];
    console.log(`Clients in room diagram-${diagramId}:`, clientsInRoom);
    console.log(`Broadcasting to all clients except ${socket.id}`);
    
    // Broadcast to all other clients in the same diagram room
    socket.to(`diagram-${diagramId}`).emit('diagram-updated', {
      diagramId,
      timestamp,
      updatedBy: socket.id,
      ...updateData
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://drawdb.com'] 
    : true, // Allow all origins in development
  credentials: true
}));

// Rate limiting - more lenient for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs (increased for development)
  message: 'Too many requests from this IP, please try again later.',
  skipSuccessfulRequests: true, // Don't count successful requests
  skipFailedRequests: false // Count failed requests
});

// Apply rate limiting to all API routes except health check
app.use('/api/', (req, res, next) => {
  if (req.path === '/health') {
    return next(); // Skip rate limiting for health check
  }
  return limiter(req, res, next);
});

app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Create a new diagram
app.post('/api/diagrams', async (req, res) => {
  try {
    const { title, databaseType, content } = req.body;
    
    if (!title || !databaseType || !content) {
      return res.status(400).json({ 
        error: 'Missing required fields: title, databaseType, content' 
      });
    }

    const id = nanoid(12); // Generate 12-character ID
    const diagram = await db.createDiagram(id, title, databaseType, content);
    
    res.status(201).json(diagram);
  } catch (error) {
    console.error('Error creating diagram:', error);
    res.status(500).json({ error: 'Failed to create diagram' });
  }
});

// Get a diagram by ID
app.get('/api/diagrams/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const diagram = await db.getDiagram(id);
    res.json(diagram);
  } catch (error) {
    if (error.message === 'Diagram not found') {
      res.status(404).json({ error: 'Diagram not found' });
    } else {
      console.error('Error getting diagram:', error);
      res.status(500).json({ error: 'Failed to get diagram' });
    }
  }
});

// Update a diagram
app.put('/api/diagrams/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, databaseType, content } = req.body;
    
    if (!title || !databaseType || !content) {
      return res.status(400).json({ 
        error: 'Missing required fields: title, databaseType, content' 
      });
    }

    const diagram = await db.updateDiagram(id, title, databaseType, content);
    
    // Emit real-time update to all clients viewing this diagram
    io.to(`diagram-${id}`).emit('diagram-updated', {
      id,
      title,
      databaseType,
      content,
      updatedAt: diagram.updatedAt
    });
    
    res.json(diagram);
  } catch (error) {
    if (error.message === 'Diagram not found') {
      res.status(404).json({ error: 'Diagram not found' });
    } else {
      console.error('Error updating diagram:', error);
      res.status(500).json({ error: 'Failed to update diagram' });
    }
  }
});

// Delete a diagram
app.delete('/api/diagrams/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.deleteDiagram(id);
    res.status(204).send();
  } catch (error) {
    if (error.message === 'Diagram not found') {
      res.status(404).json({ error: 'Diagram not found' });
    } else {
      console.error('Error deleting diagram:', error);
      res.status(500).json({ error: 'Failed to delete diagram' });
    }
  }
});

// Get recent diagrams
app.get('/api/diagrams', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const diagrams = await db.getRecentDiagrams(limit);
    res.json(diagrams);
  } catch (error) {
    console.error('Error getting recent diagrams:', error);
    res.status(500).json({ error: 'Failed to get recent diagrams' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
async function startServer() {
  try {
    await db.connect();
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
      console.log(`Network access: http://0.0.0.0:${PORT}/api/health`);
      console.log(`WebSocket server: ws://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down server...');
  await db.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down server...');
  await db.close();
  process.exit(0);
});

startServer(); 