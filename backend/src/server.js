/**
 * Server Entry Point
 * Starts the Express server
 */
import http from 'http';
import app from './app.js';
import { config } from './config/env.js';
import { connectDB } from './config/db.js';
import { startBotService, stopBotService } from './bot_process.js';

/**
 * Start server
 */
const startServer = async () => {
  try {
    await connectDB();

    const server = http.createServer(app);

    server.on('error', (error) => {
      stopBotService();

      if (error.code === 'EADDRINUSE') {
        console.error(`[Server] Port ${config.port} is already in use.`);
        console.error('[Server] Stop the existing backend process or run with another port: $env:PORT=3002; npm run dev');
      } else {
        console.error('[Server] Listen error:', error);
      }

      process.exit(1);
    });

    server.listen(config.port, () => {
      // Start Python Bot Service only after the API port is available.
      startBotService();

      console.log(`
  ==========================================
     MeetFlow API Server
     Port: ${config.port}
     Environment: ${config.nodeEnv}
  ==========================================
      `);
      console.log(`[Server] API: http://localhost:${config.port}/api`);
      console.log(`[Server] Health: http://localhost:${config.port}/api/health`);
    });

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
    stopBotService();
    process.exit(1);
  }
};

startServer();
