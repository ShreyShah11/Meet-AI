/**
 * Express Application
 * Main app configuration
 */
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/env.js';
import { meetingsRoutes, jobsRoutes, teamMembersRoutes } from './routes/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Create Express app
 */
const app = express();

// ========================================
// MIDDLEWARE
// ========================================

// CORS
app.use(cors({
  origin: config.frontendUrl,
  credentials: true
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploads directory (development only)
if (config.isDev) {
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
}

// ========================================
// ROUTES
// ========================================

app.use('/api/meetings', meetingsRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/team-members', teamMembersRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv
  });
});

// ========================================
// ERROR HANDLING
// ========================================

// Multer errors
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File too large. Maximum size is 500MB.' });
  }
  if (err.message === 'Only audio files are allowed') {
    return res.status(400).json({ message: err.message });
  }
  next(err);
});

// General errors
app.use((err, req, res, next) => {
  console.error('[Error]', err);
  res.status(500).json({
    message: config.isDev ? err.message : 'Internal server error'
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

export default app;
