const express = require('express');
const router = express.Router();
const { getRoadmap, saveRoadmap } = require('../controllers/roadmapController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getRoadmap)
  .put(saveRoadmap);

module.exports = router;
