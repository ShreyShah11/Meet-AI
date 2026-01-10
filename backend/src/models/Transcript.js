/**
 * Transcript Model
 * Stores speaker-wise transcript segments
 */
import mongoose from 'mongoose';

const segmentSchema = new mongoose.Schema({
  speaker: { type: String, required: true },
  start: { type: Number, required: true },  // Seconds
  end: { type: Number, required: true },
  text: { type: String, required: true }
}, { _id: true });

const transcriptSchema = new mongoose.Schema({
  meetingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meeting',
    required: true,
    unique: true,
    index: true
  },

  // Raw segments from transcription
  segments: [segmentSchema],

  // Total duration in seconds
  duration: Number,

  // Speaker list
  speakers: [String],

  createdAt: { type: Date, default: Date.now }
});

export const Transcript = mongoose.model('Transcript', transcriptSchema);
export default Transcript;
