/**
 * Environment Configuration
 * Centralizes all environment variable access
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load .env from the project root (one level above /backend)
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../../.env') });


export const config = {
  // Server
  port: parseInt(process.env.PORT) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',

  // MongoDB
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/meetflow',

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
