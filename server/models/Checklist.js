const mongoose = require('mongoose');

const ChecklistItemSchema = new mongoose.Schema({
  itemNumber: { type: String },
  question: { type: String, required: true },
  category: { type: String, trim: true },
  methodReference: { type: String, trim: true }, // e.g., SOP-001, ISO-9001
  response: {
    type: String,
    enum: ['pass', 'fail', 'na', 'pending'],
    default: 'pending',
  },
  score: { type: Number, min: 0, max: 10, default: 0 },
  remarks: { type: String },
  evidence: { type: String }, // file path or notes
  isRequired: { type: Boolean, default: true },
});

const ChecklistSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Checklist name is required'],
      trim: true,
    },
    audit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Audit',
      required: true,
    },
    category: {
      type: String,
      enum: ['safety', 'quality', 'process', 'equipment', 'documentation', 'environment'],
      required: true,
    },
    items: [ChecklistItemSchema],
    status: {
      type: String,
      enum: ['draft', 'in-review', 'completed'],
      default: 'draft',
    },
    completionPercentage: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

// Calculate completion % before save
ChecklistSchema.pre('save', function (next) {
  if (this.items && this.items.length > 0) {
    const answered = this.items.filter((i) => i.response !== 'pending').length;
    this.completionPercentage = Math.round((answered / this.items.length) * 100);
  }
  next();
});

module.exports = mongoose.model('Checklist', ChecklistSchema);
