/**
 * Meeting Model
 * Stores meeting metadata and processing status
 */
import mongoose from 'mongoose';

const meetingSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    index: true
  },

  // Meeting title
  title: {
    type: String,
    default: () => `Meeting ${new Date().toLocaleDateString()}`
  },

  // Processing status
  status: {
    type: String,
    enum: ['pending', 'uploading', 'transcribing', 'chunking', 'extracting', 'merging', 'done', 'error'],
    default: 'pending'
  },

  // Audio file info
  audioPath: {
    type: String,
    required: false
  },
  originalFilename: String,
  fileSize: Number,
  duration: Number,

  accessibleTeamMembers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TeamMember',
    index: true
  }],

  accessibleUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  }],

  vectorIndexName: String,
  vectorNamespace: String,
  vectorStatus: {
    type: String,
    enum: ['pending', 'indexed', 'unavailable', 'error'],
    default: 'pending'
  },
  vectorChunkCount: {
    type: Number,
    default: 0
  },
  vectorError: String,

  // Job reference
  jobId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Error info
  errorMessage: String,

  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
meetingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export const Meeting = mongoose.model('Meeting', meetingSchema);
export default Meeting;
