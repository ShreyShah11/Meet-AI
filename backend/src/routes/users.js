import { Router } from 'express';
import { canManageUsers } from '../middleware/auth.js';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser
} from '../controllers/usersController.js';

const router = Router();

router.get('/', canManageUsers, getUsers);
router.post('/', canManageUsers, createUser);
router.put('/:id', canManageUsers, updateUser);
router.delete('/:id', canManageUsers, deleteUser);

export default router;
