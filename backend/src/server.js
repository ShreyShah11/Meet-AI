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
import { startBotService, stopBotService } from './bot_process.js';

/**
 * Start server
 */
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Start Python Bot Service
    startBotService();

    // Start listening
    const server = app.listen(config.port, () => {
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

    // Graceful shutdown
    const shutdown = () => {
      console.log('[Server] Shutting down...');
      stopBotService();
      server.close(() => {
        console.log('[Server] HTTP server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
};

startServer();
