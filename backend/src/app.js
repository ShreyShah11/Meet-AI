/**
 * Express Application
 * Main app configuration
 */
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/env.js';
import { meetingsRoutes, jobsRoutes, teamMembersRoutes, authRoutes, usersRoutes } from './routes/index.js';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { requireAuth } from './middleware/auth.js';

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
  origin: config.isDev ? /^http:\/\/localhost:\d+$/ : config.frontendUrl,
  credentials: true
}));

// Proxy to Python Bot Service
// Must be before body parsers to ensure stream is not consumed
app.use('/api/bot', requireAuth, createProxyMiddleware({
  target: 'http://127.0.0.1:5001',
  changeOrigin: true,
  pathRewrite: {
    '^/api/bot': '', // remove base path
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Proxy] forward: ${req.method} ${req.url} -> http://127.0.0.1:5001${proxyReq.path}`);
    // Fix for body parser issue if it *was* already parsed (safety check)
    if (req.body && Object.keys(req.body).length > 0) {
      const bodyData = JSON.stringify(req.body);
      // incase if content-type is application/x-www-form-urlencoded -> we need to change to application/json
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      // stream the content
      proxyReq.write(bodyData);
    }
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`[Proxy] response: ${proxyRes.statusCode} from ${req.url}`);
  }
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

app.use('/api/auth', authRoutes);
app.use('/api/meetings', requireAuth, meetingsRoutes);
app.use('/api/jobs', requireAuth, jobsRoutes);
app.use('/api/team-members', requireAuth, teamMembersRoutes);
app.use('/api/users', requireAuth, usersRoutes);

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
