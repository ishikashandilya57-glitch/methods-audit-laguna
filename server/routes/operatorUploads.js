const express = require('express');
const router = express.Router();
const {
  listUploads,
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
  .put(updateUpload)
  .delete(deleteUpload);

module.exports = router;
