const mongoose = require('mongoose');

/**
 * Transcript Schema (shared with backend)
 */
const transcriptSegmentSchema = new mongoose.Schema({
  speaker: { type: String, required: true },
  start: { type: String, required: true },
  end: { type: String, required: true },
  text: { type: String, required: true }
}, { _id: true });

const transcriptSchema = new mongoose.Schema({
  meetingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meeting',
    required: true,
    unique: true
  },
  segments: [transcriptSegmentSchema],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transcript', transcriptSchema);
