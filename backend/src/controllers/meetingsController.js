/**
 * Meetings Controller
 * Handles meeting-related API requests
 */
import { v4 as uuidv4 } from 'uuid';
import { Meeting, Transcript, Summary, TeamMember, User } from '../models/index.js';
import { enqueueProcessingJob } from '../queue/index.js';
import { vectorService } from '../services/index.js';

const isAdmin = (user) => user?.role === 'admin';

const getAccessibleMeetingQuery = (req, meetingId) => {
  const base = { _id: meetingId, organizationId: req.organizationId };
  if (isAdmin(req.user)) return base;
  return {
    ...base,
    accessibleUsers: req.user._id
  };
};

const formatMeetingForMember = (meeting) => ({
  _id: meeting._id,
  title: meeting.title,
  originalFilename: meeting.originalFilename,
  status: meeting.status,
  createdAt: meeting.createdAt,
  updatedAt: meeting.updatedAt,
  vectorStatus: meeting.vectorStatus,
  vectorChunkCount: meeting.vectorChunkCount
});

const resolveAccessibleUsers = async (organizationId, teamMemberIds = []) => {
  if (!Array.isArray(teamMemberIds) || teamMemberIds.length === 0) {
    return [];
  }

  const teamMembers = await TeamMember.find({
    _id: { $in: teamMemberIds },
    organizationId
  });

  const emails = teamMembers
    .flatMap((member) => [member.googleEmail, member.atlassianEmail])
    .filter(Boolean)
    .map((email) => email.toLowerCase());

  const names = teamMembers.map((member) => member.name);
  const users = await User.find({
    organizationId,
    role: 'member',
    $or: [
      { email: { $in: emails } },
      { googleEmail: { $in: emails } },
      { atlassianEmail: { $in: emails } },
      { jiraEmail: { $in: emails } },
      { name: { $in: names } }
    ]
  }).select('_id');

  return users.map((user) => user._id);
};

const getMemberServicePayload = (member) => ({
  assignedTeamMemberId: member._id.toString(),
  atlassianEmail: member.atlassianEmail || null,
  googleEmail: member.googleEmail || null,
  slackUserId: member.slackUserId || null,
  slackDisplayName: member.slackDisplayName || null,
  slackMention: member.slackUserId ? `<@${member.slackUserId}>` : null,
  assigneeMapping: {
    name: member.name,
    atlassianEmail: member.atlassianEmail || null,
    googleEmail: member.googleEmail || null,
    slackUserId: member.slackUserId || null,
    slackMention: member.slackUserId ? `<@${member.slackUserId}>` : null
  }
});

const normalizeName = (name = '') => String(name).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const compactName = (name = '') => normalizeName(name).replace(/\s/g, '');
const getNameTokens = (name = '') => normalizeName(name).split(' ').filter(Boolean);

const levenshteinDistance = (left = '', right = '') => {
  const a = compactName(left);
  const b = compactName(right);
  if (!a) return b.length;
  if (!b) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const previous = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      diagonal = previous;
    }
  }
  return row[b.length];
};

const diceCoefficient = (left = '', right = '') => {
  const a = compactName(left);
  const b = compactName(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length === 1 || b.length === 1) return a[0] === b[0] ? 0.6 : 0;

  const pairs = new Map();
  for (let i = 0; i < a.length - 1; i += 1) {
    const pair = a.slice(i, i + 2);
    pairs.set(pair, (pairs.get(pair) || 0) + 1);
  }

  let overlap = 0;
  for (let i = 0; i < b.length - 1; i += 1) {
    const pair = b.slice(i, i + 2);
    const count = pairs.get(pair) || 0;
    if (count > 0) {
      overlap += 1;
      pairs.set(pair, count - 1);
    }
  }

  return (2 * overlap) / (a.length + b.length - 2);
};

