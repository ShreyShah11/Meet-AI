import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getTeamMembers, updateTeamMember } from '../services/api';

const EMPTY_FORM = {
  aliases: '',
  atlassianEmail: '',
  googleEmail: '',
  slackUserId: '',
  slackDisplayName: ''
};

const detailItems = [
  { key: 'atlassianEmail', label: 'Jira / Atlassian', accent: 'bg-blue-500/10 text-blue-500', badge: 'J' },
  { key: 'googleEmail', label: 'Google Email', accent: 'bg-green-500/10 text-green-500', badge: 'G' },
  { key: 'slackUserId', label: 'Slack User ID', accent: 'bg-amber-500/10 text-amber-600', badge: 'S' },
  { key: 'slackDisplayName', label: 'Slack Display Name', accent: 'bg-pink-500/10 text-pink-500', badge: '@' }
];

const buildFormState = (member) => ({
  aliases: (member.aliases || []).join(', '),
  atlassianEmail: member.atlassianEmail || '',
  googleEmail: member.googleEmail || '',
  slackUserId: member.slackUserId || '',
  slackDisplayName: member.slackDisplayName || ''
});

const parseAliases = (value) => value
  .split(',')
  .map((alias) => alias.trim())
  .filter(Boolean);

const TeamMembersPage = () => {
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [formState, setFormState] = useState(EMPTY_FORM);
  const [saveError, setSaveError] = useState(null);
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getTeamMembers();
      setMembers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (member) => {
    setEditingId(member._id);
    setFormState(buildFormState(member));
    setSaveError(null);
  };

  const stopEditing = () => {
    setEditingId(null);
    setFormState(EMPTY_FORM);
    setSaveError(null);
  };

  const handleFieldChange = (field, value) => {
    setFormState((current) => ({
      ...current,
      [field]: value
    }));
  };

  const handleSave = async (memberId) => {
    try {
      setSavingId(memberId);
      setSaveError(null);

      const updatedMember = await updateTeamMember(memberId, {
        aliases: parseAliases(formState.aliases),
        atlassianEmail: formState.atlassianEmail.trim(),
        googleEmail: formState.googleEmail.trim(),
        slackUserId: formState.slackUserId.trim(),
        slackDisplayName: formState.slackDisplayName.trim()
      });

      setMembers((current) => current.map((member) => (
        member._id === memberId ? updatedMember : member
      )));
      stopEditing();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSavingId(null);
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
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <Link to="/" className="inline-flex items-center gap-2 text-secondary hover:text-primary transition-colors mb-4">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Home
        </Link>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary mb-2">Team Members</h1>
            <p className="text-secondary">View and update the service details used for Jira, Slack, Google, and task routing.</p>
          </div>

          <button
            onClick={fetchMembers}
            className="inline-flex items-center justify-center rounded-xl border border-[var(--border-color)] px-4 py-2 text-sm font-medium text-primary hover:border-accent/40 hover:bg-accent/5 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-500">
          {error}
        </div>
      )}

      <div className="mb-6 rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-700 dark:text-blue-300">
        Member records are created automatically when users join the organization. You can edit the integration details here without recreating the user.
      </div>

      {members.length === 0 ? (
        <div className="py-12 text-center text-secondary">
          <svg className="w-16 h-16 mx-auto mb-4 text-secondary/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
          <p>No team members yet. Invite users to create team member records first.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {members.map((member) => {
            const isEditing = editingId === member._id;
            const aliases = member.aliases?.length ? member.aliases.join(', ') : 'No aliases';

            return (
              <motion.div
                key={member._id}
                layout
                className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm"
              >
                <div className="border-b border-[var(--border-color)]/80 px-5 py-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-primary">{member.name}</h2>
                      <p className="mt-1 text-sm text-secondary">Aliases: {aliases}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={stopEditing}
                            className="rounded-xl border border-[var(--border-color)] px-3 py-2 text-sm font-medium text-secondary hover:bg-accent/5 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSave(member._id)}
                            disabled={savingId === member._id}
                            className="rounded-xl bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {savingId === member._id ? 'Saving...' : 'Save'}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startEditing(member)}
                          className="rounded-xl bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90"
                        >
                          Edit Details
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  {isEditing ? (
                    <div className="space-y-4">
                      {saveError && (
                        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-500">
                          {saveError}
                        </div>
                      )}

                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-primary">Jira / Atlassian Email</span>
                          <input
                            type="email"
                            value={formState.atlassianEmail}
                            onChange={(event) => handleFieldChange('atlassianEmail', event.target.value)}
                            className="w-full rounded-xl border border-[var(--border-color)] bg-transparent px-3 py-2 text-sm text-primary outline-none transition focus:border-accent"
                            placeholder="name@company.com"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-primary">Google Email</span>
                          <input
                            type="email"
                            value={formState.googleEmail}
                            onChange={(event) => handleFieldChange('googleEmail', event.target.value)}
                            className="w-full rounded-xl border border-[var(--border-color)] bg-transparent px-3 py-2 text-sm text-primary outline-none transition focus:border-accent"
                            placeholder="name@company.com"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-primary">Slack User ID</span>
                          <input
                            type="text"
                            value={formState.slackUserId}
                            onChange={(event) => handleFieldChange('slackUserId', event.target.value)}
                            className="w-full rounded-xl border border-[var(--border-color)] bg-transparent px-3 py-2 text-sm text-primary outline-none transition focus:border-accent"
                            placeholder="U01ABC123"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-primary">Slack Display Name</span>
                          <input
                            type="text"
                            value={formState.slackDisplayName}
                            onChange={(event) => handleFieldChange('slackDisplayName', event.target.value)}
                            className="w-full rounded-xl border border-[var(--border-color)] bg-transparent px-3 py-2 text-sm text-primary outline-none transition focus:border-accent"
                            placeholder="@teammate"
                          />
                        </label>
                      </div>

                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-primary">Aliases</span>
                        <input
                          type="text"
                          value={formState.aliases}
                          onChange={(event) => handleFieldChange('aliases', event.target.value)}
                          className="w-full rounded-xl border border-[var(--border-color)] bg-transparent px-3 py-2 text-sm text-primary outline-none transition focus:border-accent"
                          placeholder="Comma separated names, nicknames, or short forms"
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {detailItems.map((item) => (
                        <div
                          key={item.key}
                          className="flex min-h-20 items-start gap-3 rounded-xl border border-[var(--border-color)] bg-accent/5 p-4"
                        >
                          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold ${item.accent}`}>
                            {item.badge}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-primary">{item.label}</p>
                            <p className="mt-1 break-all text-sm text-secondary">
                              {member[item.key] || 'Not set'}
                            </p>
                          </div>
                        </div>
                      ))}

                      <div className="rounded-xl border border-[var(--border-color)] bg-accent/5 p-4 md:col-span-2">
                        <p className="text-sm font-medium text-primary">Aliases</p>
                        <p className="mt-1 text-sm text-secondary">{aliases}</p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TeamMembersPage;
