const fs = require('fs').promises;
const path = require('path');

// Get all song files from the songs directory
const getSongsList = async () => {
  try {
    const songsDir = path.join(__dirname, '..', 'songs');
    const files = await fs.readdir(songsDir);
    
    const songsList = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const songName = file.replace('.json', '');
        // Format the songName to be more readable (replace underscores with spaces, capitalize)
        const formattedName = songName
          .replace(/_/g, ' ')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
          
        songsList.push({
          id: songName,
          title: formattedName,
          // Determine language based on file name or content
          language: songName.includes('hey_jude') ? 'english' : 'hebrew'
        });
      }
    }
    
    return songsList;
  } catch (error) {
    console.error('Error getting songs list:', error);
    return [];
  }
};

// Get a specific song by ID
const getSongById = async (songId) => {
  try {
    const songPath = path.join(__dirname, '..', 'songs', `${songId}.json`);
    const songData = await fs.readFile(songPath, 'utf8');
    
    return {
      id: songId,
      title: songId
        .replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
      // For demo purposes - in real app, you'd have more metadata
      artist: songId.includes('hey_jude') ? 'The Beatles' : 'Idan Raichel',
      language: songId.includes('hey_jude') ? 'english' : 'hebrew',
      content: JSON.parse(songData)
    };
  } catch (error) {
    console.error(`Error getting song ${songId}:`, error);
    return null;
  }
};

// Search songs by query
const searchSongs = async (query) => {
  try {
    const songs = await getSongsList();
    
    if (!query) {
      return songs;
    }
    
    // Simple case-insensitive search on title
    return songs.filter(song => 
      song.title.toLowerCase().includes(query.toLowerCase())
    );
  } catch (error) {
    console.error('Error searching songs:', error);
    return [];
  }
};

module.exports = {
  getSongsList,
  getSongById,
  searchSongs
};