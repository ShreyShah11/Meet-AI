/**
 * Jobs Controller
 * Handles job status API requests with detailed progress info
 */
import { Meeting } from '../models/index.js';
import { getJobFromQueue } from '../queue/index.js';

/**
 * GET /api/jobs/:jobId/status
 * Get detailed status of a processing job
 */
export const getJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;

    // First, check in-memory queue for real-time status
    const queueJob = getJobFromQueue(jobId);

    if (queueJob) {
      // Return detailed job info from queue
      const meeting = await Meeting.findOne({ _id: queueJob.meetingId, organizationId: req.organizationId });
      if (!meeting) {
        return res.status(404).json({ message: 'Job not found' });
      }

      return res.json({
        status: queueJob.status,
        step: queueJob.step,
        label: queueJob.label,
        progress: queueJob.progress,
        meetingId: queueJob.meetingId,
        error: queueJob.error,
        createdAt: queueJob.createdAt,
        updatedAt: queueJob.updatedAt
      });
    }

    // Fallback: Check database for completed/historical jobs
    const meeting = await Meeting.findOne({ jobId, organizationId: req.organizationId });

    if (!meeting) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Map meeting status to job status for database fallback
    const statusMap = {
      'pending': { status: 'processing', step: 'queued', label: 'Queued', progress: 0 },
      'uploading': { status: 'processing', step: 'uploading', label: 'Uploading...', progress: 5 },
      'transcribing': { status: 'processing', step: 'transcribing', label: 'Transcribing...', progress: 20 },
      'chunking': { status: 'processing', step: 'chunking', label: 'Analyzing...', progress: 50 },
      'extracting': { status: 'processing', step: 'extracting', label: 'Extracting insights...', progress: 70 },
      'merging': { status: 'processing', step: 'merging', label: 'Generating summary...', progress: 90 },
      'done': { status: 'done', step: 'done', label: 'Complete!', progress: 100 },
      'error': { status: 'error', step: 'error', label: 'Error', progress: 0 }
    };

    const jobStatus = statusMap[meeting.status] || { status: 'processing', step: 'queued', label: 'Processing...', progress: 0 };

    res.json({
      ...jobStatus,
      meetingId: meeting._id,
      error: meeting.errorMessage,
      createdAt: meeting.createdAt,
      updatedAt: meeting.updatedAt
    });

  } catch (error) {
    console.error('[JobStatus] Error:', error);
    res.status(500).json({ message: 'Failed to get job status' });
  }
};

export default { getJobStatus };
