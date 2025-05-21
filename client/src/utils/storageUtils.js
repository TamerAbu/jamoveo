// Create this file: src/utils/storageUtils.js

// This is a simple shared state mechanism for socket fallback
export const storeCurrentSong = (songId) => {
  try {
    localStorage.setItem('current_song_id', songId);
    localStorage.setItem('current_song_timestamp', Date.now().toString());
    console.log(`Stored current song in localStorage: ${songId}`);
    return true;
  } catch (error) {
    console.error('Error storing song in localStorage:', error);
    return false;
  }
};

export const getCurrentSong = () => {
  try {
    const songId = localStorage.getItem('current_song_id');
    const timestamp = parseInt(localStorage.getItem('current_song_timestamp') || '0');
    
    // Only return the song if it was set within the last 5 minutes
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    
    if (songId && timestamp > fiveMinutesAgo) {
      console.log(`Retrieved current song from localStorage: ${songId}`);
      return songId;
    }
    
    return null;
  } catch (error) {
    console.error('Error retrieving song from localStorage:', error);
    return null;
  }
};

export const clearCurrentSong = () => {
  try {
    localStorage.removeItem('current_song_id');
    localStorage.removeItem('current_song_timestamp');
    console.log('Cleared current song from localStorage');
    return true;
  } catch (error) {
    console.error('Error clearing song from localStorage:', error);
    return false;
  }
};

