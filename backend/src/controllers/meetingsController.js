/**
 * Meetings Controller
 * Handles meeting-related API requests
 */
import { v4 as uuidv4 } from 'uuid';
import { Meeting, Transcript, Summary } from '../models/index.js';
import { enqueueProcessingJob } from '../queue/index.js';

/**
 * POST /api/meetings/upload
 * Upload audio and start processing
 */
export const uploadMeeting = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No audio file provided' });
    }

    // Generate job ID
    const jobId = `job-${Date.now()}-${uuidv4().slice(0, 8)}`;

    // Create meeting record
    const meeting = new Meeting({
      title: req.body.title || `Meeting ${new Date().toLocaleDateString()}`,
      status: 'uploading',
      audioPath: req.file.path,
      originalFilename: req.file.originalname,
      fileSize: req.file.size,
      jobId
    });

    await meeting.save();

    // Enqueue processing job
    await enqueueProcessingJob({
      jobId,
      meetingId: meeting._id.toString(),
      audioPath: req.file.path
    });

    console.log(`[Upload] Meeting created: ${meeting._id}, Job: ${jobId}`);

    res.status(201).json({
      meetingId: meeting._id,
      jobId
    });

  } catch (error) {
    console.error('[Upload] Error:', error);
    res.status(500).json({ message: error.message || 'Upload failed' });
  }
};

/**
 * GET /api/meetings/:meetingId/transcript
 * Get transcript for a meeting
 */
export const getTranscript = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const transcript = await Transcript.findOne({ meetingId });

    if (!transcript) {
      return res.status(404).json({ message: 'Transcript not found' });
    }

    // Format segments for frontend
    const formattedSegments = transcript.segments.map((seg, idx) => ({
      id: idx + 1,
      speaker: seg.speaker,
      start: formatTime(seg.start),
      end: formatTime(seg.end),
      text: seg.text
    }));

    res.json(formattedSegments);

  } catch (error) {
    console.error('[Transcript] Error:', error);
    res.status(500).json({ message: 'Failed to fetch transcript' });
  }
};

/**
 * GET /api/meetings/:meetingId/summary
 * Get summary and action items for a meeting
 */
export const getSummary = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const summary = await Summary.findOne({ meetingId });

    if (!summary) {
      return res.status(404).json({ message: 'Summary not found' });
    }

    res.json({
      executive: summary.executive,
      decisions: summary.decisions,
      actionItems: summary.actionItems
    });

  } catch (error) {
    console.error('[Summary] Error:', error);
    res.status(500).json({ message: 'Failed to fetch summary' });
  }
};

/**
 * POST /api/meetings/:meetingId/tasks
 * Update confirmed tasks
 */
export const updateTasks = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { tasks } = req.body;

    await Summary.findOneAndUpdate(
      { meetingId },
      { actionItems: tasks, updatedAt: Date.now() }
    );

    console.log(`[Tasks] Updated ${tasks?.length || 0} tasks for meeting: ${meetingId}`);
    res.json({ success: true });

  } catch (error) {
    console.error('[Tasks] Error:', error);
    res.status(500).json({ message: 'Failed to update tasks' });
  }
};

/**
 * Format seconds to HH:MM:SS
 */
const formatTime = (seconds) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default {
  uploadMeeting,
  getTranscript,
  getSummary,
  updateTasks
};
