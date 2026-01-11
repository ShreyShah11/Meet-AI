/**
 * TeamMembers Routes
 * /api/team-members/*
 */
import { Router } from 'express';
import {
  getAllTeamMembers,
  getTeamMember,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember
} from '../controllers/teamMembersController.js';

const router = Router();

// GET /api/team-members - Get all team members
router.get('/', getAllTeamMembers);

// GET /api/team-members/:id - Get single team member
router.get('/:id', getTeamMember);

// POST /api/team-members - Create team member
router.post('/', createTeamMember);

// PUT /api/team-members/:id - Update team member
router.put('/:id', updateTeamMember);

// DELETE /api/team-members/:id - Delete team member
router.delete('/:id', deleteTeamMember);

export default router;
