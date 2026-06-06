import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { chatWithMeeting } from '../services/api';

const MeetingChatPage = () => {
  const { meetingId } = useParams();
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || isSending) return;

    setMessages((current) => [...current, { role: 'user', content: trimmed }]);
    setQuestion('');
    setIsSending(true);
    setError(null);

    try {
      const response = await chatWithMeeting(meetingId, trimmed);
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: response.answer,
          sources: response.sources || [],
          vectorStatus: response.vectorStatus
        }
      ]);
    } catch (err) {
      setError(err.message || 'Failed to ask meeting chatbot');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <Link to="/member" className="mb-4 inline-flex text-sm text-secondary transition hover:text-primary">
          Back to meetings
        </Link>
        <h1 className="text-3xl font-semibold text-primary">Meeting Chat</h1>
        <p className="mt-2 text-secondary">Ask questions about the selected meeting transcript.</p>
      </div>

      <div className="min-h-[28rem] rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 sm:p-6">
        <div className="mb-4 max-h-[32rem] space-y-4 overflow-y-auto pr-1">
          {messages.length === 0 && (
            <div className="rounded-xl bg-accent/5 p-5 text-sm text-secondary">
              Try asking about decisions, blockers, owners, deadlines, or why a task was assigned.
            </div>
          )}

          {messages.map((message, index) => (
            <motion.div
              key={`${message.role}-${index}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={message.role === 'user' ? 'ml-auto max-w-2xl' : 'mr-auto max-w-3xl'}
            >
              <div className={`rounded-2xl p-4 text-sm leading-relaxed ${
                message.role === 'user'
                  ? 'bg-accent text-white'
                  : 'border border-[var(--border-color)] bg-accent/5 text-primary'
              }`}>
                {message.content}
              </div>

              {message.sources?.length > 0 && (
                <div className="mt-3 space-y-2">
                  {message.sources.slice(0, 3).map((source, sourceIndex) => (
                    <details key={sourceIndex} className="rounded-xl border border-[var(--border-color)] p-3 text-xs text-secondary">
                      <summary className="cursor-pointer font-medium text-primary">
                        Source {sourceIndex + 1}
                        {source.metadata?.startTime ? ` · ${source.metadata.startTime}` : ''}
                      </summary>
                      <p className="mt-2 whitespace-pre-wrap">{source.text}</p>
                    </details>
                  ))}
                </div>
              )}
            </motion.div>
          ))}

          {isSending && (
            <div className="mr-auto max-w-xl rounded-2xl border border-[var(--border-color)] bg-accent/5 p-4 text-sm text-secondary">
              Thinking through the transcript...
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-500">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            className="min-h-12 flex-1 rounded-xl border border-[var(--border-color)] bg-transparent px-4 py-3 text-primary outline-none transition focus:border-accent"
            placeholder="Ask about this meeting..."
          />
          <button
            disabled={isSending || !question.trim()}
            className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Ask
          </button>
        </form>
      </div>
    </div>
  );
};

export default MeetingChatPage;
