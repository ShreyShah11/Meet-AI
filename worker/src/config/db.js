const mongoose = require('mongoose');

/**
 * Connect to MongoDB
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
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
