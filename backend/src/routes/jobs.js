/**
 * Jobs Routes
 * /api/jobs/*
 */
import { Router } from 'express';
import { getJobStatus } from '../controllers/jobsController.js';

const router = Router();

// GET /api/jobs/:jobId/status - Get job status
router.get('/:jobId/status', getJobStatus);

export default router;
