const express = require('express');
const router = express.Router();
const {
  listUploads,
  getUpload,
  updateUploadRow,
  updateUploadLineRemarks,
  createUpload,
  updateUpload,
  deleteUpload,
  clearUploads,
} = require('../controllers/operatorUploadController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(listUploads)
  .post(createUpload)
  .delete(clearUploads);

router.route('/:id')
  .get(getUpload)
  .put(updateUpload)
  .delete(deleteUpload);

router.patch('/:id/rows/:rowId', updateUploadRow);
router.patch('/:id/line-remarks', updateUploadLineRemarks);

module.exports = router;
