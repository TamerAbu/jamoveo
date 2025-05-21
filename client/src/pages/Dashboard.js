import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { initSocket, getSocket, joinRehearsal, selectSong, checkSocketConnection } from '../utils/socket';
import api from '../utils/api';
import { storeCurrentSong, getCurrentSong, clearCurrentSong } from '../utils/storageUtils';

/**
 * ConnectionStatus - Shows connection information with retry button
 */
const ConnectionStatus = ({ status, onRetry }) => {
  return (
    <div className={`mb-4 p-3 rounded-md ${
      status.connected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className={`w-3 h-3 rounded-full mr-2 ${status.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="font-medium">
            {status.connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        {!status.connected && (
          <button 
            onClick={onRetry}
            className="bg-red-700 text-white px-2 py-1 text-sm rounded hover:bg-red-800"
          >
            Retry Connection
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * PlayerWaiting - Implements reliable connection for waiting room
 */
const PlayerWaiting = () => {
  const navigate = useNavigate();
  const [waitingStatus, setWaitingStatus] = useState('Initializing connection...');
  const [connected, setConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [connectionDetails, setConnectionDetails] = useState({
    connected: false,
    status: 'initializing',
  });

  const socketRef = useRef(null);
  const songSelectedAttached = useRef(false);
  const maxRetries = 15;
  const retryDelayMs = 1000;

  // Update connection status display
  const updateConnectionStatus = () => {
    const status = checkSocketConnection();
    setConnectionDetails(status);
    setConnected(status.connected);
  };

  useEffect(() => {
    let timeoutId;
    let checkIntervalId;
    let mounted = true;

    const setupSocketListeners = (socket) => {
      if (!socket) return;

      socket.on('connect', () => {
        if (!mounted) return;
        console.log('Socket connected successfully in waiting room');
        setConnected(true);
        setWaitingStatus('Connected! Waiting for song selection...');
        setRetryCount(0);
        setErrorMessage('');
        updateConnectionStatus();
        joinRehearsal('current-rehearsal');
      });

      socket.on('disconnect', (reason) => {
        if (!mounted) return;
        console.log('Socket disconnected in waiting room:', reason);
        setConnected(false);
        setWaitingStatus('Connection lost - reconnecting...');
        updateConnectionStatus();
        if (retryCount < maxRetries) {
          setRetryCount((prev) => prev + 1);
          timeoutId = setTimeout(attemptConnection, retryDelayMs);
        } else {
          setErrorMessage('Could not connect. Please refresh and try again.');
        }
      });

      socket.on('connect_error', (error) => {
        if (!mounted) return;
        console.error('Socket connect error:', error);
        setWaitingStatus(`Connection error: ${error.message}`);
        updateConnectionStatus();
        if (retryCount < maxRetries) {
          setRetryCount((prev) => prev + 1);
          timeoutId = setTimeout(attemptConnection, retryDelayMs);
        } else {
          setErrorMessage('Unable to connect to the rehearsal server.');
        }
      });

      socket.on('error', (error) => {
        console.error('Socket error:', error);
        setErrorMessage(`Socket error: ${error.message}`);
        updateConnectionStatus();
      });

      // Attach songSelected only once
      if (!songSelectedAttached.current) {
        socket.on('songSelected', (payload) => {
          console.log('Song selected event received:', payload);
          if (payload?.songId) {
            setWaitingStatus('Song selected! Loading…');
            navigate(`/song/${payload.songId}`);
          }
        });
        songSelectedAttached.current = true;
      }
    };

    const attemptConnection = async () => {
      if (!mounted) return;

      setWaitingStatus('Connecting to rehearsal server...');
      console.log(`Connection attempt ${retryCount + 1}/${maxRetries}`);

      try {
        const socket = getSocket();
        socketRef.current = socket;

        if (!socket) throw new Error('Socket is undefined');

        setupSocketListeners(socket);

        if (socket.connected) {
          setWaitingStatus('Connected! Waiting for song selection...');
          joinRehearsal('current-rehearsal');
        } else {
          socket.connect();
        }

        updateConnectionStatus();
      } catch (err) {
        console.error('Error during connection attempt:', err);
        setWaitingStatus(`Connection error: ${err.message}`);
        setErrorMessage(err.message);
        updateConnectionStatus();

        if (mounted && retryCount < maxRetries) {
          setRetryCount((prev) => prev + 1);
          timeoutId = setTimeout(attemptConnection, retryDelayMs);
        }
      }
    };

    attemptConnection(); // Start connection process

    // Check localStorage fallback every 2 seconds
    checkIntervalId = setInterval(() => {
      if (!mounted) return;
      const currentSong = getCurrentSong();
      if (currentSong) {
        console.log('Found song in localStorage:', currentSong);
        navigate(`/song/${currentSong}`);
      }
    }, 2000);

    // Update status display periodically
    const statusIntervalId = setInterval(() => {
      if (mounted) updateConnectionStatus();
    }, 5000);

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      clearInterval(checkIntervalId);
      clearInterval(statusIntervalId);
    };
  }, [navigate, retryCount]);

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <h1 className="text-3xl font-bold mb-4">{waitingStatus}</h1>

      <div className="w-full max-w-md mb-6">
        <ConnectionStatus
          status={connectionDetails}
          onRetry={() => {
            setRetryCount(0);
            const socket = getSocket();
            if (socket) {
              socket.disconnect();
              setTimeout(() => socket.connect(), 500);
            } else {
              initSocket();
            }
          }}
        />
      </div>

      {connected ? (
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-t-4 border-primary-600 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">The admin will select a song soon…</p>
          <div className="mt-4 flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            <p className="text-green-600">Connected to rehearsal</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-t-4 border-amber-600 rounded-full animate-spin mb-4"></div>
          <p className="text-amber-600">Establishing connection…</p>
          {retryCount > 0 && (
            <p className="mt-4 text-amber-600">
              Connection attempts: {retryCount}/{maxRetries}
            </p>
          )}
        </div>
      )}

      {errorMessage && (
        <div className="mt-6 p-4 bg-red-50 border border-red-300 rounded-md">
          <p className="text-red-700">{errorMessage}</p>
          <div className="mt-4 flex space-x-3">
            <button
              className="bg-primary-600 text-white px-4 py-2 rounded-md"
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </button>
            <button
              className="bg-gray-600 text-white px-4 py-2 rounded-md"
              onClick={() => {
                setRetryCount(0);
                setErrorMessage('');
                const socket = getSocket();
                if (socket) socket.disconnect();
                setTimeout(() => {
                  initSocket();
                }, 500);
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * AdminSearch - Implements song search and selection with reliable delivery
 */
const AdminSearch = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectionStatus, setSelectionStatus] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('initializing');
  const [connectionDetails, setConnectionDetails] = useState({
    connected: false,
    status: 'initializing'
  });
  
  const navigate = useNavigate();
  
  useEffect(() => {
    // Ensure socket connection
    const ensureConnection = () => {
      try {
        const socket = getSocket();
        if (!socket) {
          setConnectionStatus('error');
          setConnectionDetails({
            connected: false,
            status: 'No socket connection'
          });
          return;
        }
        
        // Connection status indicators
        const onConnect = () => {
          setConnectionStatus('connected');
          updateConnectionStatus();
          joinRehearsal('current-rehearsal');
        };
        
        const onDisconnect = () => {
          setConnectionStatus('disconnected');
          updateConnectionStatus();
        };
        
        // Remove any existing listeners
        socket.off('connect', onConnect);
        socket.off('disconnect', onDisconnect);
        
        // Add listeners
        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        
        // Update current status
        if (socket.connected) {
          setConnectionStatus('connected');
          joinRehearsal('current-rehearsal');
        } else {
          setConnectionStatus('connecting');
          socket.connect();
        }
        
        updateConnectionStatus();
        
        return () => {
          if (socket) {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
          }
        };
      } catch (err) {
        console.error('Error ensuring socket connection:', err);
        setConnectionStatus('error');
        setConnectionDetails({
          connected: false,
          status: err.message
        });
      }
    };
    
    const updateConnectionStatus = () => {
      const status = checkSocketConnection();
      setConnectionDetails(status);
    };
    
    // Initial connection
    ensureConnection();
    
    // Poll connection status
    const statusIntervalId = setInterval(() => {
      updateConnectionStatus();
    }, 5000);
    
    return () => {
      clearInterval(statusIntervalId);
    };
  }, []);
  
  // Handle song search
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await api.get(`/songs/search?query=${searchQuery}`);
      setSearchResults(response.data.data);
    } catch (error) {
      console.error('Error searching songs:', error);
      alert('Failed to search songs. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };
  
  // Handle song selection with fallback
  const handleSelectSong = (songId) => {
    const rehearsalId = 'current-rehearsal';
    setSelectionStatus(`Selecting song ${songId}...`);
    
    // Store in localStorage as fallback
    storeCurrentSong(songId);
    
    // Get current socket state
    const socket = getSocket();
    
    if (!socket || !socket.connected) {
      setSelectionStatus('Socket not available - using fallback navigation');
      setTimeout(() => navigate(`/song/${songId}`), 500);
      return;
    }
    
    // Socket is connected, send selection
    selectSong(rehearsalId, songId);
    setSelectionStatus('Song selection sent, navigating...');
    
    // Navigate admin after selection
    setTimeout(() => navigate(`/song/${songId}`), 300);
    
    // Send a backup selection after a short delay
    setTimeout(() => {
      try {
        const currentSocket = getSocket();
        if (currentSocket && currentSocket.connected) {
          selectSong(rehearsalId, songId);
        }
      } catch (err) {
        console.error('Error sending backup selection:', err);
      }
    }, 500);
  };
  
  return (
    <div className="p-8 max-w-xl mx-auto">
      <h1 className="text-3xl font-bold mb-4 text-center">Search any song...</h1>
      
      {/* Enhanced connection status indicator */}
      <div className="mb-4">
        <ConnectionStatus 
          status={connectionDetails} 
          onRetry={() => {
            setConnectionStatus('connecting');
            const socket = getSocket();
            if (socket) {
              socket.disconnect();
              setTimeout(() => socket.connect(), 500);
            } else {
              initSocket();
            }
          }}
        />
      </div>
      
      <form onSubmit={handleSearch}>
        <div className="flex shadow-sm rounded-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 min-w-0 block w-full px-4 py-3 rounded-none rounded-l-md border-gray-300 focus:ring-primary-500 focus:border-primary-500 text-lg"
            placeholder="Enter song title or artist..."
          />
          <button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className={`inline-flex items-center px-6 border border-l-0 border-gray-300 bg-primary-600 text-white text-lg font-medium rounded-r-md hover:bg-primary-700 focus:outline-none ${
              isSearching || !searchQuery.trim() ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>
      
      {selectionStatus && (
        <div className="mt-4 p-2 bg-blue-100 text-blue-800 rounded">
          {selectionStatus}
        </div>
      )}
      
      {searchResults.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Search Results</h2>
          <div className="space-y-4">
            {searchResults.map((song) => (
              <div 
                key={song.id}
                className="p-4 border rounded-md shadow-sm hover:shadow-md cursor-pointer"
                onClick={() => handleSelectSong(song.id)}
              >
                <h3 className="text-lg font-medium">{song.title}</h3>
                <p className="text-sm text-gray-500">Language: {song.language}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Main Dashboard component
const Dashboard = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  
  useEffect(() => {
    // Initialize socket connection
    initSocket();
    
    // Determine user role
    if (currentUser?.role === 'admin') {
      setIsAdmin(true);
    }
    
    return () => {
      clearCurrentSong();
    };
  }, [currentUser]);
  
  const handleLogout = () => {
    clearCurrentSong();
    logout();
    navigate('/login');
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-primary-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="text-white font-bold text-xl">JaMoveo</div>
            </div>
            <div className="flex items-center">
              <span className="text-white mr-4">
                {currentUser?.name} - {currentUser?.instrument}
              </span>
              <button
                onClick={handleLogout}
                className="bg-primary-800 text-white px-3 py-1 rounded-md text-sm font-medium hover:bg-primary-900"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {isAdmin ? <AdminSearch /> : <PlayerWaiting />}
      </main>
    </div>
  );
};

export default Dashboard;