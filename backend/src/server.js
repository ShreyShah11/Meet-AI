/**
 * Server Entry Point
 * Starts the Express server
 */
import app from './app.js';
import { config } from './config/env.js';
import { connectDB } from './config/db.js';

/**
 * Start server
 */
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Start listening
    app.listen(config.port, () => {
      console.log(`
  ╔════════════════════════════════════════╗
  ║   MeetFlow API Server                  ║
  ║   Port: ${config.port}                            ║
  ║   Environment: ${config.nodeEnv.padEnd(19)}║
  ╚════════════════════════════════════════╝
      `);
      console.log(`[Server] API: http://localhost:${config.port}/api`);
      console.log(`[Server] Health: http://localhost:${config.port}/api/health`);
    });

  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
};

startServer();
