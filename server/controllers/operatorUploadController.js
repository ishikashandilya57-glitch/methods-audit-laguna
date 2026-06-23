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
    const uploads = await OperatorUpload.aggregate([
      {
        $project: {
          fileName: 1,
          importedAt: 1,
          week: 1,
          createdBy: 1,
          createdAt: 1,
          updatedAt: 1,
          rowsSafe: { $ifNull: ['$rows', []] },
          lineRemarksCount: { $size: { $ifNull: ['$lineRemarks', []] } },
        },
      },
      {
        $project: {
          fileName: 1,
          importedAt: 1,
          week: 1,
          createdBy: 1,
          createdAt: 1,
          updatedAt: 1,
          lineRemarksCount: 1,
          rowCount: { $size: '$rowsSafe' },
          lineCount: {
            $size: {
              $setUnion: [
                [],
                {
                  $filter: {
                    input: {
                      $map: {
                        input: '$rowsSafe',
                        as: 'row',
                        in: '$$row.line',
                      },
                    },
                    as: 'line',
                    cond: {
                      $and: [
                        { $ne: ['$$line', null] },
                        { $ne: ['$$line', ''] },
                      ],
                    },
                  },
                },
              ],
            },
          },
          sectionCount: {
            $size: {
              $setUnion: [
                [],
                {
                  $filter: {
                    input: {
                      $map: {
                        input: '$rowsSafe',
                        as: 'row',
                        in: '$$row.section',
                      },
                    },
                    as: 'section',
                    cond: {
                      $and: [
                        { $ne: ['$$section', null] },
                        { $ne: ['$$section', ''] },
                      ],
                    },
                  },
                },
              ],
            },
          },
          yesCount: {
            $size: {
              $filter: {
                input: '$rowsSafe',
                as: 'row',
                cond: { $eq: ['$$row.auditDone', 'Yes'] },
              },
            },
          },
          noCount: {
            $size: {
              $filter: {
                input: '$rowsSafe',
                as: 'row',
                cond: { $eq: ['$$row.auditDone', 'No'] },
              },
            },
          },
        },
      },
      {
        $addFields: {
          id: { $toString: '$_id' },
          pendingCount: {
            $subtract: ['$rowCount', { $add: ['$yesCount', '$noCount'] }],
          },
        },
      },
      { $sort: { importedAt: -1, createdAt: -1 } },
    ]);

    res.json(uploads);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getUpload = async (req, res) => {
  try {
    const upload = await OperatorUpload.findById(req.params.id).lean();
    if (!upload) return res.status(404).json({ message: 'Upload not found' });
    res.json(upload);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateUploadRow = async (req, res) => {
  try {
    const allowedFields = ['speedType', 'picture', 'auditDone', 'auditReason', 'auditReasonOther'];
    const setUpdates = {};

    allowedFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        setUpdates[`rows.$.${field}`] = req.body[field];
      }
    });

    if (!Object.keys(setUpdates).length) {
      return res.status(400).json({ message: 'No valid row fields provided' });
    }

    const upload = await OperatorUpload.findOneAndUpdate(
      { _id: req.params.id, 'rows.id': req.params.rowId },
      { $set: setUpdates },
      { new: true, runValidators: true }
    );

    if (!upload) {
      const exists = await OperatorUpload.exists({ _id: req.params.id });
      return res.status(404).json({
        message: exists ? 'Upload row not found' : 'Upload not found',
      });
    }

    const row = upload.rows.find((item) => item.id === req.params.rowId);

    res.json({ message: 'Row updated', row });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updateUploadLineRemarks = async (req, res) => {
  try {
    const upload = await OperatorUpload.findById(req.params.id);
    if (!upload) return res.status(404).json({ message: 'Upload not found' });

    upload.lineRemarks = Array.isArray(req.body.lineRemarks) ? req.body.lineRemarks : [];
    upload.markModified('lineRemarks');
    await upload.save();

    res.json({ message: 'Line remarks updated', lineRemarks: upload.lineRemarks });
  } catch (error) {
    res.status(400).json({ message: error.message });
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
  updateUploadRow,
  updateUploadLineRemarks,
  createUpload,
  updateUpload,
  deleteUpload,
  clearUploads,
};
