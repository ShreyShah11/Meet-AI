import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getMemberMeetings } from '../services/api';

const formatDateTime = (value) => {
  if (!value) return 'Unknown time';
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
};

const MemberDashboardPage = () => {
  const [meetings, setMeetings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadMeetings = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getMemberMeetings();
        setMeetings(data);
      } catch (err) {
        setError(err.message || 'Failed to load meetings');
      } finally {
        setIsLoading(false);
      }
    };

    loadMeetings();
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center text-secondary">
        Loading your meetings...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-semibold text-primary">My Meetings</h1>
        <p className="text-secondary">Meetings shared with you by your organization admin.</p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-500">
          {error}
        </div>
      )}

      {meetings.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-10 text-center text-secondary">
          No meetings have been shared with you yet.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {meetings.map((meeting, index) => (
            <motion.div
              key={meeting._id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-primary">{meeting.title}</h2>
                  <p className="mt-1 text-sm text-secondary">{formatDateTime(meeting.createdAt)}</p>
                </div>
                <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                  {meeting.vectorStatus || 'pending'}
                </span>
              </div>

              <div className="mb-5 text-sm text-secondary">
                {meeting.originalFilename || 'Meeting transcript'} · {meeting.vectorChunkCount || 0} chunks
              </div>

              <Link
                to={`/member/meetings/${meeting._id}/chat`}
                className="inline-flex w-full items-center justify-center rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Open Chat
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MemberDashboardPage;
