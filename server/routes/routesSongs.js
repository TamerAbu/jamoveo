const express = require('express');
const { searchSongs, getSong, getAllSongs } = require('../controllers/controllerSongs');
const { protect } = require('../middleware/middlewareAuth');

const router = express.Router();

// Protect all routes
router.use(protect);

router.get('/search', searchSongs);
router.get('/:id', getSong);
router.get('/', getAllSongs);

module.exports = router;