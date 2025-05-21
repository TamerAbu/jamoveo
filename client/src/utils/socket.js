// socket.js - Fixed with CORRECT backend URL
import { io } from 'socket.io-client';

let socket;
let connectionAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

// Updated initSocket function with correct backend URL
export const initSocket = () => {
  const token = localStorage.getItem('token');
  
  if (!token) {
    console.error('No token found for socket connection');
    return null;
  }
  
  // If we already have a connected socket, return it
  if (socket && socket.connected) {
    console.log('Reusing existing socket connection:', socket.id);
    return socket;
  }
  
  // Close any existing socket before creating a new one
  if (socket) {
    console.log('Closing existing socket before reconnect');
    socket.disconnect();
    socket = null;
  }
  
  // CORRECTED: Use the actual backend URL
  let socketUrl;
  if (process.env.NODE_ENV === 'production') {
    socketUrl = 'https://jamoveo-backend-t3oa.onrender.com';
  } else {
    socketUrl = 'http://localhost:5000';
  }
  
  console.log(`Connecting to socket server at: ${socketUrl}`);
  connectionAttempts++;
  
  // Socket options with simplified configuration
  const socketOptions = {
    auth: { token },
    // Try polling first, then websocket - more reliable initial connection
    transports: ['polling', 'websocket'],
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    // CRITICAL: No credentials to avoid CORS issues
    withCredentials: false,
    // Include token in multiple ways for compatibility
    query: { token }
  };
  
  // Initialize socket with improved options
  socket = io(socketUrl, socketOptions);
  
  // Connection event handlers
  socket.on('connect', () => {
    console.log('Socket connected successfully with ID:', socket.id);
    connectionAttempts = 0; // Reset counter on successful connect
    
    // Automatically join current rehearsal
    joinRehearsal('current-rehearsal');
  });
  
  socket.on('connect_error', (error) => {
    console.error(`Socket connection error (attempt ${connectionAttempts}/${MAX_RECONNECT_ATTEMPTS}):`, error.message);
    
    // If we've failed too many times, try a more aggressive approach
    if (connectionAttempts >= 3 && connectionAttempts < 6) {
      console.log('Several connection failures, trying polling transport only...');
      socket.io.opts.transports = ['polling'];
    }
  });
  
  socket.on('disconnect', (reason) => {
    console.warn('Socket disconnected:', reason);
  });
  
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
  
  // Add a debug event listener for troubleshooting
  socket.onAny((event, ...args) => {
    console.log(`[Socket Debug] Event: ${event}`, args);
  });
  
  return socket;
};

// The rest of your socket.js file remains the same...
export const getSocket = () => {
  if (!socket) {
    return initSocket();
  }
  
  if (!socket.connected) {
    console.log('Socket exists but not connected. Reconnecting...');
    socket.connect();
  }
  
  return socket;
};

export const closeSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    connectionAttempts = 0;
  }
};

// Helper function to join a rehearsal with confirmation
export const joinRehearsal = (rehearsalId) => {
  const s = getSocket();
  if (!s) {
    console.error('Cannot join rehearsal - no socket connection');
    return false;
  }
  
  console.log(`Attempting to join rehearsal: ${rehearsalId}`);
  s.emit('joinRehearsal', rehearsalId);
  
  // Request confirmation with timeout
  const joinTimeout = setTimeout(() => {
    console.warn('No confirmation of rehearsal join received. Retrying...');
    s.emit('joinRehearsal', rehearsalId); // Retry once
  }, 2000);
  
  s.once('rehearsalJoined', (data) => {
    clearTimeout(joinTimeout);
    console.log('Successfully joined rehearsal:', data);
  });
  
  return true;
};

