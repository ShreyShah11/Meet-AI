/**
 * Environment Configuration
 * Centralizes all environment variable access
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load .env file — try multiple locations to support dev and production layouts:
//   1. Project root (../../.env relative to backend/src/config/)  ← local dev
//   2. Same directory as this file (fallback)
//   In production (Render), env vars are injected directly — dotenv is a no-op.
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootEnv = resolve(__dirname, '../../../.env');
const localEnv = resolve(__dirname, '.env');
dotenv.config({ path: rootEnv });
dotenv.config({ path: localEnv }); // no-op if not found

export const config = {
  // Server
  port: parseInt(process.env.PORT) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',

  // MongoDB
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/meetflow',

  // Redis (not used — queue is in-memory)
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
  },

  // CORS
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Auth
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'meetflow-dev-secret-change-me-in-production',
    jwtExpiresInSeconds: parseInt(process.env.JWT_EXPIRES_IN_SECONDS) || 60 * 60 * 24 * 7
  },

  // Gradio (transcription — local only, skipped in production)
  gradioEndpoint: process.env.GRADIO_ENDPOINT || 'http://localhost:7860',

  // LLM (Groq)
  llm: {
    provider: process.env.LLM_PROVIDER || 'dummy',
    apiKey: process.env.LLM_API_KEY || process.env.GROQ_API_KEY || '',
    model: process.env.LLM_MODEL || '',
  },

  // Vector DB (Pinecone + Gemini)
  vectors: {
    pineconeApiKey: process.env.PINECONE_API_KEY || '',
    pineconeCloud: process.env.PINECONE_CLOUD || 'aws',
    pineconeRegion: process.env.PINECONE_REGION || 'us-east-1',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    embeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004',
    answerModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    embeddingDimension: parseInt(process.env.GEMINI_EMBEDDING_DIMENSION) || 768,
    topK: parseInt(process.env.VECTOR_TOP_K) || 5
  },
};

export default config;
