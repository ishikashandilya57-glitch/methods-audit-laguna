const mongoose = require('mongoose');

const RoadmapRowSchema = new mongoose.Schema(
  {
    sno: Number,
    department: String,
    standardType: String,
    section: String,
    status: {
      type: String,
      enum: ['PENDING', 'ON GOING', 'COMPLETED'],
      default: 'PENDING',
    },
    jul: { type: Boolean, default: false },
    aug: { type: Boolean, default: false },
    sep: { type: Boolean, default: false },
    oct: { type: Boolean, default: false },
    nov: { type: Boolean, default: false },
    dec: { type: Boolean, default: false },
    jan: { type: Boolean, default: false },
    feb: { type: Boolean, default: false },
    mar: { type: Boolean, default: false },
    apr: { type: Boolean, default: false },
    may: { type: Boolean, default: false },
    jun: { type: Boolean, default: false },
  },
  { _id: false }
);

const RoadmapStateSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      unique: true,
      default: 'method-standardization-roadmap',
    },
    rows: [RoadmapRowSchema],
    updatedBy: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('RoadmapState', RoadmapStateSchema);
