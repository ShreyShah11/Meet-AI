/**
 * Job Queue Service
 * In-memory job processing with detailed step tracking
 */
import { Meeting, Transcript, Summary } from '../models/index.js';
import { transcriptionService, chunkingService, llmService, vectorService } from '../services/index.js';

// In-memory job store
const jobs = new Map();

// Processing step definitions for UI
const STEPS = {
  QUEUED: { step: 'queued', label: 'Queued', progress: 0 },
  UPLOADING: { step: 'uploading', label: 'Uploading audio...', progress: 5 },
  CONNECTING: { step: 'connecting', label: 'Connecting to AI...', progress: 10 },
  TRANSCRIBING: { step: 'transcribing', label: 'Transcribing & Diarizing...', progress: 15 },
  SAVING_TRANSCRIPT: { step: 'saving_transcript', label: 'Saving transcript...', progress: 40 },
  CHUNKING: { step: 'chunking', label: 'Analyzing content...', progress: 50 },
  EXTRACTING: { step: 'extracting', label: 'Extracting insights...', progress: 60 },
  MERGING: { step: 'merging', label: 'Generating summary...', progress: 85 },
  SAVING_SUMMARY: { step: 'saving_summary', label: 'Saving results...', progress: 95 },
  DONE: { step: 'done', label: 'Complete!', progress: 100 },
  ERROR: { step: 'error', label: 'Error', progress: 0 }
};

/**
 * Enqueue and process a job
 */
export const enqueueProcessingJob = async (jobData) => {
  const { jobId, meetingId, audioPath, type } = jobData;

  // Initialize job with detailed state
  jobs.set(jobId, {
    id: jobId,
    meetingId,
    status: 'processing',
    ...STEPS.QUEUED,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    error: null,
    type: type || 'audio'
  });

  console.log(`[Queue] Job enqueued: ${jobId} (${type || 'audio'})`);

  // Process asynchronously
  processJob(jobId, meetingId, audioPath, type);

  return { jobId, status: 'queued' };
};

/**
 * Process job through the pipeline with detailed step tracking
 */
