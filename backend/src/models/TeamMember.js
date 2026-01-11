/**
 * TeamMember Model
 * Stores team member info for mapping to external services
 */
import mongoose from 'mongoose';

const teamMemberSchema = new mongoose.Schema({
  // Display name (used for matching with LLM-extracted assignee names)
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },

  // Alternative names/nicknames for matching
  aliases: [{ type: String, trim: true }],

  // Atlassian/Jira integration
  atlassianEmail: {
    type: String,
    trim: true,
    lowercase: true
  },

  // Google Calendar integration
  googleEmail: {
    type: String,
    trim: true,
    lowercase: true
  },

  // Slack integration (user ID format: U01ABC123)
  slackUserId: {
    type: String,
    trim: true
  },

  // Optional: Slack display name for reference
  slackDisplayName: {
    type: String,
    trim: true
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
teamMemberSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static method to find member by name or alias
teamMemberSchema.statics.findByNameOrAlias = async function(name) {
  if (!name) return null;

  const normalizedName = name.toLowerCase().trim();

  return this.findOne({
    $or: [
      { name: { $regex: new RegExp(`^${normalizedName}$`, 'i') } },
      { aliases: { $regex: new RegExp(`^${normalizedName}$`, 'i') } }
    ]
  });
};

export const TeamMember = mongoose.model('TeamMember', teamMemberSchema);
export default TeamMember;
