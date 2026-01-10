const { Queue, Worker, QueueEvents } = require('bullmq');
const IORedis = require('ioredis');

/**
 * Redis connection for BullMQ
 */
const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

/**
 * Queue names
 */
const QUEUES = {
  TRANSCRIPTION: 'transcription',
  EXTRACTION: 'extraction'
};

/**
 * Create queue instance
 */
const createQueue = (name) => {
  return new Queue(name, { connection });
};

/**
 * Create worker instance
 */
const createWorker = (name, processor, opts = {}) => {
  return new Worker(name, processor, {
    connection,
    concurrency: parseInt(process.env.CONCURRENCY) || 2,
    ...opts
  });
};

/**
 * Create queue events listener
 */
const createQueueEvents = (name) => {
  return new QueueEvents(name, { connection });
};

module.exports = {
  connection,
  QUEUES,
  createQueue,
  createWorker,
  createQueueEvents
};
