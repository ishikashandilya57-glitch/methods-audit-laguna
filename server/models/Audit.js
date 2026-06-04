const mongoose = require('mongoose');

const AuditSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Audit title is required'],
      trim: true,
    },
    auditNumber: {
      type: String,
      unique: true,
    },
    type: {
      type: String,
      enum: ['routine', 'surprise', 'follow-up', 'special'],
      default: 'routine',
    },
    area: {
      type: String,
      required: [true, 'Area/Department is required'],
      trim: true,
    },
    productionLine: {
      type: String,
      trim: true,
    },
    auditor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    auditee: {
      type: String,
      trim: true,
    },
    scheduledDate: {
      type: Date,
      required: [true, 'Scheduled date is required'],
    },
    completedDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['scheduled', 'in-progress', 'completed', 'cancelled'],
      default: 'scheduled',
    },
    scope: {
      type: String,
      trim: true,
    },
    objectives: {
      type: String,
      trim: true,
    },
    checklists: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Checklist',
      },
    ],
    overallScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    summary: {
      type: String,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

// Auto-generate audit number before saving
AuditSchema.pre('save', async function (next) {
  if (!this.auditNumber) {
    const count = await mongoose.model('Audit').countDocuments();
    const year = new Date().getFullYear();
    this.auditNumber = `AUD-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Audit', AuditSchema);
