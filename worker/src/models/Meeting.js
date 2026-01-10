const mongoose = require('mongoose');

/**
 * Meeting Schema (shared with backend)
 */
const meetingSchema = new mongoose.Schema({
  title: { type: String },
  status: {
    type: String,
    enum: ['pending', 'uploading', 'transcribing', 'extracting', 'done', 'error'],
    default: 'pending'
  },
  audioUrl: { type: String, required: true },
  originalFilename: { type: String },
  fileSize: { type: Number },
  duration: { type: Number },
  jobId: { type: String, required: true, unique: true },
  errorMessage: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

meetingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Meeting', meetingSchema);
