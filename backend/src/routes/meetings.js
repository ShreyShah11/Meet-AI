/**
 * Meetings Routes
 * /api/meetings/*
 */
import { Router } from 'express';
import { upload } from '../utils/upload.js';
import {
  uploadMeeting,
  uploadTranscript,
  getTranscript,
  getSummary,
  updateTasks,
  confirmSingleTask
} from '../controllers/meetingsController.js';
import { canConfirmTasks, canManageMeetings } from '../middleware/auth.js';

const router = Router();

// POST /api/meetings/upload - Upload audio file
router.post('/upload', canManageMeetings, upload.single('audio'), uploadMeeting);

// POST /api/meetings/upload-transcript - Upload transcript file
router.post('/upload-transcript', canManageMeetings, upload.single('transcript'), uploadTranscript);

// GET /api/meetings/:meetingId/transcript - Get transcript
router.get('/:meetingId/transcript', getTranscript);

// GET /api/meetings/:meetingId/summary - Get summary
router.get('/:meetingId/summary', getSummary);

// POST /api/meetings/:meetingId/tasks - Update all tasks
router.post('/:meetingId/tasks', canConfirmTasks, updateTasks);

// POST /api/meetings/:meetingId/tasks/:taskId/confirm - Confirm single task
router.post('/:meetingId/tasks/:taskId/confirm', canConfirmTasks, confirmSingleTask);

export default router;
