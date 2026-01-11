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
 * POST /api/meetings/upload-transcript
 * Upload transcript file and start processing
 */
export const uploadTranscript = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No transcript file provided' });
    }

    // Generate job ID
    const jobId = `job-${Date.now()}-${uuidv4().slice(0, 8)}`;

    // Read file content
    const fs = await import('fs');
    const content = fs.readFileSync(req.file.path, 'utf8');

    let segments = [];

    // Generic parsing logic
    if (segments.length === 0) {
        const lines = content.split(/\r?\n/);
        const timestampRegex = /\[?\(?(\d{1,2}:\d{2}(?::\d{2})?)\)?\]?\s*([A-Za-z0-9 ]+?):\s*(.+)/;

        segments = lines.map(line => {
            // Remove potential RTF artifacts if simple
            const cleanLine = line.replace(/\\par/g, '').trim();
            if (!cleanLine) return null;

            const match = cleanLine.match(timestampRegex);
            if (match) {
                const timeStr = match[1];
                const speaker = match[2].trim();
                const text = match[3].trim();

                // Convert time to seconds
                const parts = timeStr.split(':').map(Number);
                let seconds = 0;
                if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
                else seconds = parts[0] * 60 + parts[1];

                return {
                    speaker,
                    start: seconds,
                    end: seconds + 30, // Estimate end time if not given
                    text
                };
            }
            return null;
        }).filter(s => s !== null);
    }

    // Fallback: treat as plain text chunk if no timestamps found
    if (segments.length === 0) {
        // Strip RTF header junk if present
        const strippedContent = content.replace(/\{\\rtf1.+?\n/s, '').replace(/\\[a-z0-9]+/g, ' ').trim();

        segments = [{
            speaker: 'Unknown',
            start: 0,
            end: 0,
            text: strippedContent.substring(0, 50000) // Limit size
        }];
    }

    // Create meeting record
    const meeting = new Meeting({
      title: req.body.title || `Imported Transcript ${new Date().toLocaleDateString()}`,
      status: 'uploading',
      audioPath: null, // No audio
      originalFilename: req.file.originalname,
      fileSize: req.file.size,
      jobId
    });

    await meeting.save();

    // Save transcript immediately
    await Transcript.create({
        meetingId: meeting._id,
        segments,
        speakers: [...new Set(segments.map(s => s.speaker))],
        duration: 0
    });

    // Enqueue processing job (extraction only)
    await enqueueProcessingJob({
      jobId,
      meetingId: meeting._id.toString(),
      audioPath: null,
      type: 'transcript-only'
    });

    console.log(`[Upload] Transcript imported: ${meeting._id}, Job: ${jobId}`);

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
 * Get summary and action items for a meeting (raw LLM format)
 */
export const getSummary = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const summary = await Summary.findOne({ meetingId });

    if (!summary) {
      return res.status(404).json({ message: 'Summary not found' });
    }

    // Return raw LLM format
    res.json({
      summary: summary.executive,
      tasks: summary.actionItems
    });

  } catch (error) {
    console.error('[Summary] Error:', error);
    res.status(500).json({ message: 'Failed to fetch summary' });
  }
};

/**
 * POST /api/meetings/:meetingId/tasks
 * Update confirmed tasks and trigger n8n workflow
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

    // Trigger n8n webhook with the confirmed tasks
    try {
      const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook-test/confirm-tasks';

      const webhookResponse = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          meetingId,
          tasks,
          confirmedAt: new Date().toISOString()
        }),
      });

      if (webhookResponse.ok) {
        console.log(`[Tasks] n8n webhook triggered successfully for meeting: ${meetingId}`);
      } else {
        console.warn(`[Tasks] n8n webhook returned status: ${webhookResponse.status}`);
      }
    } catch (webhookError) {
      // Log but don't fail the request if webhook fails
      console.error('[Tasks] n8n webhook error:', webhookError.message);
    }

    res.json({ success: true });

  } catch (error) {
    console.error('[Tasks] Error:', error);
    res.status(500).json({ message: 'Failed to update tasks' });
  }
};

/**
 * POST /api/meetings/:meetingId/tasks/:taskId/confirm
 * Confirm and update a single task, then trigger n8n workflow with enriched data
 */
export const confirmSingleTask = async (req, res) => {
  try {
    const { meetingId, taskId } = req.params;
    const { task } = req.body;

    // Find the summary and update the specific task
    const summary = await Summary.findOne({ meetingId });
    if (!summary) {
      return res.status(404).json({ message: 'Summary not found' });
    }

    // Update the specific task in actionItems array
    const taskIndex = summary.actionItems.findIndex(t => t._id.toString() === taskId);
    if (taskIndex === -1) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Merge the updated task data
    summary.actionItems[taskIndex] = {
      ...summary.actionItems[taskIndex].toObject(),
      ...task,
      confirmed: true
    };
    summary.updatedAt = Date.now();
    await summary.save();

    const confirmedTask = summary.actionItems[taskIndex];
    console.log(`[Tasks] Confirmed single task: ${confirmedTask.title} for meeting: ${meetingId}`);

    // Map assignee name to service IDs
    const { mapAssigneeToServiceIds } = await import('./teamMembersController.js');
    const assigneeName = confirmedTask.assignee?.name || confirmedTask.owner || 'Unassigned';
    const assigneeMapping = await mapAssigneeToServiceIds(assigneeName);

    // Enrich task with service IDs for n8n
    const enrichedTask = {
      ...confirmedTask.toObject ? confirmedTask.toObject() : confirmedTask,
      assigneeMapping // Contains atlassianEmail, googleEmail, slackUserId, slackMention
    };

    console.log(`[Tasks] Enriched task with mapping:`, assigneeMapping);

    // Trigger n8n webhook with the enriched task
    try {
      const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook-test/confirm-tasks';

      const webhookResponse = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          meetingId,
          tasks: [enrichedTask],
          confirmedAt: new Date().toISOString(),
          singleTask: true
        }),
      });

      if (webhookResponse.ok) {
        console.log(`[Tasks] n8n webhook triggered for single task: ${confirmedTask.title}`);
      } else {
        console.warn(`[Tasks] n8n webhook returned status: ${webhookResponse.status}`);
      }
    } catch (webhookError) {
      console.error('[Tasks] n8n webhook error:', webhookError.message);
    }

    res.json({ success: true, task: confirmedTask });

  } catch (error) {
    console.error('[Tasks] Error:', error);
    res.status(500).json({ message: 'Failed to confirm task' });
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
  uploadTranscript,
  getTranscript,
  getSummary,
  updateTasks,
  confirmSingleTask
};
