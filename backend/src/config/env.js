/**
 * Environment Configuration
 * Centralizes all environment variable access
 */
import 'dotenv/config';

export const config = {
  // Server
  port: parseInt(process.env.PORT) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',

  // MongoDB
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/meetflow',

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
  },

  // CORS
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Auth
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'meetflow-dev-secret-change-me',
    jwtExpiresInSeconds: parseInt(process.env.JWT_EXPIRES_IN_SECONDS) || 60 * 60 * 24 * 7
  },

  // Gradio (transcription)
  gradioEndpoint: process.env.GRADIO_ENDPOINT || 'http://localhost:7860',

  // LLM (for future)
  llm: {
    provider: process.env.LLM_PROVIDER || 'dummy',
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || '',
  },
};

export default config;
