const gradioService = require('../services/gradioService');
const Meeting = require('../models/Meeting');
const Transcript = require('../models/Transcript');

/**
 * Transcription Processor
 * Handles transcription jobs from BullMQ queue
 */
const transcriptionProcessor = async (job) => {
  const { meetingId, audioPath, jobId } = job.data;

  console.log(`[Transcription] Processing job: ${job.id}`);
  console.log(`[Transcription] Meeting: ${meetingId}, Audio: ${audioPath}`);

  try {
    // Update status to transcribing
    await Meeting.findByIdAndUpdate(meetingId, {
      status: 'transcribing',
      updatedAt: Date.now()
    });

    job.updateProgress(25);

    // Send audio to Gradio for transcription
    console.log('[Transcription] Calling Gradio endpoint...');
    const segments = await gradioService.transcribe(audioPath);

    job.updateProgress(75);

    // Save transcript to database
    await Transcript.findOneAndUpdate(
      { meetingId },
      {
        meetingId,
        segments,
        createdAt: Date.now()
      },
      { upsert: true, new: true }
    );

    console.log(`[Transcription] Saved ${segments.length} segments to DB`);

    // Update meeting status
    await Meeting.findByIdAndUpdate(meetingId, {
      status: 'extracting',
      updatedAt: Date.now()
    });

    job.updateProgress(100);

    console.log(`[Transcription] Job completed: ${job.id}`);

    // Return data for extraction processor
    return {
      meetingId,
      segmentCount: segments.length,
      segments
    };

  } catch (error) {
    console.error(`[Transcription] Job failed: ${job.id}`, error);

    // Update meeting with error
    await Meeting.findByIdAndUpdate(meetingId, {
      status: 'error',
      errorMessage: error.message,
      updatedAt: Date.now()
    });

    throw error;
  }
};

module.exports = transcriptionProcessor;
