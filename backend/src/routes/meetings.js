/**
 * Meetings Routes
 * /api/meetings/*
 */
import { Router } from 'express';
import { upload } from '../utils/upload.js';
import {
  uploadMeeting,
  uploadTranscript,
  getMemberMeetings,
  getTranscript,
  getSummary,
  updateTasks,
  confirmSingleTask,
  chatWithMeeting
} from '../controllers/meetingsController.js';
import { canConfirmTasks, canManageMeetings, requireAdmin } from '../middleware/auth.js';

const router = Router();

// POST /api/meetings/upload - Upload audio file
router.post('/upload', canManageMeetings, upload.single('audio'), uploadMeeting);

// POST /api/meetings/upload-transcript - Upload transcript file
router.post('/upload-transcript', canManageMeetings, upload.single('transcript'), uploadTranscript);

// GET /api/meetings/:meetingId/transcript - Get transcript
router.get('/:meetingId/transcript', getTranscript);

// GET /api/meetings/:meetingId/summary - Get summary
router.get('/:meetingId/summary', requireAdmin, getSummary);

// GET /api/meetings/member-dashboard - Get meetings shared with current team member
router.get('/member-dashboard/list', getMemberMeetings);

// POST /api/meetings/:meetingId/chat - Ask questions over the meeting transcript
router.post('/:meetingId/chat', chatWithMeeting);

// POST /api/meetings/:meetingId/tasks - Update all tasks
router.post('/:meetingId/tasks', canConfirmTasks, updateTasks);

// POST /api/meetings/:meetingId/tasks/:taskId/confirm - Confirm single task
router.post('/:meetingId/tasks/:taskId/confirm', canConfirmTasks, confirmSingleTask);

export default router;
