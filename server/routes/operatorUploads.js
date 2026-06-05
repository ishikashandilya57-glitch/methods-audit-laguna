const express = require('express');
const router = express.Router();
const {
  listUploads,
  getUpload,
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

module.exports = router;
