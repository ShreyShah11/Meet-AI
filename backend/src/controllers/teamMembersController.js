/**
 * TeamMembers Controller
 * CRUD operations for team member service mappings
 */
import { TeamMember, User } from '../models/index.js';

const syncTeamMembersFromUsers = async (organizationId) => {
  const users = await User.find({ organizationId, status: 'active' });

  await Promise.all(users.map(async (user) => {
    const existingMember = await TeamMember.findOne({
      organizationId: user.organizationId,
      name: user.name
    });

    if (!existingMember) {
      await TeamMember.create({
        organizationId: user.organizationId,
        name: user.name,
        aliases: [],
        atlassianEmail: user.atlassianEmail || user.jiraEmail || null,
        googleEmail: user.googleEmail || null,
        slackUserId: user.slackUserId || null,
        slackDisplayName: user.slackDisplayName || null
      });
      return;
    }

    let hasChanges = false;

    if (!existingMember.atlassianEmail && (user.atlassianEmail || user.jiraEmail)) {
      existingMember.atlassianEmail = user.atlassianEmail || user.jiraEmail;
      hasChanges = true;
    }

    if (!existingMember.googleEmail && user.googleEmail) {
      existingMember.googleEmail = user.googleEmail;
      hasChanges = true;
    }

    if (!existingMember.slackUserId && user.slackUserId) {
      existingMember.slackUserId = user.slackUserId;
      hasChanges = true;
    }

    if (!existingMember.slackDisplayName && user.slackDisplayName) {
      existingMember.slackDisplayName = user.slackDisplayName;
      hasChanges = true;
    }

    if (hasChanges) {
      existingMember.updatedAt = Date.now();
      await existingMember.save();
    }
  }));
};

/**
 * GET /api/team-members
 * Get all team members
 */
export const getAllTeamMembers = async (req, res) => {
  try {
    await syncTeamMembersFromUsers(req.organizationId);
    const members = await TeamMember.find({ organizationId: req.organizationId }).sort({ name: 1 });
    res.json(members);
  } catch (error) {
    console.error('[TeamMembers] Error fetching:', error);
    res.status(500).json({ message: 'Failed to fetch team members' });
  }
};

/**
 * GET /api/team-members/:id
 * Get single team member
 */
export const getTeamMember = async (req, res) => {
  try {
    const member = await TeamMember.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!member) {
      return res.status(404).json({ message: 'Team member not found' });
    }
    res.json(member);
  } catch (error) {
    console.error('[TeamMembers] Error fetching:', error);
    res.status(500).json({ message: 'Failed to fetch team member' });
  }
};

/**
 * POST /api/team-members
 * Create new team member
 */
export const createTeamMember = async (req, res) => {
  try {
    const { name, aliases, atlassianEmail, googleEmail, slackUserId, slackDisplayName } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    // Check for duplicate name
    const existing = await TeamMember.findOne({
      organizationId: req.organizationId,
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });
    if (existing) {
      return res.status(400).json({ message: 'Team member with this name already exists' });
    }

    const member = new TeamMember({
      organizationId: req.organizationId,
      name,
      aliases: aliases || [],
      atlassianEmail,
      googleEmail,
      slackUserId,
      slackDisplayName
    });

    await member.save();
    console.log(`[TeamMembers] Created: ${name}`);
    res.status(201).json(member);
  } catch (error) {
    console.error('[TeamMembers] Error creating:', error);
    res.status(500).json({ message: 'Failed to create team member' });
  }
};

/**
 * PUT /api/team-members/:id
 * Update team member
 */
export const updateTeamMember = async (req, res) => {
  try {
    const { aliases, atlassianEmail, googleEmail, slackUserId, slackDisplayName } = req.body;

    const member = await TeamMember.findOne({ _id: req.params.id, organizationId: req.organizationId });

    if (!member) {
      return res.status(404).json({ message: 'Team member not found' });
    }

    if (aliases !== undefined) {
      member.aliases = Array.isArray(aliases)
        ? aliases.filter(Boolean)
        : [];
    }

    member.atlassianEmail = atlassianEmail || null;
    member.googleEmail = googleEmail || null;
    member.slackUserId = slackUserId || null;
    member.slackDisplayName = slackDisplayName || null;
    member.updatedAt = Date.now();
    await member.save();

    console.log(`[TeamMembers] Updated: ${member.name}`);
    res.json(member);
  } catch (error) {
    console.error('[TeamMembers] Error updating:', error);
    res.status(500).json({ message: 'Failed to update team member' });
  }
};

/**
 * DELETE /api/team-members/:id
 * Delete team member
 */
export const deleteTeamMember = async (req, res) => {
  try {
    const member = await TeamMember.findOneAndDelete({ _id: req.params.id, organizationId: req.organizationId });

    if (!member) {
      return res.status(404).json({ message: 'Team member not found' });
    }

    console.log(`[TeamMembers] Deleted: ${member.name}`);
    res.json({ success: true, message: 'Team member deleted' });
  } catch (error) {
    console.error('[TeamMembers] Error deleting:', error);
    res.status(500).json({ message: 'Failed to delete team member' });
  }
};

/**
 * Helper: Map assignee name to service IDs
 * Used before sending to n8n
 */
export const mapAssigneeToServiceIds = async (assigneeName, organizationId) => {
  if (!assigneeName || assigneeName === 'Unassigned') {
    return {
      name: assigneeName || 'Unassigned',
      atlassianEmail: null,
      googleEmail: null,
      slackUserId: null
    };
  }

  const member = await TeamMember.findByNameOrAlias(assigneeName, organizationId);

  if (member) {
    return {
      name: member.name,
      atlassianEmail: member.atlassianEmail || null,
      googleEmail: member.googleEmail || null,
      slackUserId: member.slackUserId || null,
      slackMention: member.slackUserId ? `<@${member.slackUserId}>` : null
    };
  }

  // Not found in DB, return original name
  return {
    name: assigneeName,
    atlassianEmail: null,
    googleEmail: null,
    slackUserId: null
  };
};

export default {
  getAllTeamMembers,
  getTeamMember,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
  mapAssigneeToServiceIds
};
