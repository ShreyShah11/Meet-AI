import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getTranscript } from '../services/api';

/**
 * TranscriptPage - Displays speaker-wise transcript with timeline
 * Features collapsible speaker blocks and timestamps
 */
const TranscriptPage = () => {
  const { meetingId } = useParams();
  const navigate = useNavigate();

  // State for API data
  const [transcript, setTranscript] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch transcript on mount
  useEffect(() => {
    const fetchData = async () => {
      if (!meetingId) { navigate('/'); return; }
      try {
        setIsLoading(true);
        const data = await getTranscript(meetingId);
        setTranscript(data);
      } catch (err) {
        setError(err.message || 'Failed to load transcript');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [meetingId, navigate]);

  // Speaker colors (assigned dynamically)
  const speakerColorList = [
    { bg: 'bg-blue-500', light: 'bg-blue-500/10', text: 'text-blue-500' },
    { bg: 'bg-purple-500', light: 'bg-purple-500/10', text: 'text-purple-500' },
    { bg: 'bg-green-500', light: 'bg-green-500/10', text: 'text-green-500' },
    { bg: 'bg-orange-500', light: 'bg-orange-500/10', text: 'text-orange-500' },
    { bg: 'bg-pink-500', light: 'bg-pink-500/10', text: 'text-pink-500' },
  ];

  const uniqueSpeakers = [...new Set(transcript.map(s => s.speaker))];
  const speakerColors = Object.fromEntries(
    uniqueSpeakers.map((s, i) => [s, speakerColorList[i % speakerColorList.length]])
  );


  // Group transcript by speaker consecutively
  const groupedTranscript = transcript.reduce((groups, segment) => {
    const lastGroup = groups[groups.length - 1];

    if (lastGroup && lastGroup.speaker === segment.speaker) {
      lastGroup.segments.push(segment);
      lastGroup.end = segment.end;
    } else {
      groups.push({
        id: `group-${segment.id}`,
        speaker: segment.speaker,
        start: segment.start,
        end: segment.end,
        segments: [segment],
      });
    }

    return groups;
  }, []);

  // Collapsed state for groups
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());

  const toggleGroup = (groupId) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // Get speaker initials
  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  // Get default color for unknown speakers
  const getSpeakerColor = (speaker) => {
    return speakerColors[speaker] || {
      bg: 'bg-gray-500',
      light: 'bg-gray-500/10',
      text: 'text-gray-500'
    };
  };

  // Calculate total duration
  const totalDuration = transcript.length > 0
    ? transcript[transcript.length - 1].end
    : '00:00:00';

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center animate-pulse-soft">
            <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <p className="text-secondary">Loading transcript...</p>
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

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-primary mb-2">
            Meeting Transcript
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-secondary">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {totalDuration}
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {Object.keys(speakerColors).length} speakers
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              {transcript.length} segments
            </span>
          </div>
        </div>

        {/* Speaker legend */}
        <div className="mb-6 flex flex-wrap gap-2">
          {Object.entries(speakerColors).map(([speaker, colors]) => (
            <div
              key={speaker}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${colors.light}`}
            >
              <div className={`w-2 h-2 rounded-full ${colors.bg}`} />
              <span className={`text-sm font-medium ${colors.text}`}>
                {speaker}
              </span>
            </div>
          ))}
        </div>

        {/* Transcript timeline */}
        <div className="space-y-4">
          {groupedTranscript.map((group, index) => {
            const colors = getSpeakerColor(group.speaker);
            const isCollapsed = collapsedGroups.has(group.id);

            return (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="glass-card overflow-hidden"
              >
                {/* Speaker header - clickable to collapse */}
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full p-4 sm:p-5 flex items-center gap-3 sm:gap-4 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                >
                  {/* Speaker avatar */}
                  <div className={`
                    w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center
                    text-white font-medium text-sm sm:text-base flex-shrink-0
                    ${colors.bg}
                  `}>
                    {getInitials(group.speaker)}
                  </div>

                  {/* Speaker info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="font-medium text-primary truncate">
                        {group.speaker}
                      </span>
                      <span className="text-xs text-secondary font-mono hidden sm:inline">
                        {group.start} – {group.end}
                      </span>
                    </div>
                    <p className="text-sm text-secondary mt-0.5 truncate sm:hidden">
                      {group.start} – {group.end}
                    </p>
                    {group.segments.length > 1 && (
                      <p className="text-xs text-secondary mt-1">
                        {group.segments.length} segments
                      </p>
                    )}
                  </div>

                  {/* Collapse indicator */}
                  <motion.div
                    animate={{ rotate: isCollapsed ? -90 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-secondary"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </motion.div>
                </button>

                {/* Transcript content */}
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-3 border-t border-[var(--border-color)]">
                        {group.segments.map((segment, segIndex) => (
                          <div
                            key={segment.id}
                            className={`pt-3 ${segIndex > 0 ? 'border-t border-[var(--border-color)]/50' : ''}`}
                          >
                            {/* Segment timestamp */}
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-mono text-secondary">
                                {segment.start}
                              </span>
                              <div className="flex-1 h-px bg-[var(--border-color)]" />
                            </div>

                            {/* Segment text */}
                            <p className="text-primary leading-relaxed text-[15px]">
                              {segment.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Navigation to summary */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 flex justify-center"
        >
          <Link
            to={`/meetings/${meetingId}/summary`}
            className="btn-primary"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            View Summary & Tasks
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default TranscriptPage;
