import { verifyToken } from '../utils/auth.js';
import { User } from '../models/index.js';

export const requireAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const payload = verifyToken(token);

    if (!payload?.userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const user = await User.findById(payload.userId).select('-passwordHash');
    if (!user || user.status !== 'active') {
      return res.status(401).json({ message: 'Authentication required' });
    }

    req.user = user;
    req.organizationId = user.organizationId;
    next();
  } catch (error) {
    console.error('[Auth] Error:', error);
    res.status(401).json({ message: 'Authentication required' });
  }
};

export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action' });
    }
    next();
  };
};

export const canManageUsers = requireRole('owner', 'admin');
export const canManageTeam = requireRole('owner', 'admin');
export const canManageMeetings = requireRole('owner', 'admin', 'manager');
export const canConfirmTasks = requireRole('owner', 'admin', 'manager');
