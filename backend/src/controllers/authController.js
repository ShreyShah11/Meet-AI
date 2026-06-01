import { Organization, TeamMember, User } from '../models/index.js';
import { hashPassword, signToken, verifyPassword } from '../utils/auth.js';

const buildSession = (user) => ({
  token: signToken({
    userId: user._id.toString(),
    organizationId: user.organizationId.toString(),
    role: user.role
  }),
  user: user.toSafeObject ? user.toSafeObject() : user
});

const syncTeamMemberForUser = async (user) => {
  await TeamMember.findOneAndUpdate(
    {
      organizationId: user.organizationId,
      name: user.name
    },
    {
      $setOnInsert: {
        organizationId: user.organizationId,
        name: user.name,
        aliases: []
      },
      $set: {
        atlassianEmail: user.atlassianEmail || user.jiraEmail || null,
        googleEmail: user.googleEmail || null,
        slackUserId: user.slackUserId || null,
        slackDisplayName: user.slackDisplayName || null,
        updatedAt: Date.now()
      }
    },
    { upsert: true, new: true, runValidators: true }
  );
};

/**
 * POST /auth/create-organization
 * Create a new organization (first step)
 */
export const createOrganization = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Organization name is required' });
    }

    const organization = await Organization.create({ name: name.trim() });

    console.log(`[Auth] Organization created: ${name}`);
    res.status(201).json(organization);
  } catch (error) {
    console.error('[Auth] Create organization error:', error);
    res.status(500).json({ message: 'Failed to create organization' });
  }
};

/**
 * POST /auth/create-owner-user
 * Create owner/admin user for organization (second step)
 */
export const createOwnerUser = async (req, res) => {
  try {
    const { organizationId, name, email, password } = req.body;

    if (!organizationId || !name || !email || !password) {
      return res.status(400).json({ message: 'Organization ID, name, email, and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    // Verify organization exists
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    // Check if user with this email already exists
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ message: 'A user with this email already exists' });
    }

    const user = await User.create({
      organizationId,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash: hashPassword(password),
      role: 'owner'
    });
    await syncTeamMemberForUser(user);

    console.log(`[Auth] Owner user created: ${email}`);
    res.status(201).json({
      ...buildSession(user),
      organization
    });
  } catch (error) {
    console.error('[Auth] Create owner user error:', error);
    res.status(500).json({ message: 'Failed to create owner user' });
  }
};

/**
 * POST /auth/create-user
 * Create regular user with integration details
 */
export const createUser = async (req, res) => {
  try {
    const { organizationId, name, email, password, jiraEmail, slackUserId, slackDisplayName, googleEmail, atlassianEmail } = req.body;

    if (!organizationId || !name || !email || !password) {
      return res.status(400).json({ message: 'Organization ID, name, email, and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    // Verify organization exists
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    // Check if user with this email already exists
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ message: 'A user with this email already exists' });
    }

    const user = await User.create({
      organizationId,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash: hashPassword(password),
      role: 'member',
      jiraEmail: jiraEmail || null,
      slackUserId: slackUserId || null,
      slackDisplayName: slackDisplayName || null,
      googleEmail: googleEmail || null,
      atlassianEmail: atlassianEmail || null
    });
    await syncTeamMemberForUser(user);

    console.log(`[Auth] User created: ${email}`);
    res.status(201).json({
      ...buildSession(user),
      organization
    });
  } catch (error) {
    console.error('[Auth] Create user error:', error);
    res.status(500).json({ message: 'Failed to create user' });
  }
};

// Legacy signup endpoint - kept for backward compatibility
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
    await syncTeamMemberForUser(user);

    res.status(201).json({
      ...buildSession(user),
      organization
    });
  } catch (error) {
    console.error('[Auth] Signup error:', error);
    res.status(500).json({ message: 'Failed to create account' });
  }
};

/**
 * POST /auth/login
 * Login endpoint - works for both organization owners and regular users
 */
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

/**
 * DELETE /auth/organization/:organizationId
 * Delete an organization and all its users (admin only)
 */
export const deleteOrganization = async (req, res) => {
  try {
    const { organizationId } = req.params;

    if (!organizationId) {
      return res.status(400).json({ message: 'Organization ID is required' });
    }

    // Find the organization
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    // Delete all users in the organization
    await User.deleteMany({ organizationId });
    await TeamMember.deleteMany({ organizationId });

    // Delete the organization
    await Organization.findByIdAndDelete(organizationId);

    console.log(`[Auth] Organization deleted: ${organizationId}`);
    res.json({ message: 'Organization and all associated users deleted successfully' });
  } catch (error) {
    console.error('[Auth] Delete organization error:', error);
    res.status(500).json({ message: 'Failed to delete organization' });
  }
};

export default { createOrganization, createOwnerUser, createUser, signup, login, getMe, deleteOrganization };
