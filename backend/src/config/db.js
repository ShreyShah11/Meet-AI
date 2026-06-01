/**
 * Database Configuration
 * MongoDB connection using Mongoose
 */
import mongoose from 'mongoose';
import { config } from './env.js';

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
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
    console.error('[DB] MongoDB URI:', config.mongoUri);
    console.error('[DB] Make sure MongoDB is running and accessible, or set MONGODB_URI in your .env file.');
    process.exit(1);
  }
};

export default connectDB;
