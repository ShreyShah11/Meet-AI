/**
 * Meetings Routes
 * /api/meetings/*
 */
import { Router } from 'express';
import { upload } from '../utils/upload.js';
import {
  uploadMeeting,
  getTranscript,
  getSummary,
  updateTasks
} from '../controllers/meetingsController.js';

const router = Router();

// POST /api/meetings/upload - Upload audio file
router.post('/upload', upload.single('audio'), uploadMeeting);

// GET /api/meetings/:meetingId/transcript - Get transcript
router.get('/:meetingId/transcript', getTranscript);

// GET /api/meetings/:meetingId/summary - Get summary
router.get('/:meetingId/summary', getSummary);

// POST /api/meetings/:meetingId/tasks - Update tasks
router.post('/:meetingId/tasks', updateTasks);

export default router;
