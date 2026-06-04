const express = require('express');
const router = express.Router();
const {
  getChecklists,
  getChecklist,
  createChecklist,
  updateChecklist,
  updateChecklistItem,
  deleteChecklist,
} = require('../controllers/checklistController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getChecklists)
  .post(createChecklist);

router.route('/:id')
  .get(getChecklist)
  .put(updateChecklist)
  .delete(deleteChecklist);

router.patch('/:id/items/:itemId', updateChecklistItem);

module.exports = router;
