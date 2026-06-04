const RoadmapState = require('../models/RoadmapState');

const ROADMAP_KEY = 'method-standardization-roadmap';

const getRoadmap = async (req, res) => {
  try {
    const roadmap = await RoadmapState.findOne({ key: ROADMAP_KEY });
    res.json({ rows: roadmap?.rows || [] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const saveRoadmap = async (req, res) => {
  try {
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    const roadmap = await RoadmapState.findOneAndUpdate(
      { key: ROADMAP_KEY },
      {
        key: ROADMAP_KEY,
        rows,
        updatedBy: req.user?._id || req.user?.email || 'system',
      },
      { upsert: true, new: true, runValidators: true }
    );

    res.json({ rows: roadmap.rows });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = { getRoadmap, saveRoadmap };
