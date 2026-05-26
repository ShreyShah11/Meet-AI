import { User, ROLES } from '../models/index.js';
import { hashPassword } from '../utils/auth.js';

const safeUser = (user) => {
  const data = user.toObject ? user.toObject() : user;
  delete data.passwordHash;
  return data;
};

export const getUsers = async (req, res) => {
  try {
    const users = await User.find({ organizationId: req.organizationId })
      .select('-passwordHash')
      .sort({ createdAt: 1 });
    res.json(users);
  } catch (error) {
    console.error('[Users] Fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
};

export const createUser = async (req, res) => {
  try {
    const { name, email, password, role = 'member' } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and temporary password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    if (!ROLES.includes(role) || role === 'owner') {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ message: 'A user with this email already exists' });
    }

    const user = await User.create({
      organizationId: req.organizationId,
      name,
      email,
      passwordHash: hashPassword(password),
      role
    });

    res.status(201).json(safeUser(user));
  } catch (error) {
    console.error('[Users] Create error:', error);
    res.status(500).json({ message: 'Failed to create user' });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { name, role, status, password } = req.body;
    const targetUser = await User.findOne({
      _id: req.params.id,
      organizationId: req.organizationId
    });

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (targetUser.role === 'owner' && targetUser._id.toString() !== req.user._id.toString()) {
      return res.status(400).json({ message: 'Owner accounts cannot be changed by another user' });
    }

    if (role && (!ROLES.includes(role) || (role === 'owner' && req.user.role !== 'owner'))) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    if (name) targetUser.name = name;
    if (role) targetUser.role = role;
    if (status && ['active', 'disabled'].includes(status)) targetUser.status = status;
    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters' });
      }
      targetUser.passwordHash = hashPassword(password);
    }

    await targetUser.save();
    res.json(safeUser(targetUser));
  } catch (error) {
    console.error('[Users] Update error:', error);
    res.status(500).json({ message: 'Failed to update user' });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const targetUser = await User.findOne({
      _id: req.params.id,
      organizationId: req.organizationId
    });

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (targetUser._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    if (targetUser.role === 'owner') {
      return res.status(400).json({ message: 'Owner accounts cannot be deleted' });
    }

    await targetUser.deleteOne();
    res.json({ success: true });
  } catch (error) {
    console.error('[Users] Delete error:', error);
    res.status(500).json({ message: 'Failed to delete user' });
  }
};

export default { getUsers, createUser, updateUser, deleteUser };
