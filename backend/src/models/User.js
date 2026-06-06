import mongoose from 'mongoose';

export const ROLES = ['admin', 'member'];

const userSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true,
    index: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ROLES,
    default: 'member'
  },
  status: {
    type: String,
    enum: ['active', 'disabled'],
    default: 'active'
  },
  // Integration credentials and identifiers
  jiraEmail: {
    type: String,
    trim: true,
    lowercase: true,
    default: null
  },
  slackUserId: {
    type: String,
    trim: true,
    default: null
  },
  slackDisplayName: {
    type: String,
    trim: true,
    default: null
  },
  googleEmail: {
    type: String,
    trim: true,
    lowercase: true,
    default: null
  },
  atlassianEmail: {
    type: String,
    trim: true,
    lowercase: true,
    default: null
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

userSchema.methods.toSafeObject = function() {
  const user = this.toObject();
  delete user.passwordHash;
  return user;
};

export const User = mongoose.model('User', userSchema);
export default User;
