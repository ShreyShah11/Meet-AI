import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getSummary, confirmTasks, confirmSingleTask, getTeamMembers } from '../services/api';

/**
 * SummaryAndTasksPage - Displays AI-generated summary and action items
 * Features two-column layout with editable tasks
 */
const SummaryAndTasksPage = () => {
  const { meetingId } = useParams();
  const navigate = useNavigate();

  // State for API data
  const [summary, setSummary] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch summary on mount
  useEffect(() => {
    const fetchData = async () => {
      if (!meetingId) { navigate('/'); return; }
      try {
        setIsLoading(true);
        const data = await getSummary(meetingId);
        const members = await getTeamMembers();
        // Raw LLM format: { summary, tasks }
        setSummary({ executive: data.summary, decisions: [] });
        setTeamMembers(members);
        setTasks(data.tasks || []);
      } catch (err) {
        setError(err.message || 'Failed to load summary');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [meetingId, navigate]);

  // Editing state
  const [editingTask, setEditingTask] = useState(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmingTaskId, setConfirmingTaskId] = useState(null);

  const enrichTaskWithMember = (task, member) => {
    if (!member) {
      const {
        assignedTeamMemberId,
        atlassianEmail,
        googleEmail,
        slackUserId,
        slackDisplayName,
        slackMention,
        assigneeMapping,
        ...rest
      } = task;

      return {
        ...rest,
        assignee: {
          ...(task.assignee || {}),
          name: 'Unassigned'
        },
        owner: 'Unassigned'
      };
    }

    return {
      ...task,
      assignedTeamMemberId: member._id,
      assignee: {
        ...(task.assignee || {}),
        name: member.name
      },
      owner: member.name,
      atlassianEmail: member.atlassianEmail || null,
      googleEmail: member.googleEmail || null,
      slackUserId: member.slackUserId || null,
      slackDisplayName: member.slackDisplayName || null,
      slackMention: member.slackUserId ? `<@${member.slackUserId}>` : null,
      assigneeMapping: {
        name: member.name,
        atlassianEmail: member.atlassianEmail || null,
        googleEmail: member.googleEmail || null,
        slackUserId: member.slackUserId || null,
        slackMention: member.slackUserId ? `<@${member.slackUserId}>` : null
      }
    };
  };

  // Priority configuration (supports both lowercase and capitalized)
  const priorityConfig = {
    'critical': { bg: 'bg-red-600/10', text: 'text-red-700 font-bold', border: 'border-red-600/20' },
    'Critical': { bg: 'bg-red-600/10', text: 'text-red-700 font-bold', border: 'border-red-600/20' },
    'high': { bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/20' },
    'High': { bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/20' },
    'medium': { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20' },
    'Medium': { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20' },
    'low': { bg: 'bg-green-500/10', text: 'text-green-500', border: 'border-green-500/20' },
    'Low': { bg: 'bg-green-500/10', text: 'text-green-500', border: 'border-green-500/20' },
    'unknown': { bg: 'bg-gray-500/10', text: 'text-gray-500', border: 'border-gray-500/20' },
    'Unknown': { bg: 'bg-gray-500/10', text: 'text-gray-500', border: 'border-gray-500/20' }
  };

  // Action type badge configuration
  const actionConfig = {
    'jira': { bg: 'bg-blue-500/10', text: 'text-blue-500', label: 'Jira' },
    'slack': { bg: 'bg-purple-500/10', text: 'text-purple-500', label: 'Slack' },
    'calendar': { bg: 'bg-green-500/10', text: 'text-green-500', label: 'Calendar' },
    'manual': { bg: 'bg-gray-500/10', text: 'text-gray-500', label: 'Manual' },
    'other': { bg: 'bg-gray-500/10', text: 'text-gray-500', label: 'Other' }
  };

  // Helper to get owner name from raw task format
  const getOwnerName = (task) => {
    if (task.assignee?.name && task.assignee.name !== 'unknown') return task.assignee.name;
    if (task.owner) return task.owner;
    return 'Unassigned';
  };

  // Helper to get due date from raw task format
  const getDueDate = (task) => task.due_date || task.dueDate || null;

  // Helper to get confidence (raw is 0-1, display as percentage)
  const getConfidence = (task) => {
    if (task.confidence <= 1) return Math.round(task.confidence * 100);
    return task.confidence;
  };

  // Update task field
  const updateTask = (taskId, field, value) => {
    setTasks(prev => prev.map(task =>
      task._id === taskId ? { ...task, [field]: value } : task
    ));
  };

  const updateTaskAssignee = (taskId, memberId) => {
    const member = teamMembers.find((teamMember) => teamMember._id === memberId);
    setTasks((prev) => prev.map((task) => (
      task._id === taskId ? enrichTaskWithMember(task, member) : task
    )));
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Handle confirm all tasks
  const handleConfirmTasks = async () => {
    setIsConfirming(true);
    try {
      await confirmTasks(meetingId, tasks, selectedMemberIds);
      alert('All tasks confirmed successfully!');
    } catch (err) {
      alert('Failed to confirm tasks: ' + err.message);
    } finally {
      setIsConfirming(false);
    }
  };

  const toggleMemberAccess = (memberId) => {
    setSelectedMemberIds((current) => (
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId]
    ));
  };

  // Handle confirm single task
  const handleConfirmSingleTask = async (task) => {
    setConfirmingTaskId(task._id);
    try {
      await confirmSingleTask(meetingId, task._id, task);
      // Update local state to show confirmed
      setTasks(prev => prev.map(t =>
        t._id === task._id ? { ...t, confirmed: true } : t
      ));
    } catch (err) {
      alert('Failed to confirm task: ' + err.message);
    } finally {
      setConfirmingTaskId(null);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center animate-pulse-soft">
            <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-secondary">Loading summary...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <div className="text-center glass-card p-8 max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-red-500 mb-4">{error}</p>
          <button onClick={() => navigate('/')} className="btn-primary">Go Back</button>
        </div>
      </div>
    );
  }

  // Confidence indicator component
  const ConfidenceIndicator = ({ value }) => {
    const getColor = () => {
      if (value >= 90) return 'bg-green-500';
      if (value >= 75) return 'bg-amber-500';
      return 'bg-red-500';
    };

    return (
      <div className="flex items-center gap-2">
        <div className="w-16 h-1.5 rounded-full bg-[var(--border-color)] overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${getColor()}`}
            initial={{ width: 0 }}
            animate={{ width: `${value}%` }}
            transition={{ duration: 0.5, delay: 0.2 }}
          />
        </div>
        <span className="text-xs text-secondary">{value}%</span>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-primary mb-2">
            Meeting Insights
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-secondary">
            <span>Q4 Planning Session</span>
            <span>•</span>
            <span>AI-generated summary and action items</span>
          </div>
        </div>

        {/* Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left column: Summary (2/5 width on desktop) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Executive Summary */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card p-6"
            >
              <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                Executive Summary
              </h2>
              <p className="text-secondary leading-relaxed">
                {summary.executive}
              </p>
            </motion.div>

            {/* Key Decisions */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-card p-6"
            >
              <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                Key Decisions
              </h2>
              <ul className="space-y-3">
                {summary.decisions.map((decision, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.05 }}
                    className="flex items-start gap-3"
                  >
                    <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                    </div>
                    <span className="text-secondary text-[15px]">{decision}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            {/* View Transcript Link */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <Link
                to={`/meetings/${meetingId}/transcript`}
                className="block glass-card p-4 hover:shadow-lg transition-shadow group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-primary">View Full Transcript</p>
                    <p className="text-sm text-secondary">See the complete meeting conversation</p>
                  </div>
                  <svg className="w-5 h-5 text-secondary group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            </motion.div>
          </div>

          {/* Right column: Action Items (3/5 width on desktop) */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-3"
          >
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  Action Items
                </h2>
                <span className="text-sm text-secondary bg-[var(--bg-surface)] px-3 py-1 rounded-full">
                  {tasks.length} tasks
                </span>
              </div>

              {/* Tasks list */}
              <div className="space-y-3">
                <AnimatePresence>
                  {tasks.map((task, index) => {
                    const priorityStyle = priorityConfig[task.priority] || priorityConfig['medium'];
                    const actionStyle = actionConfig[task.suggested_schedule_action] || actionConfig['manual'];
                    const isEditing = editingTask === task._id;

                    return (
                      <motion.div
                        key={task._id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + index * 0.05 }}
                        className={`
                          p-4 rounded-xl border transition-all duration-200
                          ${isEditing
                            ? 'bg-accent/5 border-accent/30'
                            : 'bg-[var(--bg-surface)] border-[var(--border-color)] hover:border-[var(--border-color)]'
                          }
                        `}
                      >
                        {/* Task header */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <h3 className="font-medium text-primary flex-1">
                            {task.title}
                          </h3>

                          {/* Priority chip */}
                          <div className="relative">
                            <select
                              value={task.priority}
                              onChange={(e) => updateTask(task._id, 'priority', e.target.value)}
                              className={`
                                appearance-none cursor-pointer px-3 py-1 rounded-full text-xs font-medium
                                border transition-colors pr-7
                                ${priorityStyle.bg} ${priorityStyle.text} ${priorityStyle.border}
                              `}
                            >
                              <option value="High">High</option>
                              <option value="Medium">Medium</option>
                              <option value="Low">Low</option>
                            </select>
                            <svg
                              className={`absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none ${priorityStyle.text}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>

                        {/* Task description */}
                        <p className="text-sm text-secondary mb-4">
                          {task.description}
                        </p>

                        {/* Task metadata */}
                        <div className="flex flex-wrap items-center gap-4 text-sm">
                          {/* Assignee - matched to team members */}
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <select
                              value={task.assignedTeamMemberId || ''}
                              onChange={(e) => updateTaskAssignee(task._id, e.target.value)}
                              className="max-w-44 cursor-pointer rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-1 text-primary outline-none transition-colors focus:border-accent"
                              onFocus={() => setEditingTask(task._id)}
                              onBlur={() => setEditingTask(null)}
                            >
                              <option value="">Unassigned</option>
                              {teamMembers.map((member) => (
                                <option key={member._id} value={member._id}>
                                  {member.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Due date - editable */}
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <input
                              type="date"
                              value={getDueDate(task) || ''}
                              onChange={(e) => updateTask(task._id, 'due_date', e.target.value)}
                              className="bg-transparent border-b border-transparent hover:border-[var(--border-color)] focus:border-accent outline-none text-primary transition-colors px-1 py-0.5 -mx-1 cursor-pointer"
                              onFocus={() => setEditingTask(task._id)}
                              onBlur={() => setEditingTask(null)}
                            />
                          </div>

                          {/* Action type - editable dropdown */}
                          <div className="relative">
                            <select
                              value={task.suggested_schedule_action || 'manual'}
                              onChange={(e) => updateTask(task._id, 'suggested_schedule_action', e.target.value)}
                              className={`
                                appearance-none cursor-pointer px-3 py-1 rounded-full text-xs font-medium
                                border transition-colors pr-7
                                ${actionStyle.bg} ${actionStyle.text} border-transparent
                              `}
                            >
                              <option value="jira">Jira</option>
                              <option value="slack">Slack</option>
                              <option value="calendar">Calendar</option>
                              <option value="manual">Manual</option>
                            </select>
                            <svg
                              className={`absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none ${actionStyle.text}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>

                          {/* Confidence indicator */}
                          <div className="ml-auto flex items-center gap-3">
                            <ConfidenceIndicator value={getConfidence(task)} />

                            {/* Individual confirm button */}
                            <button
                              onClick={() => handleConfirmSingleTask(task)}
                              disabled={confirmingTaskId === task._id || task.confirmed}
                              className={`
                                px-3 py-1 rounded-lg text-xs font-medium transition-all
                                ${task.confirmed
                                  ? 'bg-green-500/10 text-green-500 cursor-default'
                                  : confirmingTaskId === task._id
                                    ? 'bg-accent/10 text-accent cursor-wait'
                                    : 'bg-accent/10 text-accent hover:bg-accent/20'
                                }
                              `}
                            >
                              {task.confirmed ? (
                                <span className="flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Sent
                                </span>
                              ) : confirmingTaskId === task._id ? (
                                'Sending...'
                              ) : (
                                'Confirm'
                              )}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              <div className="mt-6 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-primary">Share meeting with team members</h3>
                    <p className="mt-1 text-sm text-secondary">
                      Selected members can see this meeting in their dashboard and chat with its transcript.
                    </p>
                  </div>
                  <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                    {selectedMemberIds.length} selected
                  </span>
                </div>

                {teamMembers.length === 0 ? (
                  <p className="text-sm text-secondary">No team members available yet.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {teamMembers.map((member) => (
                      <label
                        key={member._id}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                          selectedMemberIds.includes(member._id)
                            ? 'border-accent bg-accent/10'
                            : 'border-[var(--border-color)] hover:border-accent/40'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedMemberIds.includes(member._id)}
                          onChange={() => toggleMemberAccess(member._id)}
                          className="h-4 w-4 accent-[var(--accent)]"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-primary">{member.name}</p>
                          <p className="truncate text-xs text-secondary">
                            {member.googleEmail || member.atlassianEmail || member.slackDisplayName || 'No integration email'}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Confirm button */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-6 w-full btn-primary"
                onClick={handleConfirmTasks}
                disabled={isConfirming}
              >
                {isConfirming ? (
                  <>
                    <motion.div
                      className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                    Confirming...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Confirm Tasks
                  </>
                )}
              </motion.button>

              {/* Helper text */}
              <p className="mt-3 text-xs text-secondary text-center">
                Edit owners and due dates before confirming. Tasks can be exported to Jira, Slack, or Calendar.
              </p>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default SummaryAndTasksPage;
