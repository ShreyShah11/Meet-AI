import { Router } from 'express';
import { createOrganization, createOwnerUser, createUser, signup, login, getMe, deleteOrganization } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// New role-based endpoints
router.post('/create-organization', createOrganization);
router.post('/create-owner-user', createOwnerUser);
router.post('/create-user', createUser);

// Delete organization
router.delete('/organization/:organizationId', deleteOrganization);

// Legacy endpoint
router.post('/signup', signup);

// Login endpoint (works for both owner and regular users)
router.post('/login', login);

// Get current user info
router.get('/me', requireAuth, getMe);

export default router;