const buildMemberNameVariants = (member) => {
  const variants = new Set();
  const addNameParts = (value) => {
    const normalized = normalizeName(value);
    const tokens = getNameTokens(value);
    if (!normalized) return;

    variants.add(normalized);
    variants.add(compactName(normalized));
    tokens.forEach((token) => {
      variants.add(token);
      for (let length = 2; length <= Math.min(token.length, 5); length += 1) {
        variants.add(token.slice(0, length));
      }
    });
    if (tokens.length > 1) {
      variants.add(tokens.map((token) => token[0]).join(''));
    }
  };

  addNameParts(member.name);
  (member.aliases || []).forEach(addNameParts);
  [member.googleEmail, member.atlassianEmail].filter(Boolean).forEach((email) => {
    addNameParts(String(email).split('@')[0].replace(/[._-]/g, ' '));
  });

  return [...variants].filter(Boolean);
};

const scoreNameMatch = (inputName, member) => {
  const queryCompact = compactName(inputName);
  const queryTokens = getNameTokens(inputName);
  if (!queryCompact) return 0;

  let bestScore = 0;
  const variants = buildMemberNameVariants(member);
  const memberTokens = getNameTokens(member.name);
  const initials = memberTokens.map((token) => token[0]).join('');

  if (queryCompact === compactName(member.name)) return 1;
  if (memberTokens.some((token) => token === queryCompact)) bestScore = Math.max(bestScore, 0.98);
  if (initials && initials === queryCompact) bestScore = Math.max(bestScore, 0.94);

  for (const token of memberTokens) {
    if (queryCompact.length >= 2 && token.startsWith(queryCompact)) bestScore = Math.max(bestScore, 0.93);
    if (queryCompact.length >= 3 && queryCompact.startsWith(token)) bestScore = Math.max(bestScore, 0.86);
  }

  for (const variant of variants) {
    const variantCompact = compactName(variant);
    if (!variantCompact) continue;
    if (variantCompact === queryCompact) bestScore = Math.max(bestScore, 1);
    if (queryCompact.length >= 2 && variantCompact.startsWith(queryCompact)) bestScore = Math.max(bestScore, 0.92);
    if (queryCompact.length >= 3 && variantCompact.includes(queryCompact)) bestScore = Math.max(bestScore, 0.88);

    const maxLength = Math.max(queryCompact.length, variantCompact.length);
    const editSimilarity = 1 - (levenshteinDistance(queryCompact, variantCompact) / maxLength);
    const phoneticSimilarity = diceCoefficient(queryCompact, variantCompact);
    bestScore = Math.max(bestScore, (editSimilarity * 0.45) + (phoneticSimilarity * 0.55));
  }

  if (queryTokens.length > 1) {
    const tokenHits = queryTokens.filter((token) => (
      memberTokens.some((memberToken) => memberToken === token || memberToken.startsWith(token) || token.startsWith(memberToken))
    )).length;
    bestScore = Math.max(bestScore, tokenHits / queryTokens.length);
  }

  return bestScore;
};

const getTaskAssigneeName = (task) => {
  if (task.assignee?.name && task.assignee.name !== 'unknown') return task.assignee.name;
  if (task.owner && task.owner !== 'unknown') return task.owner;
  return '';
};

const findClosestTeamMember = (name, members) => {
  const normalizedInput = compactName(name);
  if (!normalizedInput || normalizedInput === 'unassigned') return null;

  let bestMatch = null;
  let bestScore = 0;
  for (const member of members) {
    const score = scoreNameMatch(name, member);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = member;
    }
  }

  const minimumScore = normalizedInput.length <= 3 ? 0.78 : 0.68;
  return bestScore >= minimumScore ? bestMatch : null;
};

