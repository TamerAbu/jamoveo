const songService = require('../services/songService');

// @desc    Search songs
// @route   GET /api/songs/search
// @access  Private
exports.searchSongs = async (req, res) => {
  try {
    const { query } = req.query;
    const songs = await songService.searchSongs(query);
    
    res.status(200).json({
      success: true,
      count: songs.length,
      data: songs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// @desc    Get song by ID
// @route   GET /api/songs/:id
// @access  Private
exports.getSong = async (req, res) => {
  try {
    const song = await songService.getSongById(req.params.id);
    
    if (!song) {
      return res.status(404).json({
        success: false,
        error: 'Song not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: song
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// @desc    Get all songs
// @route   GET /api/songs
// @access  Private
exports.getAllSongs = async (req, res) => {
  try {
    const songs = await songService.getSongsList();
    
    res.status(200).json({
      success: true,
      count: songs.length,
      data: songs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};