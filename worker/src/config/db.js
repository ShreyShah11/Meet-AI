const mongoose = require('mongoose');

/**
 * Connect to MongoDB
 */
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/meetflow';
    const conn = await mongoose.connect(mongoUri);
    console.log(`[Worker] MongoDB Connected: ${conn.connection.host}`);

    mongoose.connection.on('error', (err) => {
      console.error('[Worker] MongoDB error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('[Worker] MongoDB disconnected');
    });

  } catch (error) {
    console.error('[Worker] MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