const enrichTasksWithTeamMembers = async (tasks = [], organizationId) => {
  const memberIds = tasks
    .map((task) => task.assignedTeamMemberId)
    .filter(Boolean);

  const members = await TeamMember.find({
    organizationId
  });
  const memberById = new Map(members.map((member) => [member._id.toString(), member]));

  return tasks.map((task) => {
    const member = task.assignedTeamMemberId
      ? memberById.get(task.assignedTeamMemberId?.toString())
      : findClosestTeamMember(getTaskAssigneeName(task), members);
    if (!member) return task;

    return {
      ...task,
      assignee: {
        ...(task.assignee || {}),
        name: member.name
      },
      owner: member.name,
      ...getMemberServicePayload(member)
    };
  });
};

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
      organizationId: req.organizationId,
      createdBy: req.user._id,
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

    // 1. Try JSON parsing first
    try {
      const jsonData = JSON.parse(content);

      const parseTime = (val) => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string' && val.includes(':')) {
          const parts = val.split(':').map(Number);
          if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
          if (parts.length === 2) return parts[0] * 60 + parts[1];
        }
        return 0;
      };

      let list = [];
      if (Array.isArray(jsonData)) {
        list = jsonData;
      } else if (jsonData && typeof jsonData === 'object') {
        list = jsonData.transcript || jsonData.segments || [];
      }

      if (Array.isArray(list) && list.length > 0) {
        segments = list.map(s => ({
          speaker: s.speaker || 'Unknown',
          start: parseTime(s.start),
          end: parseTime(s.end) || (parseTime(s.start) + 30),
          text: s.text || ''
        }));
        console.log(`[Upload] Parsed ${segments.length} segments from JSON`);
        if (segments.length > 0) {
          console.log('[Upload] First segment sample:', JSON.stringify(segments[0], null, 2));
        }
      }
    } catch (e) {
      console.log('[Upload] Not a standard JSON transcript, falling back to text parsing');
    }

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
      organizationId: req.organizationId,
      createdBy: req.user._id,
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
      organizationId: req.organizationId,
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

export const getMemberMeetings = async (req, res) => {
  try {
    const meetings = await Meeting.find({
      organizationId: req.organizationId,
      accessibleUsers: req.user._id,
      status: 'done'
    })
      .sort({ createdAt: -1 })
      .select('title originalFilename status createdAt updatedAt vectorStatus vectorChunkCount');

    res.json(meetings.map(formatMeetingForMember));
  } catch (error) {
    console.error('[Meetings] Member dashboard error:', error);
    res.status(500).json({ message: 'Failed to fetch accessible meetings' });
  }
};

/**
 * GET /api/meetings/:meetingId/transcript
 * Get transcript for a meeting
 */
