/**
 * Database Configuration
 * MongoDB connection using Mongoose
 */
import mongoose from 'mongoose';
import { config } from './env.js';

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.mongoUri);
    console.log(`[DB] MongoDB connected: ${conn.connection.host}`);

    mongoose.connection.on('error', (err) => {
      console.error('[DB] MongoDB error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('[DB] MongoDB disconnected');
    });

    return conn;
  } catch (error) {
    console.error('[DB] Connection failed:', error.message);
    process.exit(1);
  }
};

export default connectDB;
