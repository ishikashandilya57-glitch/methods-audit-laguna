const mongoose = require('mongoose');

const OperatorRowSchema = new mongoose.Schema(
  {
    id: String,
    line: String,
    section: String,
    operator: String,
    employeeId: String,
    operation: String,
    speedType: String,
    picture: String,
    auditDone: String,
    auditReason: String,
    auditReasonOther: String,
  },
  { _id: false }
);

const LineRemarkSchema = new mongoose.Schema(
  {
    id: String,
    line: String,
    remark: String,
    status: String,
  },
  { _id: false }
);

const OperatorUploadSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    importedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    week: {
      key: String,
      label: String,
    },
    rows: [OperatorRowSchema],
    lineRemarks: [LineRemarkSchema],
    createdBy: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('OperatorUpload', OperatorUploadSchema);
