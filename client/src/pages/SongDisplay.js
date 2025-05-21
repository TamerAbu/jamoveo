import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  getSocket, 
  endRehearsal, 
  toggleGlobalAutoScroll, 
  updateAutoScrollSpeed,
  syncLinePosition,
  syncWordPosition
} from '../utils/socket';
import api from '../utils/api';

const SongDisplay = () => {
  const { songId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeLineIndex, setActiveLineIndex] = useState(0);
  const [activeWordIndex, setActiveWordIndex] = useState(0); 
  const [autoScrollSpeed, setAutoScrollSpeed] = useState(3); // seconds per line
  // eslint-disable-next-line no-unused-vars
  const [lastEvent, setLastEvent] = useState(null);
  
  const contentRef = useRef(null);
  const lineRefs = useRef([]);
  const autoScrollTimerRef = useRef(null);
  
  // Check if user is a singer
  const isSinger = currentUser?.instrument === 'vocals';
  
  // Set admin status and fetch song
  useEffect(() => {
    // Determine if user is admin
    const userIsAdmin = currentUser && currentUser.name && 
                        currentUser.name.toLowerCase().includes('admin');
    setIsAdmin(userIsAdmin);
    
    // Reset line refs when song changes
    lineRefs.current = [];
    
    // Fetch song data
    const fetchSong = async () => {
      try {
        const response = await api.get(`/songs/${songId}`);
        const songData = response.data.data;
        setSong(songData);
      } catch (err) {
        console.error('Error fetching song:', err);
        setError('Failed to load song');
      } finally {
        setLoading(false);
      }
    };
    
    fetchSong();
  }, [songId, currentUser]);
  
  // Socket connection and event handling
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    
    // Create a map to track received events to prevent duplicates
    const receivedEvents = new Map();
    
    // Handle rehearsal ended event
    socket.on('rehearsalEnded', () => {
      navigate('/dashboard');
    });
    
    // Handle auto-scroll toggle events (from admin)
    socket.on('autoScrollToggled', ({ isEnabled }) => {
      setIsAutoScrolling(isEnabled);
      
      // Reset active line and word when toggling on
      if (isEnabled) {
        setActiveLineIndex(0);
        setActiveWordIndex(0);
        // Also scroll to top for users
        if (!isAdmin && contentRef.current) {
          contentRef.current.scrollTop = 0;
        }
      }
    });
    
    // Handle auto-scroll speed updates from admin
    socket.on('autoScrollSpeedUpdated', ({ speedSeconds }) => {
      setAutoScrollSpeed(speedSeconds);
    });
    
    // Listen for line updates from admin with duplicate prevention
    socket.on('lineUpdated', (data) => {
      const { lineIndex, id, isBackup } = data;
      
      // Prevent duplicate events
      if ((isBackup && id && id.endsWith('_backup') && receivedEvents.has(id.replace('_backup', ''))) ||
          (id && receivedEvents.has(id))) {
        return;
      }
      
      // Store this event ID to prevent duplicates
      if (id) {
        receivedEvents.set(id, Date.now());
        
        // Clean up old event IDs (keep only last 20)
        if (receivedEvents.size > 20) {
          const oldestKey = Array.from(receivedEvents.keys())[0];
          receivedEvents.delete(oldestKey);
        }
      }
      
      // Verify the data is valid before updating state
      if (typeof lineIndex === 'number' && 
          song && 
          song.content && 
          lineIndex >= 0 && 
          lineIndex < song.content.length) {
        
        // Update the active line and reset word index
        setActiveLineIndex(lineIndex);
        setActiveWordIndex(0);
        
        // Scroll to the line
        if (contentRef.current && lineRefs.current[lineIndex]) {
          const containerHeight = contentRef.current.clientHeight;
          const lineTop = lineRefs.current[lineIndex].offsetTop;
          const lineHeight = lineRefs.current[lineIndex].clientHeight;
          const scrollPosition = lineTop - (containerHeight / 2) + (lineHeight / 2);
          
          contentRef.current.scrollTo({
            top: scrollPosition,
            behavior: 'smooth'
          });
        }
        
        setLastEvent({ type: 'line', lineIndex, id, timestamp: Date.now() });
      }
    });
    
    // Listen for word updates from admin with duplicate prevention
    socket.on('wordUpdated', (data) => {
      const { lineIndex, wordIndex, id, isBackup } = data;
      
      // Prevent duplicate events
      if ((isBackup && id && id.endsWith('_backup') && receivedEvents.has(id.replace('_backup', ''))) ||
          (id && receivedEvents.has(id))) {
        return;
      }
      
      // Store this event ID to prevent duplicates
      if (id) {
        receivedEvents.set(id, Date.now());
        
        // Clean up old event IDs (keep only last 20)
        if (receivedEvents.size > 20) {
          const oldestKey = Array.from(receivedEvents.keys())[0];
          receivedEvents.delete(oldestKey);
        }
      }
      
      // Verify the data is valid before updating state
      if (typeof lineIndex === 'number' && 
          typeof wordIndex === 'number' && 
          song && 
          song.content && 
          lineIndex >= 0 && 
          lineIndex < song.content.length && 
          Array.isArray(song.content[lineIndex])) {
        
        // Ensure word index is valid
        const maxWordIndex = song.content[lineIndex].length - 1;
        const safeWordIndex = Math.min(Math.max(0, wordIndex), maxWordIndex);
        
        // Update active line and word
        setActiveLineIndex(lineIndex);
        setActiveWordIndex(safeWordIndex);
        
        // Scroll to the line containing the word
        if (contentRef.current && lineRefs.current[lineIndex]) {
          const containerHeight = contentRef.current.clientHeight;
          const lineTop = lineRefs.current[lineIndex].offsetTop;
          const lineHeight = lineRefs.current[lineIndex].clientHeight;
          const scrollPosition = lineTop - (containerHeight / 2) + (lineHeight / 2);
          
          contentRef.current.scrollTo({
            top: scrollPosition,
            behavior: 'smooth'
          });
        }
        
        setLastEvent({ type: 'word', lineIndex, wordIndex: safeWordIndex, id, timestamp: Date.now() });
      }
    });
    
    return () => {
      if (socket) {
        socket.off('rehearsalEnded');
        socket.off('autoScrollToggled');
        socket.off('autoScrollSpeedUpdated');
        socket.off('lineUpdated');
        socket.off('wordUpdated');
      }
      
      // Clear all intervals and timers when component unmounts
      if (autoScrollTimerRef.current) {
        clearTimeout(autoScrollTimerRef.current);
      }
    };
  }, [navigate, isAdmin, activeLineIndex, activeWordIndex, song]);
  
  // Handle auto scrolling with word focus (ADMIN ONLY)
  useEffect(() => {
    // Clear any existing timer
    if (autoScrollTimerRef.current) {
      clearTimeout(autoScrollTimerRef.current);
      autoScrollTimerRef.current = null;
    }
    
    // Only the admin controls the auto-scroll sequence
    if (isAutoScrolling && song && song.content && isAdmin) {
      // Function to advance to next word or line
      const advanceToNextPosition = () => {
        if (!song || !song.content) return;
        
        // Validate current line index
        if (activeLineIndex < 0 || activeLineIndex >= song.content.length) return;
        
        // Get current line directly from song
        const currentLine = song.content[activeLineIndex];
        
        // Validate current line
        if (!Array.isArray(currentLine)) return;
        
        // Get word count in current line
        const wordsInCurrentLine = currentLine.length;
        
        // Check if we can move to next word in same line
        if (activeWordIndex < wordsInCurrentLine - 1) {
          // Move to next word in current line
          const nextWordIndex = activeWordIndex + 1;
          
          // Update local state first
          setActiveWordIndex(nextWordIndex);
          
          // Make sure the word index is actually updated before sending to server
          setTimeout(() => {
            // Check one more time if auto-scrolling is still enabled
            if (isAutoScrolling) {
              // Send update to server with explicit current values
              syncWordPosition('current-rehearsal', activeLineIndex, nextWordIndex);
            }
          }, 10);
        } else {
          // Check if we can move to next line
          if (activeLineIndex < song.content.length - 1) {
            const nextLineIndex = activeLineIndex + 1;
            
            // Validate next line
            if (!Array.isArray(song.content[nextLineIndex])) return;
            
            // Update local state first to make UI responsive
            setActiveLineIndex(nextLineIndex);
            setActiveWordIndex(0);
            
            // Send updates to server
            setTimeout(() => {
              // Check if auto-scrolling is still enabled
              if (isAutoScrolling) {
                syncLinePosition('current-rehearsal', nextLineIndex);
                
                // Add a short delay before word sync
                setTimeout(() => {
                  // Check again if auto-scrolling is still enabled
                  if (isAutoScrolling) {
                    syncWordPosition('current-rehearsal', nextLineIndex, 0);
                  }
                }, 100);
              }
            }, 10);
          } else {
            // End of song
            toggleGlobalAutoScroll('current-rehearsal', false);
            setIsAutoScrolling(false);
          }
        }
      };
      
      // Calculate time per word with reliable word count
      const currentLine = song.content[activeLineIndex] || [];
      const currentLineWordCount = Array.isArray(currentLine) ? currentLine.length : 1;
      
      // Calculate time per word, with a minimum to prevent too-fast scrolling
      const timePerWord = Math.max(autoScrollSpeed * 1000 / Math.max(currentLineWordCount, 1), 800);
      
      autoScrollTimerRef.current = setTimeout(advanceToNextPosition, timePerWord);
    }
    
    return () => {
      if (autoScrollTimerRef.current) {
        clearTimeout(autoScrollTimerRef.current);
      }
    };
  }, [isAutoScrolling, activeLineIndex, activeWordIndex, isAdmin, autoScrollSpeed, song]);
  
  // Manual sync function for entire line
  const manualSyncLine = (lineIdx = activeLineIndex) => {
    if (isAdmin && song) {
      // Clear any existing auto-scroll timer
      if (autoScrollTimerRef.current) {
        clearTimeout(autoScrollTimerRef.current);
        autoScrollTimerRef.current = null;
      }
      
      // Ensure lineIdx is valid
      const safeLineIdx = Math.min(Math.max(0, lineIdx), (song.content.length || 1) - 1);
      
      // Update local state first to make UI responsive
      setActiveLineIndex(safeLineIdx); 
      setActiveWordIndex(0);
      
      // Send to server
      syncLinePosition('current-rehearsal', safeLineIdx);
      
      // Scroll to the line
      if (contentRef.current && lineRefs.current[safeLineIdx]) {
        const containerHeight = contentRef.current.clientHeight;
        const lineTop = lineRefs.current[safeLineIdx].offsetTop;
        const lineHeight = lineRefs.current[safeLineIdx].clientHeight;
        const scrollPosition = lineTop - (containerHeight / 2) + (lineHeight / 2);
        
        contentRef.current.scrollTo({
          top: scrollPosition,
          behavior: 'smooth'
        });
      }
    }
  };
  
  // Manual sync function for specific word
  const manualSyncWord = (lineIdx, wordIdx) => {
    if (isAdmin && song) {
      // Clear any existing auto-scroll timer
      if (autoScrollTimerRef.current) {
        clearTimeout(autoScrollTimerRef.current);
        autoScrollTimerRef.current = null;
      }
      
      // Ensure lineIdx is valid
      const safeLineIdx = Math.min(Math.max(0, lineIdx), (song.content.length || 1) - 1);
      
      // Get the current line
      const currentLine = song.content[safeLineIdx];
      if (!Array.isArray(currentLine)) return;
      
      // Ensure wordIdx is valid
      const maxWordIdx = currentLine.length - 1;
      const safeWordIdx = Math.min(Math.max(0, wordIdx), maxWordIdx);
      
      // Update local state first to make UI responsive
      setActiveLineIndex(safeLineIdx);
      setActiveWordIndex(safeWordIdx);
      
      // Send to server
      syncWordPosition('current-rehearsal', safeLineIdx, safeWordIdx);
      
      // Scroll to the line containing the word
      if (contentRef.current && lineRefs.current[safeLineIdx]) {
        const containerHeight = contentRef.current.clientHeight;
        const lineTop = lineRefs.current[safeLineIdx].offsetTop;
        const lineHeight = lineRefs.current[safeLineIdx].clientHeight;
        const scrollPosition = lineTop - (containerHeight / 2) + (lineHeight / 2);
        
        contentRef.current.scrollTo({
          top: scrollPosition,
          behavior: 'smooth'
        });
      }
    }
  };
  
  // Toggle auto-scroll for all users (admin only)
  const toggleAutoScroll = () => {
    const newScrollState = !isAutoScrolling;
    
    // If admin, clear any existing timer first
    if (isAdmin && autoScrollTimerRef.current) {
      clearTimeout(autoScrollTimerRef.current);
      autoScrollTimerRef.current = null;
    }
    
    // Update local state first for responsive UI
    setIsAutoScrolling(newScrollState);
    
    // Reset active line and word when turning on
    if (newScrollState) {
      setActiveLineIndex(0);
      setActiveWordIndex(0);
      
      // If admin, sync line 0 and word 0 to all users and start auto-scroll
      if (isAdmin) {
        // First toggle the global auto-scroll state
        toggleGlobalAutoScroll('current-rehearsal', newScrollState);
        
        // Send initial line and word position after a short delay
        setTimeout(() => {
          // Use imported functions directly
          syncLinePosition('current-rehearsal', 0);
          
          // Add a small delay between line and word sync to avoid race conditions
          setTimeout(() => {
            syncWordPosition('current-rehearsal', 0, 0);
            
            // Scroll to top
            if (contentRef.current && lineRefs.current[0]) {
              contentRef.current.scrollTop = 0;
            }
          }, 100);
        }, 300);
      }
    } else {
      // If admin, broadcast auto-scroll off
      if (isAdmin) {
        toggleGlobalAutoScroll('current-rehearsal', newScrollState);
      }
    }
  };
  
  // Adjust scroll speed (admin only)
  const adjustScrollSpeed = (newSpeed) => {
    setAutoScrollSpeed(newSpeed);
    
    // If admin, broadcast to all users
    if (isAdmin) {
      updateAutoScrollSpeed('current-rehearsal', newSpeed);
    }
  };
  
  const handleQuit = () => {
    // End rehearsal and navigate back to dashboard
    endRehearsal('current-rehearsal');
    navigate('/dashboard');
  };
  
  // Get the current line's word count directly from song data
  const getCurrentLineWordCount = () => {
    try {
      if (!song || !song.content || !Array.isArray(song.content)) return 0;
      
      // Make sure we have a valid line index
      if (activeLineIndex < 0 || activeLineIndex >= song.content.length) return 0;
      
      // Get the current line
      const line = song.content[activeLineIndex];
      
      // Make sure the line is an array
      if (!Array.isArray(line)) return 0;
      
      // Return the word count
      return line.length;
    } catch (e) {
      return 0;
    }
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="w-16 h-16 border-t-4 border-primary-600 rounded-full animate-spin"></div>
      </div>
    );
  }
  
  if (error || !song) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-red-600 text-xl">
          {error || 'Song not found'}
        </div>
      </div>
    );
  }

  // Determine if the song is in Hebrew
  const isHebrew = song.language && song.language.toLowerCase() === 'hebrew';
  
  // Current line word count for display
  const currentLineWordCount = getCurrentLineWordCount();
  
  // Render singer view (lyrics only) or instrumentalist view (chords + lyrics)
  const renderSongContent = () => {
    if (isSinger) {
      // SINGER VIEW - LYRICS ONLY
      return (
        <div 
          ref={contentRef}
          className="text-2xl max-h-[70vh] overflow-y-auto px-4 bg-gray-900 rounded-lg p-5"
          style={{ scrollBehavior: 'smooth' }}
          dir={isHebrew ? 'rtl' : 'ltr'} 
        >
          <h3 className="text-xl mb-4 text-blue-400 font-bold">
            Singer View - Lyrics Only
          </h3>
          
          {song.content.map((line, lineIndex) => (
            <div 
              key={lineIndex} 
              ref={el => lineRefs.current[lineIndex] = el}
              className={`mb-6 p-2 transition-all duration-300 ${isHebrew ? 'border-r-4' : 'border-l-4'} ${
                isAutoScrolling && lineIndex === activeLineIndex 
                  ? `${isHebrew ? 'border-r-4 border-blue-500 pr-4' : 'border-l-4 border-blue-500 pl-4'} bg-gray-800 rounded` 
                  : 'border-transparent'
              }`}
              onClick={() => isAdmin && manualSyncLine(lineIndex)}
            >
              <div className={isHebrew ? 'text-right' : 'text-left'}>
                {line.map((part, partIndex) => (
                  <span 
                    key={partIndex} 
                    className={`inline-block mr-4 mb-2 ${
                      isAutoScrolling && lineIndex === activeLineIndex && partIndex === activeWordIndex
                      ? 'bg-blue-800 px-1 rounded text-white font-bold'
                      : isAutoScrolling && lineIndex === activeLineIndex
                        ? 'text-white'
                        : isAutoScrolling
                          ? 'text-gray-500 blur-[1px]'
                          : 'text-white'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      isAdmin && manualSyncWord(lineIndex, partIndex);
                    }}
                    data-line={lineIndex}
                    data-word={partIndex}
                  >
                    {/* For singers, only show lyrics */}
                    <div className="text-xl whitespace-normal">{part.lyrics || " "}</div>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    } else {
      // INSTRUMENTALIST VIEW - CHORDS + LYRICS
      return (
        <div 
          ref={contentRef}
          className="text-2xl max-h-[70vh] overflow-y-auto px-4 bg-gray-900 rounded-lg p-5"
          style={{ scrollBehavior: 'smooth' }}
          dir={isHebrew ? 'rtl' : 'ltr'} 
        >
          {song.content.map((line, lineIndex) => (
            <div 
              key={lineIndex} 
              ref={el => lineRefs.current[lineIndex] = el}
              className={`mb-6 p-2 transition-all duration-300 ${isHebrew ? 'border-r-4' : 'border-l-4'} ${
                isAutoScrolling && lineIndex === activeLineIndex
                  ? `${isHebrew ? 'border-r-4 border-blue-500 pr-4' : 'border-l-4 border-blue-500 pl-4'} bg-gray-800 rounded` 
                  : 'border-transparent'
              }`}
              onClick={() => isAdmin && manualSyncLine(lineIndex)}
            >
              <div className={isHebrew ? 'text-right' : 'text-left'}>
                {line.map((part, partIndex) => (
                  <span 
                    key={partIndex} 
                    className={`inline-block mr-4 mb-2 ${
                      isAutoScrolling && lineIndex === activeLineIndex && partIndex === activeWordIndex
                      ? 'bg-blue-800 px-1 rounded'
                      : ''
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      isAdmin && manualSyncWord(lineIndex, partIndex);
                    }}
                    data-line={lineIndex}
                    data-word={partIndex}
                  >
                    {/* For instrumentalists, show both chords and lyrics */}
                    {part.chords && (
                      <div className={`font-mono text-lg ${
                        isAutoScrolling && lineIndex === activeLineIndex && partIndex === activeWordIndex
                          ? 'text-blue-400 font-bold' 
                          : isAutoScrolling && lineIndex === activeLineIndex
                            ? 'text-blue-400'
                            : isAutoScrolling
                              ? 'text-blue-700'
                              : 'text-blue-400'
                      }`}>
                        {part.chords}
                      </div>
                    )}
                    <div className={`text-xl whitespace-normal ${
                      isAutoScrolling && lineIndex === activeLineIndex && partIndex === activeWordIndex
                        ? 'text-white font-bold'
                        : isAutoScrolling && lineIndex === activeLineIndex
                          ? 'text-white'
                          : isAutoScrolling
                            ? 'text-gray-500 blur-[1px]' 
                            : 'text-white'
                    }`}>
                      {part.lyrics || " "}
                    </div>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }
  };
  
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto p-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-center">{song.title}</h1>
          <p className="text-xl text-center text-gray-400">{song.artist || 'Unknown Artist'}</p>
          <p className="text-center mt-2">
            <span className="px-3 py-1 bg-blue-500 text-white rounded-full text-sm">
              {isSinger ? 'Singer View' : 'Instrumentalist View'}
            </span>
          </p>
        </div>
        
        {/* Song content with conditional rendering based on user type */}
        {renderSongContent()}
        
        <div className="fixed bottom-6 right-6 flex space-x-3">
          {/* Auto-scroll button - only admin can toggle it */}
          {isAdmin ? (
            <div className="flex flex-col space-y-3">
              {/* Main Controls - Auto-Scroll and Quit */}
              <div className="flex space-x-3">
                <button
                  onClick={toggleAutoScroll}
                  className="bg-blue-500 text-white rounded-full py-3 px-6 shadow-lg hover:bg-blue-600 transition-colors font-medium"
                >
                  {isAutoScrolling ? 'Stop Auto-Scroll (All)' : 'Start Auto-Scroll (All)'}
                </button>
                
                <button
                  onClick={handleQuit}
                  className="bg-red-500 text-white rounded-full py-3 px-6 shadow-lg hover:bg-red-600 transition-colors font-medium"
                >
                  Quit
                </button>
              </div>
              
              {/* Speed Controls */}
              {isAutoScrolling && (
                <div className="bg-gray-800 rounded-full py-2 px-4 shadow-lg flex items-center justify-between">
                  <span className="text-white font-medium">Speed:</span>
                  <div className="flex items-center space-x-3 ml-3">
                    <button 
                      onClick={() => adjustScrollSpeed(Math.max(1, autoScrollSpeed - 1))}
                      className="bg-red-500 hover:bg-red-600 text-white w-7 h-7 rounded-full flex items-center justify-center font-bold transition-colors"
                    >
                      -
                    </button>
                    <span className="font-bold text-white">{autoScrollSpeed}</span>
                    <button 
                      onClick={() => adjustScrollSpeed(Math.min(10, autoScrollSpeed + 1))}
                      className="bg-green-500 hover:bg-green-600 text-white w-7 h-7 rounded-full flex items-center justify-center font-bold transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-800 text-white rounded-full py-3 px-6 shadow-lg flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${isAutoScrolling ? 'bg-green-500' : 'bg-red-500'}`}></div>
              Auto-Scroll: {isAutoScrolling ? 'ON' : 'OFF'}
            </div>
          )}
        </div>
        
        {/* Indicator for current line and word (only for admin) */}
        {isAdmin && (
          <div className="fixed bottom-6 left-6 bg-gray-800 text-white py-2 px-4 rounded-full shadow-lg">
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <span className="text-gray-300 mr-2">Line:</span>
                <span className="font-bold">{activeLineIndex + 1}/{song.content.length}</span>
              </div>
              <div className="flex items-center">
                <span className="text-gray-300 mr-2">Word:</span>
                <span className="font-bold">{activeWordIndex + 1}/{currentLineWordCount}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SongDisplay;