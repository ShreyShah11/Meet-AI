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
import { canManageTeam } from '../middleware/auth.js';

const router = Router();

// GET /api/team-members - Get all team members
router.get('/', canManageTeam, getAllTeamMembers);

// GET /api/team-members/:id - Get single team member
router.get('/:id', canManageTeam, getTeamMember);

// POST /api/team-members - Create team member
router.post('/', canManageTeam, createTeamMember);

// PUT /api/team-members/:id - Update team member
router.put('/:id', canManageTeam, updateTeamMember);

// DELETE /api/team-members/:id - Delete team member
router.delete('/:id', canManageTeam, deleteTeamMember);

export default router;
