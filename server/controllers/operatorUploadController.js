const OperatorUpload = require('../models/OperatorUpload');

const listUploads = async (req, res) => {
  try {
    const uploads = await OperatorUpload.find().sort({ importedAt: -1, createdAt: -1 });
    res.json(uploads);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createUpload = async (req, res) => {
  try {
    const upload = await OperatorUpload.create({
      ...req.body,
      createdBy: req.user?._id || req.user?.email || 'system',
    });
    res.status(201).json(upload);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updateUpload = async (req, res) => {
  try {
    const upload = await OperatorUpload.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!upload) return res.status(404).json({ message: 'Upload not found' });
    res.json(upload);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteUpload = async (req, res) => {
  try {
    const upload = await OperatorUpload.findByIdAndDelete(req.params.id);
    if (!upload) return res.status(404).json({ message: 'Upload not found' });
    res.json({ message: 'Upload deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const clearUploads = async (req, res) => {
  try {
    await OperatorUpload.deleteMany({});
    res.json({ message: 'All uploads deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  listUploads,
  createUpload,
  updateUpload,
  deleteUpload,
  clearUploads,
};
