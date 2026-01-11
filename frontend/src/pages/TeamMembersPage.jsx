import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getTeamMembers, createTeamMember, updateTeamMember, deleteTeamMember } from '../services/api';

/**
 * TeamMembersPage - Manage team member service mappings
 */
const TeamMembersPage = () => {
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state for new/edit member
  const [formData, setFormData] = useState({
    name: '',
    atlassianEmail: '',
    googleEmail: '',
    slackUserId: '',
    slackDisplayName: ''
  });

  // Fetch members on mount
  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      setIsLoading(true);
      const data = await getTeamMembers();
      setMembers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setFormData({
      name: '',
      atlassianEmail: '',
      googleEmail: '',
      slackUserId: '',
      slackDisplayName: ''
    });
  };

  const handleEdit = (member) => {
    setEditingId(member._id);
    setIsAdding(false);
    setFormData({
      name: member.name,
      atlassianEmail: member.atlassianEmail || '',
      googleEmail: member.googleEmail || '',
      slackUserId: member.slackUserId || '',
      slackDisplayName: member.slackDisplayName || ''
    });
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({
      name: '',
      atlassianEmail: '',
      googleEmail: '',
      slackUserId: '',
      slackDisplayName: ''
    });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Name is required');
      return;
    }

    setIsSaving(true);
    try {
      if (isAdding) {
        const newMember = await createTeamMember(formData);
        setMembers(prev => [...prev, newMember]);
      } else if (editingId) {
        const updated = await updateTeamMember(editingId, formData);
        setMembers(prev => prev.map(m => m._id === editingId ? updated : m));
      }
      handleCancel();
    } catch (err) {
      alert('Failed to save: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this team member?')) return;

    try {
      await deleteTeamMember(id);
      setMembers(prev => prev.filter(m => m._id !== id));
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center animate-pulse-soft">
            <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          </div>
          <p className="text-secondary">Loading team members...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link to="/" className="inline-flex items-center gap-2 text-secondary hover:text-primary transition-colors mb-4">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Home
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary mb-2">Team Members</h1>
            <p className="text-secondary">Configure service mappings for task assignments</p>
          </div>

          {!isAdding && !editingId && (
            <button onClick={handleAdd} className="btn-primary flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Member
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20">
          {error}
        </div>
      )}

      {/* Add/Edit Form */}
      <AnimatePresence>
        {(isAdding || editingId) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)]"
          >
            <h2 className="text-lg font-semibold text-primary mb-4">
              {isAdding ? 'Add Team Member' : 'Edit Team Member'}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-secondary mb-1">Display Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-[var(--bg-base)] border border-[var(--border-color)] text-primary focus:border-accent outline-none"
                  placeholder="e.g., Jainil"
                />
              </div>

              <div>
                <label className="block text-sm text-secondary mb-1">Slack Display Name</label>
                <input
                  type="text"
                  value={formData.slackDisplayName}
                  onChange={(e) => setFormData({ ...formData, slackDisplayName: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-[var(--bg-base)] border border-[var(--border-color)] text-primary focus:border-accent outline-none"
                  placeholder="@jainil"
                />
              </div>

              <div>
                <label className="block text-sm text-secondary mb-1">Atlassian Email (Jira)</label>
                <input
                  type="email"
                  value={formData.atlassianEmail}
                  onChange={(e) => setFormData({ ...formData, atlassianEmail: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-[var(--bg-base)] border border-[var(--border-color)] text-primary focus:border-accent outline-none"
                  placeholder="jainil@example.com"
                />
              </div>

              <div>
                <label className="block text-sm text-secondary mb-1">Google Email (Calendar)</label>
                <input
                  type="email"
                  value={formData.googleEmail}
                  onChange={(e) => setFormData({ ...formData, googleEmail: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-[var(--bg-base)] border border-[var(--border-color)] text-primary focus:border-accent outline-none"
                  placeholder="jainil@gmail.com"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm text-secondary mb-1">Slack User ID</label>
                <input
                  type="text"
                  value={formData.slackUserId}
                  onChange={(e) => setFormData({ ...formData, slackUserId: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-[var(--bg-base)] border border-[var(--border-color)] text-primary focus:border-accent outline-none"
                  placeholder="U01ABC123XYZ (find in Slack profile)"
                />
                <p className="text-xs text-secondary mt-1">
                  Find this in Slack: Click profile → "..." → Copy member ID
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="btn-primary"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={handleCancel}
                className="px-6 py-2 rounded-lg border border-[var(--border-color)] text-secondary hover:text-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Members List */}
      {members.length === 0 ? (
        <div className="text-center py-12 text-secondary">
          <svg className="w-16 h-16 mx-auto mb-4 text-secondary/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
          <p>No team members yet. Add your first member to get started!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {members.map((member) => (
            <motion.div
              key={member._id}
              layout
              className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] hover:border-accent/30 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-primary text-lg">{member.name}</h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-sm">
                    {member.atlassianEmail && (
                      <div className="flex items-center gap-2 text-secondary">
                        <span className="w-5 h-5 rounded bg-blue-500/10 flex items-center justify-center text-blue-500 text-xs font-bold">J</span>
                        {member.atlassianEmail}
                      </div>
                    )}

                    {member.googleEmail && (
                      <div className="flex items-center gap-2 text-secondary">
                        <span className="w-5 h-5 rounded bg-green-500/10 flex items-center justify-center text-green-500 text-xs font-bold">G</span>
                        {member.googleEmail}
                      </div>
                    )}

                    {member.slackUserId && (
                      <div className="flex items-center gap-2 text-secondary">
                        <span className="w-5 h-5 rounded bg-purple-500/10 flex items-center justify-center text-purple-500 text-xs font-bold">S</span>
                        {member.slackUserId}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleEdit(member)}
                    className="p-2 rounded-lg hover:bg-accent/10 text-secondary hover:text-accent transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(member._id)}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-secondary hover:text-red-500 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeamMembersPage;
