import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

organizationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export const Organization = mongoose.model('Organization', organizationSchema);
export default Organization;
