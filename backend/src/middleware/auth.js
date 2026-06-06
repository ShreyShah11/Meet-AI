import { verifyToken } from '../utils/auth.js';
import { User } from '../models/index.js';

const normalizeRole = (role) => {
  if (role === 'admin' || role === 'owner' || role === 'manager') return 'admin';
  return 'member';
};

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

    const normalizedRole = normalizeRole(user.role);
    if (user.role !== normalizedRole) {
      await User.updateOne({ _id: user._id }, { role: normalizedRole, updatedAt: Date.now() });
      user.role = normalizedRole;
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

export const requireAdmin = requireRole('admin');
export const requireMember = requireRole('member');
export const canManageUsers = requireAdmin;
export const canManageTeam = requireAdmin;
export const canManageMeetings = requireAdmin;
export const canConfirmTasks = requireAdmin;
