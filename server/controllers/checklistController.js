const Checklist = require('../models/Checklist');
const Audit = require('../models/Audit');

// @desc    Get checklists for an audit
// @route   GET /api/checklists?auditId=xxx
const getChecklists = async (req, res) => {
  try {
    const { auditId } = req.query;
    const filter = auditId ? { audit: auditId } : {};
    const checklists = await Checklist.find(filter).sort({ createdAt: -1 });
    res.json(checklists);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single checklist
// @route   GET /api/checklists/:id
const getChecklist = async (req, res) => {
  try {
    const checklist = await Checklist.findById(req.params.id).populate('audit', 'title auditNumber');
    if (!checklist) return res.status(404).json({ message: 'Checklist not found' });
    res.json(checklist);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create checklist
// @route   POST /api/checklists
const createChecklist = async (req, res) => {
  try {
    const checklist = await Checklist.create({
      ...req.body,
      createdBy: req.user._id,
    });

    // Link checklist to audit
    await Audit.findByIdAndUpdate(req.body.audit, {
      $push: { checklists: checklist._id },
    });

    res.status(201).json(checklist);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update checklist (including item responses)
// @route   PUT /api/checklists/:id
const updateChecklist = async (req, res) => {
  try {
    const checklist = await Checklist.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!checklist) return res.status(404).json({ message: 'Checklist not found' });
    res.json(checklist);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update a single checklist item response
// @route   PATCH /api/checklists/:id/items/:itemId
const updateChecklistItem = async (req, res) => {
  try {
    const checklist = await Checklist.findById(req.params.id);
    if (!checklist) return res.status(404).json({ message: 'Checklist not found' });

    const item = checklist.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    Object.assign(item, req.body);
    await checklist.save(); // triggers pre-save for completion %
    res.json(checklist);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete checklist
// @route   DELETE /api/checklists/:id
const deleteChecklist = async (req, res) => {
  try {
    const checklist = await Checklist.findByIdAndDelete(req.params.id);
    if (!checklist) return res.status(404).json({ message: 'Checklist not found' });

    // Remove reference from audit
    await Audit.findByIdAndUpdate(checklist.audit, {
      $pull: { checklists: checklist._id },
    });

    res.json({ message: 'Checklist deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getChecklists,
  getChecklist,
  createChecklist,
  updateChecklist,
  updateChecklistItem,
  deleteChecklist,
};
