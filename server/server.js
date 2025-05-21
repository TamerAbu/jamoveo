const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const { createServer } = require('http');
const { Server } = require('socket.io');
const auth = require('./routes/routesAuth');
const songs = require('./routes/routesSongs');

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

// Initialize Express app
const app = express();

// MODIFIED: Properly configured CORS with specific origins
const corsOptions = {
  // IMPORTANT: Use exact origins instead of wildcard when credentials are involved
  origin: process.env.NODE_ENV === 'production'
    ? ['https://jamoveo-frontend-x8uo.onrender.com'] // Exact frontend URL
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true // This requires specific origins, not wildcard
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Parse JSON request body
app.use(express.json());

// Create HTTP server for Socket.io
const httpServer = createServer(app);

// MODIFIED: Socket.io with proper CORS settings
const io = new Server(httpServer, {
  cors: corsOptions, // Use the same CORS settings
  pingTimeout: 60000,
  pingInterval: 25000,
  connectionStateRecovery: {
    maxDisconnectionDuration: 30000,
    skipMiddlewares: true,
  },
  transports: ['polling', 'websocket'] // Try polling first, then websocket
});

// Track active rehearsals and participants
const activeRooms = new Map();
// Track most recent sync events to prevent duplicates
const recentSyncEvents = new Map();

// Mount routes
app.use('/api/auth', auth);
app.use('/api/songs', songs);

// Basic route to test the server
app.get('/', (req, res) => {
  res.send('JaMoveo API is running...');
});

// Debug endpoint to check socket status
app.get('/api/debug/socket-status', (req, res) => {
  try {
    const status = {
      connected: io.engine.clientsCount,
      rooms: Array.from(io.sockets.adapter.rooms.keys()),
      active_rehearsals: Array.from(activeRooms.keys()),
      timestamp: new Date().toISOString()
    };
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper to clean up old events (keep only last 50 per room)
const cleanupOldEvents = (roomName) => {
  if (!recentSyncEvents.has(roomName)) {
    recentSyncEvents.set(roomName, new Map());
    return;
  }
  
  const events = recentSyncEvents.get(roomName);
  if (events.size > 50) {
    // Convert to array, sort by timestamp (oldest first), and remove oldest
    const eventsArray = Array.from(events.entries());
    eventsArray.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest events to keep size at 50
    while (events.size > 50) {
      const [oldestId] = eventsArray.shift();
      events.delete(oldestId);
    }
  }
};

// Socket authentication middleware
io.use((socket, next) => {
  try {
    // Try to get token from multiple places
    const token = 
      socket.handshake.auth.token || 
      socket.handshake.headers.authorization?.replace('Bearer ', '') ||
      socket.handshake.query.token;
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }
    
    // You would normally verify the token here
    // For now, we'll just log and accept all connections
    console.log(`Socket authentication received token: ${token.substring(0, 10)}...`);
    
    // Set user data on socket for later use
    socket.userId = 'user-' + Math.random().toString(36).substring(2, 10);
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication error'));
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  // Immediately send confirmation to client
  socket.emit('connectionConfirmed', { 
    socketId: socket.id,
    serverTime: new Date().toISOString(),
    clientCount: io.engine.clientsCount
  });
  
  // Handle joining a rehearsal room
  socket.on('joinRehearsal', (rehearsalId) => {
    try {
      const roomName = `rehearsal_${rehearsalId}`;
      
      // Join the room
      socket.join(roomName);
      
      // Initialize event tracking for this room if needed
      if (!recentSyncEvents.has(roomName)) {
        recentSyncEvents.set(roomName, new Map());
      }
      
      // Track room members
      if (!activeRooms.has(roomName)) {
        activeRooms.set(roomName, []);
      }
      
      const roomMembers = activeRooms.get(roomName);
      if (!roomMembers.includes(socket.id)) {
        roomMembers.push(socket.id);
      }
      
      // Confirm room joining
      socket.emit('rehearsalJoined', { 
        rehearsalId, 
        room: roomName,
        members: roomMembers.length
      });
      
      console.log(`User ${socket.id} joined rehearsal: ${rehearsalId} (Total: ${roomMembers.length})`);
    } catch (error) {
      console.error('Error joining rehearsal:', error);
      socket.emit('error', { message: 'Failed to join rehearsal', details: error.message });
    }
  });
  
  // Handle admin selecting a song - using GLOBAL broadcasting
  socket.on('selectSong', ({ rehearsalId, songId }) => {
    try {
      console.log(`Admin selected song ${songId} for rehearsal ${rehearsalId}`);
      
      // Broadcast to ALL connected sockets
      io.emit('songSelected', { songId });
      console.log(`Broadcasted songSelected event with songId: ${songId} to ${io.engine.clientsCount} clients`);
      
      // Confirm selection to admin
      socket.emit('songSelectionConfirmed');
    } catch (error) {
      console.error('Error in selectSong handler:', error);
      socket.emit('error', { message: 'Failed to select song', details: error.message });
    }
  });
  
  // Handle admin toggling auto-scroll - using GLOBAL broadcasting
  socket.on('toggleAutoScroll', ({ rehearsalId, isEnabled }) => {
    try {
      console.log(`Admin toggling auto-scroll: ${isEnabled}`);
      
      // Broadcast to ALL connected sockets
      io.emit('autoScrollToggled', { isEnabled });
      
      // Confirm toggle to admin
      socket.emit('autoScrollToggleConfirmed');
    } catch (error) {
      console.error('Error in toggleAutoScroll handler:', error);
      socket.emit('error', { message: 'Failed to toggle auto-scroll', details: error.message });
    }
  });

  // Handle admin updating auto-scroll speed - using GLOBAL broadcasting
  socket.on('updateAutoScrollSpeed', ({ rehearsalId, speedSeconds }) => {
    try {
      console.log(`Admin updating auto-scroll speed: ${speedSeconds}s`);
      
      // Broadcast to ALL connected sockets
      io.emit('autoScrollSpeedUpdated', { speedSeconds });
      
      // Confirm update to admin
      socket.emit('autoScrollSpeedConfirmed');
    } catch (error) {
      console.error('Error in updateAutoScrollSpeed handler:', error);
      socket.emit('error', { message: 'Failed to update auto-scroll speed', details: error.message });
    }
  });

  // Handle line position sync with reliable delivery and deduplication
  socket.on('syncLine', (data, callback) => {
    try {
      // Handle the case where data is sent in the old format (without ID)
      if (!data.id) {
        const { rehearsalId, lineIndex } = data;
        // Add missing fields for compatibility
        data.id = `line_sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        data.timestamp = Date.now();
        console.log(`Adding missing ID to line sync event: ${data.id}`);
      }
      
      const { rehearsalId, lineIndex, id, isBackup } = data;
      const roomName = `rehearsal_${rehearsalId}`;
      
      // Initialize event tracking for this room if needed
      if (!recentSyncEvents.has(roomName)) {
        recentSyncEvents.set(roomName, new Map());
      }
      
      const roomEvents = recentSyncEvents.get(roomName);
      
      // Handle backup event - if we've already processed the original, just acknowledge
      if (isBackup && id && id.endsWith('_backup')) {
        const originalId = id.replace('_backup', '');
        if (roomEvents.has(originalId)) {
          if (typeof callback === 'function') {
            callback({ 
              success: true, 
              message: 'Original already processed',
              syncId: id,
              status: 'duplicate_backup'
            });
          }
          return;
        }
      }
      
      // Check if we've already processed this exact event
      if (id && roomEvents.has(id)) {
        if (typeof callback === 'function') {
          callback({ 
            success: true, 
            message: 'Already processed this event',
            syncId: id,
            status: 'duplicate'
          });
        }
        return;
      }
      
      // Log the event
      console.log(`Admin syncing to line ${lineIndex} [ID: ${id}]${isBackup ? ' (backup)' : ''}`);
      
      // Store the event in our tracking Map
      if (id) {
        roomEvents.set(id, {
          type: 'line',
          lineIndex,
          timestamp: Date.now(),
          processed: true
        });
        
        // Clean up old events periodically 
        cleanupOldEvents(roomName);
      }
      
      // Broadcast to ALL connected sockets with the FULL data
      io.emit('lineUpdated', data);
      
      // Send acknowledgment back if callback exists
      if (typeof callback === 'function') {
        callback({ 
          success: true, 
          message: 'Line sync broadcasted',
          syncId: id,
          status: 'broadcasted'
        });
      }
    } catch (error) {
      console.error('Error in syncLine handler:', error);
      
      if (typeof callback === 'function') {
        callback({ success: false, error: error.message });
      } else {
        socket.emit('error', { message: 'Failed to sync line', details: error.message });
      }
    }
  });
  
  // Handle word position sync with reliable delivery and deduplication
  socket.on('syncWord', (data, callback) => {
    try {
      // Handle the case where data is sent in the old format (without ID)
      if (!data.id) {
        const { rehearsalId, lineIndex, wordIndex } = data;
        // Add missing fields for compatibility
        data.id = `word_sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        data.timestamp = Date.now();
        console.log(`Adding missing ID to word sync event: ${data.id}`);
      }
      
      const { rehearsalId, lineIndex, wordIndex, id, isBackup } = data;
      const roomName = `rehearsal_${rehearsalId}`;
      
      // Initialize event tracking for this room if needed
      if (!recentSyncEvents.has(roomName)) {
        recentSyncEvents.set(roomName, new Map());
      }
      
      const roomEvents = recentSyncEvents.get(roomName);
      
      // Handle backup event - if we've already processed the original, just acknowledge
      if (isBackup && id && id.endsWith('_backup')) {
        const originalId = id.replace('_backup', '');
        if (roomEvents.has(originalId)) {
          if (typeof callback === 'function') {
            callback({ 
              success: true, 
              message: 'Original already processed',
              syncId: id,
              status: 'duplicate_backup'
            });
          }
          return;
        }
      }
      
      // Check if we've already processed this exact event
      if (id && roomEvents.has(id)) {
        if (typeof callback === 'function') {
          callback({ 
            success: true, 
            message: 'Already processed this event',
            syncId: id,
            status: 'duplicate'
          });
        }
        return;
      }
      
      // Log the event
      console.log(`Admin syncing to word ${wordIndex} in line ${lineIndex} [ID: ${id}]${isBackup ? ' (backup)' : ''}`);
      
      // Store the event in our tracking Map
      if (id) {
        roomEvents.set(id, {
          type: 'word',
          lineIndex,
          wordIndex,
          timestamp: Date.now(),
          processed: true
        });
        
        // Clean up old events periodically
        cleanupOldEvents(roomName);
      }
      
      // Broadcast to ALL connected sockets with the FULL data
      io.emit('wordUpdated', data);
      
      // Send acknowledgment back if callback exists
      if (typeof callback === 'function') {
        callback({ 
          success: true, 
          message: 'Word sync broadcasted',
          syncId: id,
          status: 'broadcasted'
        });
      }
    } catch (error) {
      console.error('Error in syncWord handler:', error);
      
      if (typeof callback === 'function') {
        callback({ success: false, error: error.message });
      } else {
        socket.emit('error', { message: 'Failed to sync word', details: error.message });
      }
    }
  });
  
  // Handle admin ending the rehearsal - using GLOBAL broadcasting
  socket.on('endRehearsal', (rehearsalId) => {
    try {
      const roomName = `rehearsal_${rehearsalId}`;
      console.log(`Admin ending rehearsal ${rehearsalId}`);
      
      // Broadcast to ALL connected sockets
      io.emit('rehearsalEnded');
      
      // Clear room tracking
      activeRooms.delete(roomName);
      recentSyncEvents.delete(roomName);
    } catch (error) {
      console.error('Error in endRehearsal handler:', error);
      socket.emit('error', { message: 'Failed to end rehearsal', details: error.message });
    }
  });
  
  // Ping endpoint to check connection health
  socket.on('ping', (data, callback) => {
    if (typeof callback === 'function') {
      callback({
        success: true,
        timestamp: Date.now(),
        socketId: socket.id,
        clientCount: io.engine.clientsCount,
        roomsJoined: Array.from(socket.rooms)
      });
    } else {
      socket.emit('pong', {
        timestamp: Date.now(),
        socketId: socket.id
      });
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Remove from all tracked rooms
    activeRooms.forEach((users, room) => {
      const index = users.indexOf(socket.id);
      if (index !== -1) {
        users.splice(index, 1);
        console.log(`Removed ${socket.id} from room ${room}, ${users.length} users remaining`);
      }
    });
  });
});

// Start server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  console.log('Using GLOBAL broadcast strategy with improved sync reliability');
});

// Error handling
process.on('unhandledRejection', (err) => {
  console.log(`Error: ${err.message}`);
  httpServer.close(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
  console.log(`UNCAUGHT EXCEPTION: ${err.message}`);
  httpServer.close(() => process.exit(1));
});