const processJob = async (jobId, meetingId, audioPath, type = 'audio') => {
  try {
    let segments = [];
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      throw new Error('Meeting not found');
    }
    const organizationId = meeting.organizationId;

    // Step 1 & 2 & 3: Audio Processing (Skip if transcript-only)
    if (type !== 'transcript-only') {
        // Step 1: Connecting to Gradio
        updateJobStep(jobId, STEPS.CONNECTING);
        await updateMeetingStatus(meetingId, 'transcribing');

        // Step 2: Transcribing with Gradio diarization
        updateJobStep(jobId, STEPS.TRANSCRIBING);
        console.log('[Processor] 🎤 Sending to Gradio for diarization...');

        segments = await transcriptionService.transcribe(
            audioPath,
            {}, // options
            (step, label) => {
                // onProgress update
                console.log(`[Processor] 📢 Progress: ${step} - ${label}`);

                // Map the service step to our job steps structure
                const stepInfo = STEPS[step.toUpperCase()] || STEPS.TRANSCRIBING;
                const stepWithLabel = { ...stepInfo, label };

                updateJobStep(jobId, stepWithLabel);
            }
        );

        if (!segments || segments.length === 0) {
          throw new Error('No transcript segments received from diarization');
        }

        // Step 3: Save transcript to MongoDB
        updateJobStep(jobId, STEPS.SAVING_TRANSCRIPT);
        const speakers = [...new Set(segments.map(s => s.speaker))];
        const duration = segments.length > 0 ? segments[segments.length - 1].end : 0;

        await Transcript.findOneAndUpdate(
          { meetingId },
          { organizationId, meetingId, segments, speakers, duration },
          { upsert: true, new: true }
        );
        console.log(`[Processor] 💾 Saved ${segments.length} segments, ${speakers.length} speakers`);
    } else {
        // Retrieval for transcript-only jobs
        const transcript = await Transcript.findOne({ meetingId });
        if (transcript) segments = transcript.segments;
        else segments = [{ text: "No content", speaker: "System", start: 0, end: 0 }];
    }

    // Step 4: Chunking for LLM
    updateJobStep(jobId, STEPS.CHUNKING);
    await updateMeetingStatus(meetingId, 'chunking');
    const transcriptForVectors = await Transcript.findOne({ meetingId });
    if (transcriptForVectors) {
      await vectorService.indexTranscript({ meeting, transcript: transcriptForVectors });
      console.log(`[Processor] Indexed transcript chunks for meeting: ${meetingId}`);
    }
    const chunks = chunkingService.chunkTranscript(segments);
    console.log(`[Processor] 📦 Created ${chunks.length} chunks`);

    // Step 5: Extract insights from each chunk (Pass 1)
    updateJobStep(jobId, STEPS.EXTRACTING);
    await updateMeetingStatus(meetingId, 'extracting');

    const chunkExtractions = [];
    for (let i = 0; i < chunks.length; i++) {
        // Pass the full chunk object
      const extraction = await llmService.extractFromChunk(chunks[i]);
      chunkExtractions.push(extraction);

      // Update progress within extracting step (60-80%)
      const extractProgress = 60 + Math.floor((i + 1) / chunks.length * 20);
      updateJobProgress(jobId, extractProgress);
    }

    // Step 6: Merge extractions (Pass 2)
    updateJobStep(jobId, STEPS.MERGING);
    await updateMeetingStatus(meetingId, 'merging');
    const mergedResult = await llmService.mergeExtractions(chunkExtractions);

    // Step 7: Save summary to MongoDB (raw LLM format)
    updateJobStep(jobId, STEPS.SAVING_SUMMARY);
    await Summary.findOneAndUpdate(
      { meetingId },
      {
        organizationId,
        meetingId,
        executive: mergedResult.summary,  // Raw 'summary' -> stored as 'executive'
        topics: [],
        decisions: [],
        actionItems: mergedResult.tasks,  // Raw 'tasks' array
        chunkCount: chunks.length,
        extractionModel: 'llama-3.3-70b-versatile'
      },
      { upsert: true, new: true }
    );

    // Done!
    updateJobStep(jobId, STEPS.DONE);
    await updateMeetingStatus(meetingId, 'done');
    console.log(`[Processor] ✅ Job completed: ${jobId}`);

  } catch (error) {
    console.error(`[Processor] ❌ Job failed: ${jobId}`, error.message);

    updateJobStep(jobId, STEPS.ERROR, error.message);
    await updateMeetingStatus(meetingId, 'error', error.message);
  }
};

/**
 * Update job with step info
 */
const updateJobStep = (jobId, stepInfo, error = null) => {
  const job = jobs.get(jobId);
  if (job) {
    job.step = stepInfo.step;
    job.label = stepInfo.label;
    job.progress = stepInfo.progress;
    job.status = stepInfo.step === 'done' ? 'done' : stepInfo.step === 'error' ? 'error' : 'processing';
    job.error = error;
    job.updatedAt = Date.now();
  }
};

/**
 * Update just progress within a step
 */
const updateJobProgress = (jobId, progress) => {
  const job = jobs.get(jobId);
  if (job) {
    job.progress = progress;
    job.updatedAt = Date.now();
  }
};

/**
 * Update meeting status in DB
 */
const updateMeetingStatus = async (meetingId, status, errorMessage = null) => {
  const update = { status, updatedAt: Date.now() };
  if (errorMessage) update.errorMessage = errorMessage;
  await Meeting.findByIdAndUpdate(meetingId, update);
};

/**
 * Get job status with all details
 */
export const getJobFromQueue = (jobId) => {
  const job = jobs.get(jobId);
  if (!job) return null;

  return {
    id: job.id,
    meetingId: job.meetingId,
    status: job.status,
    step: job.step,
    label: job.label,
    progress: job.progress,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  };
};

export default { enqueueProcessingJob, getJobFromQueue };
