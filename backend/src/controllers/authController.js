import { Organization, User } from '../models/index.js';
import { hashPassword, signToken, verifyPassword } from '../utils/auth.js';

const buildSession = (user) => ({
  token: signToken({
    userId: user._id.toString(),
    organizationId: user.organizationId.toString(),
    role: user.role
  }),
  user: user.toSafeObject ? user.toSafeObject() : user
});

export const signup = async (req, res) => {
  try {
    const { name, email, password, organizationName } = req.body;

    if (!name || !email || !password || !organizationName) {
      return res.status(400).json({ message: 'Name, email, password, and organization name are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ message: 'A user with this email already exists' });
    }

    const organization = await Organization.create({ name: organizationName });
    const user = await User.create({
      organizationId: organization._id,
      name,
      email,
      passwordHash: hashPassword(password),
      role: 'owner'
    });

    res.status(201).json({
      ...buildSession(user),
      organization
    });
  } catch (error) {
    console.error('[Auth] Signup error:', error);
    res.status(500).json({ message: 'Failed to create account' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || user.status !== 'active' || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    res.json(buildSession(user));
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({ message: 'Failed to log in' });
  }
};

export const getMe = async (req, res) => {
  res.json({ user: req.user });
};

export default { signup, login, getMe };
