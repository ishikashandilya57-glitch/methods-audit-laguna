const OperatorUpload = require('../models/OperatorUpload');

const buildUploadSummary = (upload) => {
  const rows = upload.rows || [];
  const lineRemarks = upload.lineRemarks || [];
  const lines = [...new Set(rows.map((row) => row.line).filter(Boolean))];
  const sections = [...new Set(rows.map((row) => row.section).filter(Boolean))];
  const yesCount = rows.filter((row) => row.auditDone === 'Yes').length;
  const noCount = rows.filter((row) => row.auditDone === 'No').length;

  return {
    _id: upload._id,
    id: String(upload._id),
    fileName: upload.fileName,
    importedAt: upload.importedAt,
    week: upload.week,
    createdBy: upload.createdBy,
    createdAt: upload.createdAt,
    updatedAt: upload.updatedAt,
    rowCount: rows.length,
    lineCount: lines.length,
    sectionCount: sections.length,
    yesCount,
    noCount,
    pendingCount: Math.max(rows.length - yesCount - noCount, 0),
    lineRemarksCount: lineRemarks.length,
  };
};

const listUploads = async (req, res) => {
  try {
    const uploads = await OperatorUpload.find().sort({ importedAt: -1, createdAt: -1 });
    res.json(uploads.map(buildUploadSummary));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getUpload = async (req, res) => {
  try {
    const upload = await OperatorUpload.findById(req.params.id);
    if (!upload) return res.status(404).json({ message: 'Upload not found' });
    res.json(upload);
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
  getUpload,
  createUpload,
  updateUpload,
  deleteUpload,
  clearUploads,
};