// Helper function for admin to select a song
export const selectSong = (rehearsalId, songId) => {
  const s = getSocket();
  if (!s) {
    console.error('Cannot select song - no socket connection');
    return false;
  }
  
  console.log(`Selecting song ${songId} for rehearsal ${rehearsalId}`);
  s.emit('selectSong', { rehearsalId, songId });
  
  // Always store in localStorage as ultimate fallback
  try {
    localStorage.setItem('current_song_id', songId);
    localStorage.setItem('current_song_timestamp', Date.now().toString());
  } catch (e) {
    console.error('Failed to store song in localStorage:', e);
  }
  
  return true;
};

// Control auto scrolling for all users
export const toggleGlobalAutoScroll = (rehearsalId, isEnabled) => {
  const s = getSocket();
  if (!s) {
    console.error('Cannot toggle auto-scroll - no socket connection');
    return false;
  }
  
  s.emit('toggleAutoScroll', { rehearsalId, isEnabled });
  return true;
};

// Update auto-scroll speed for all users
export const updateAutoScrollSpeed = (rehearsalId, speedSeconds) => {
  const s = getSocket();
  if (!s) {
    console.error('Cannot update auto-scroll speed - no socket connection');
    return false;
  }
  
  s.emit('updateAutoScrollSpeed', { rehearsalId, speedSeconds });
  return true;
};

// Send line position updates to all users with unique IDs
export const syncLinePosition = (rehearsalId, lineIndex) => {
  const s = getSocket();
  if (!s) {
    console.error('Cannot sync line - no socket connection');
    return false;
  }
  
  // Use a more explicit event format with a unique ID
  const eventData = { 
    rehearsalId, 
    lineIndex,
    timestamp: Date.now(),
    id: `line_sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };
  
  // Emit the event with acknowledgment
  s.emit('syncLine', eventData);
  
  // Emit a backup event after a short delay to ensure delivery
  setTimeout(() => {
    if (s.connected) {
      s.emit('syncLine', {
        ...eventData,
        id: `${eventData.id}_backup`,
        isBackup: true
      });
    }
  }, 100);
  
  return true;
};

// Send word position updates to all users with unique IDs
export const syncWordPosition = (rehearsalId, lineIndex, wordIndex) => {
  const s = getSocket();
  if (!s) {
    console.error('Cannot sync word - no socket connection');
    return false;
  }
  
  // Use a more explicit event format with a unique ID
  const eventData = { 
    rehearsalId, 
    lineIndex, 
    wordIndex,
    timestamp: Date.now(),
    id: `word_sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };
  
  // Emit the event
  s.emit('syncWord', eventData);
  
  // Emit a backup event after a short delay to ensure delivery
  setTimeout(() => {
    if (s.connected) {
      s.emit('syncWord', {
        ...eventData,
        id: `${eventData.id}_backup`,
        isBackup: true
      });
    }
  }, 100);
  
  return true;
};

// Helper function for admin to end rehearsal
export const endRehearsal = (rehearsalId) => {
  const s = getSocket();
  if (!s) {
    console.error('Cannot end rehearsal - no socket connection');
    return false;
  }
  
  s.emit('endRehearsal', rehearsalId);
  return true;
};

export const debugEmitSelectSong = (songId) => {
  const s = getSocket();
  if (s) {
    s.emit('selectSong', { rehearsalId: 'current-rehearsal', songId });
    return true;
  } else {
    console.error('Socket not initialized');
    return false;
  }
};

// Function to check connection status for debugging
export const checkSocketConnection = () => {
  const s = getSocket();
  
  if (!s) {
    return {
      connected: false,
      status: 'No socket instance available'
    };
  }
  
  return {
    connected: s.connected,
    id: s.id || 'not_connected',
    transport: s.io?.engine?.transport?.name || 'unknown',
    status: s.connected ? 'connected' : 'disconnected',
    attempts: connectionAttempts
  };
};


const socketUtils = {
  initSocket,
  getSocket,
  closeSocket,
  joinRehearsal,
  selectSong,
  toggleGlobalAutoScroll,
  updateAutoScrollSpeed,
  syncLinePosition,
  syncWordPosition,
  endRehearsal,
  checkSocketConnection, 
  debugEmitSelectSong
};

export default socketUtils;