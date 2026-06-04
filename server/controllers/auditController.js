const Audit = require('../models/Audit');

// @desc    Get all audits
// @route   GET /api/audits
const getAudits = async (req, res) => {
  try {
    const { status, area, page = 1, limit = 10 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (area) filter.area = new RegExp(area, 'i');

    const total = await Audit.countDocuments(filter);
    const audits = await Audit.find(filter)
      .populate('auditor', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ audits, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single audit
// @route   GET /api/audits/:id
const getAudit = async (req, res) => {
  try {
    const audit = await Audit.findById(req.params.id)
      .populate('auditor', 'name email')
      .populate('checklists');
    if (!audit) return res.status(404).json({ message: 'Audit not found' });
    res.json(audit);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create audit
// @route   POST /api/audits
const createAudit = async (req, res) => {
  try {
    const audit = await Audit.create({
      ...req.body,
      auditor: req.body.auditor || req.user._id,
      createdBy: req.user._id,
    });
    res.status(201).json(audit);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update audit
// @route   PUT /api/audits/:id
const updateAudit = async (req, res) => {
  try {
    const audit = await Audit.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate('auditor', 'name email');
    if (!audit) return res.status(404).json({ message: 'Audit not found' });
    res.json(audit);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete audit
// @route   DELETE /api/audits/:id
const deleteAudit = async (req, res) => {
  try {
    const audit = await Audit.findByIdAndDelete(req.params.id);
    if (!audit) return res.status(404).json({ message: 'Audit not found' });
    res.json({ message: 'Audit deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getAudits, getAudit, createAudit, updateAudit, deleteAudit };
