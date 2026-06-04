const express = require('express');
const router = express.Router();
const { getAudits, getAudit, createAudit, updateAudit, deleteAudit } = require('../controllers/auditController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect); // All audit routes require login

router.route('/')
  .get(getAudits)
  .post(createAudit);

router.route('/:id')
  .get(getAudit)
  .put(updateAudit)
  .delete(authorize('manager', 'admin'), deleteAudit);

module.exports = router;
