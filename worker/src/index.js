require('dotenv').config();

const connectDB = require('./config/db');
const { QUEUES, createWorker, createQueueEvents } = require('./config/queue');
const transcriptionProcessor = require('./processors/transcriptionProcessor');

/**
 * MeetFlow Worker
 * Processes transcription and extraction jobs
 */
async function startWorker() {
  console.log(`
  ╔════════════════════════════════════════╗
  ║   MeetFlow Worker                      ║
  ║   Processing transcription jobs        ║
  ╚════════════════════════════════════════╝
  `);

  // Connect to MongoDB
  await connectDB();

  // Create transcription worker
  const transcriptionWorker = createWorker(
    QUEUES.TRANSCRIPTION,
    transcriptionProcessor,
    {
      limiter: {
        max: 2,        // Max 2 jobs
        duration: 1000 // Per second
      }
    }
  );

  // Set up event handlers
  transcriptionWorker.on('completed', (job, result) => {
    console.log(`[Worker] Job completed: ${job.id}`);
    console.log(`[Worker] Segments: ${result.segmentCount}`);
  });

  transcriptionWorker.on('failed', (job, error) => {
    console.error(`[Worker] Job failed: ${job?.id}`, error.message);
  });

  transcriptionWorker.on('progress', (job, progress) => {
    console.log(`[Worker] Job ${job.id} progress: ${progress}%`);
  });

  transcriptionWorker.on('error', (error) => {
    console.error('[Worker] Worker error:', error);
  });

  // Set up queue events for monitoring
  const queueEvents = createQueueEvents(QUEUES.TRANSCRIPTION);

  queueEvents.on('waiting', ({ jobId }) => {
    console.log(`[Queue] Job waiting: ${jobId}`);
  });

  queueEvents.on('active', ({ jobId }) => {
    console.log(`[Queue] Job active: ${jobId}`);
  });

  queueEvents.on('completed', ({ jobId }) => {
    console.log(`[Queue] Job completed: ${jobId}`);
  });

  queueEvents.on('failed', ({ jobId, failedReason }) => {
    console.error(`[Queue] Job failed: ${jobId}`, failedReason);
  });

  console.log('[Worker] Listening for jobs...');

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[Worker] Shutting down...');
    await transcriptionWorker.close();
    await queueEvents.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

// Start the worker
startWorker().catch((error) => {
  console.error('[Worker] Failed to start:', error);
  process.exit(1);
});