export const getTranscript = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const meeting = await Meeting.findOne(getAccessibleMeetingQuery(req, meetingId));
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    const transcript = await Transcript.findOne({ meetingId, organizationId: req.organizationId });

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

    const meeting = await Meeting.findOne(getAccessibleMeetingQuery(req, meetingId));
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    const summary = await Summary.findOne({ meetingId, organizationId: req.organizationId });

    if (!summary) {
      return res.status(404).json({ message: 'Summary not found' });
    }

    const tasks = summary.actionItems.map((task) => (
      task.toObject ? task.toObject() : task
    ));
    const enrichedTasks = await enrichTasksWithTeamMembers(tasks, req.organizationId);

    // Return raw LLM format with backend-resolved team member mappings
    res.json({
      summary: summary.executive,
      tasks: enrichedTasks
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
    const { tasks, accessibleTeamMemberIds = [] } = req.body;

    const meeting = await Meeting.findOne({ _id: meetingId, organizationId: req.organizationId });
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    const enrichedTasks = await enrichTasksWithTeamMembers(tasks || [], req.organizationId);

    await Summary.findOneAndUpdate(
      { meetingId, organizationId: req.organizationId },
      { actionItems: enrichedTasks, updatedAt: Date.now() }
    );

    const accessibleUsers = await resolveAccessibleUsers(req.organizationId, accessibleTeamMemberIds);
    meeting.accessibleTeamMembers = accessibleTeamMemberIds;
    meeting.accessibleUsers = accessibleUsers;
    await meeting.save();

    console.log(`[Tasks] Updated ${enrichedTasks?.length || 0} tasks for meeting: ${meetingId}`);

    const transcriptForVectors = await Transcript.findOne({ meetingId, organizationId: req.organizationId });
    let vectorResult = null;
    if (transcriptForVectors) {
      vectorResult = await vectorService.indexTranscript({ meeting, transcript: transcriptForVectors });
      console.log(`[Tasks] Vector indexing completed for meeting ${meetingId}: ${vectorResult.status || vectorResult.vectorStatus}`);
    } else {
      console.warn(`[Tasks] No transcript found for vector indexing: ${meetingId}`);
    }

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
          tasks: enrichedTasks,
          accessibleTeamMemberIds,
          accessibleUserIds: accessibleUsers.map((id) => id.toString()),
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

    res.json({ success: true, vectorStatus: vectorResult?.status || vectorResult?.vectorStatus || meeting.vectorStatus });

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
    const [incomingTask] = await enrichTasksWithTeamMembers([task || {}], req.organizationId);

    // Find the summary and update the specific task
    const meeting = await Meeting.findOne({ _id: meetingId, organizationId: req.organizationId });
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    const summary = await Summary.findOne({ meetingId, organizationId: req.organizationId });
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
      ...incomingTask,
      confirmed: true
    };
    summary.updatedAt = Date.now();
    await summary.save();

    const confirmedTask = summary.actionItems[taskIndex];
    console.log(`[Tasks] Confirmed single task: ${confirmedTask.title} for meeting: ${meetingId}`);

    // Map assignee name to service IDs
    const { mapAssigneeToServiceIds } = await import('./teamMembersController.js');
    const assigneeName = confirmedTask.assignee?.name || confirmedTask.owner || 'Unassigned';
    const assigneeMapping = await mapAssigneeToServiceIds(assigneeName, req.organizationId);

    // Enrich task with service IDs for n8n
    const confirmedTaskObject = confirmedTask.toObject ? confirmedTask.toObject() : confirmedTask;
    const enrichedTask = {
      ...confirmedTaskObject,
      ...assigneeMapping,
      assigneeMapping
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

export const chatWithMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { question } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ message: 'Question is required' });
    }

    const meeting = await Meeting.findOne(getAccessibleMeetingQuery(req, meetingId));
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    let matches = [];
    let ragSource = 'none';

    // Prefer the Python RAG pipeline (Gemini embeddings + Pinecone + cross-encoder reranking)
    // if the meeting has been indexed through it (vectorIndexName set by the new pipeline)
    if (meeting.vectorIndexName && meeting.vectorStatus === 'indexed') {
      try {
        const botPort = process.env.BOT_PORT || 5001;
        const retrieveResponse = await fetch(`http://127.0.0.1:${botPort}/retrieve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: question,
            meet_id: meetingId.toString(),
            index_name: meeting.vectorIndexName,
            top_k: 8
          })
        });
        if (retrieveResponse.ok) {
          matches = await retrieveResponse.json();
          ragSource = 'python-pipeline';
          console.log(`[Meetings] Python RAG retrieved ${matches.length} chunks`);
        } else {
          console.warn(`[Meetings] Python retrieve returned ${retrieveResponse.status}, falling back to JS vectorService`);
        }
      } catch (err) {
        console.warn(`[Meetings] Python pipeline retrieve error: ${err.message}, falling back to JS vectorService`);
      }
    }

    // Fallback: JS vectorService (keyword search in MongoDB, or Pinecone via OpenAI embeddings)
    if (matches.length === 0) {
      const jsFallback = await vectorService.retrieve(meeting, question);
      matches = jsFallback;
      ragSource = 'js-vectorservice';
      console.log(`[Meetings] JS vectorService retrieved ${matches.length} chunks`);
    }

    const context = matches
      .filter((match) => match.text)
      .map((match, index) => {
        const meta = match.metadata || {};
        const startTime = meta.startTime || meta.timestamp_start;
        const endTime = meta.endTime || meta.timestamp_end;
        const source = startTime
          ? `Source ${index + 1} (${startTime} - ${endTime || 'unknown'})`
          : `Source ${index + 1}`;
        return `${source}\n${match.text}`;
      })
      .join('\n\n');

    const answer = context
      ? await vectorService.answerWithGemini(question, context)
      : 'I could not find enough transcript context for that question.';

    res.json({
      answer,
      sources: matches.map((match) => ({
        score: match.score,
        text: match.text,
        metadata: match.metadata
      })),
      vectorStatus: meeting.vectorStatus,
      ragSource
    });
  } catch (error) {
    console.error('[Meetings] Chat error:', error);
    res.status(500).json({ message: 'Failed to chat with meeting' });
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
  getMemberMeetings,
  getTranscript,
  getSummary,
  updateTasks,
  confirmSingleTask,
  chatWithMeeting
};
