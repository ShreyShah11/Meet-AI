/**
 * Summary Model
 * Stores AI-extracted summary and action items
 */
import mongoose from 'mongoose';

const actionItemSchema = new mongoose.Schema({
  task_id: String,
  title: { type: String, required: true },
  description: String,
  assigner: {
    name: String
  },
  assignee: {
    name: String,
    disambiguation: {
      status: { type: String, enum: ['confirmed', 'ambiguous', 'candidate_list'] },
      candidates: [{
        name: String,
        confidence: Number,
        evidence: [String]
      }]
    }
  },
  priority: {
    type: String,
    enum: ['critical', 'high', 'medium', 'low', 'unknown', 'Critical', 'High', 'Medium', 'Low', 'Unknown'],
    default: 'medium'
  },
  urgency_reasoning: String,
  due_date: String,
  suggested_schedule_action: {
    type: String,
    enum: ['slack', 'jira', 'calendar', 'manual', 'other'],
    default: 'manual'
  },
  status: {
    type: String,
    enum: ['proposed', 'assigned', 'in-progress', 'completed', 'cancelled'],
    default: 'proposed'
  },
  evidence: [{
    speaker: String,
    timestamp: String,
    snippet: String
  }],
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.8
  },
  notes: String,
  assignedTeamMemberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TeamMember'
  },
  atlassianEmail: String,
  googleEmail: String,
  slackUserId: String,
  slackDisplayName: String,
  slackMention: String,
  assigneeMapping: {
    name: String,
    atlassianEmail: String,
    googleEmail: String,
    slackUserId: String,
    slackMention: String
  },
  confirmed: { type: Boolean, default: false }
}, { _id: true });

const summarySchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: false,
    index: true
  },

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
