/**
 * Summary Model
 * Stores AI-extracted summary and action items
 */
import mongoose from 'mongoose';

const actionItemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  owner: String,
  priority: {
    type: String,
    enum: ['High', 'Medium', 'Low'],
    default: 'Medium'
  },
  dueDate: String,
  confidence: {
    type: Number,
    min: 0,
    max: 100,
    default: 80
  },
  confirmed: { type: Boolean, default: false }
}, { _id: true });

const summarySchema = new mongoose.Schema({
  meetingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meeting',
    required: true,
    unique: true,
    index: true
  },

  // Executive summary
  executive: { type: String, required: true },

  // Key decisions
  decisions: [String],

  // Key topics discussed
  topics: [String],

  // Action items / tasks
  actionItems: [actionItemSchema],

  // Extraction metadata
  chunkCount: Number,
  extractionModel: String,

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

summarySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export const Summary = mongoose.model('Summary', summarySchema);
export default Summary;
