import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * JoinWorkspacePage - Allow users to join an existing organization
 * Users enter their organization ID to find the workspace
 */
const JoinWorkspacePage = () => {
  const navigate = useNavigate();
  const [organizationId, setOrganizationId] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const trimmedOrgId = organizationId.trim();

      if (!trimmedOrgId) {
        throw new Error('Organization ID is required');
      }

      // Validate that it looks like a MongoDB ObjectID (24 hex characters)
      if (!/^[0-9a-f]{24}$/i.test(trimmedOrgId)) {
        throw new Error('Invalid Organization ID format. Please check the ID and try again.');
      }

      // Navigate to create user page with the organization ID
      navigate(`/create-user/${trimmedOrgId}?role=member`, { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to join workspace');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-gray-200/80 bg-white/95 p-8 shadow-lg shadow-slate-200/50 dark:border-white/10 dark:bg-slate-950/90 dark:shadow-slate-950/30">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-accent to-blue-600 text-white">
            <span className="text-2xl font-bold">M</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Join Workspace</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Enter your organization ID to join an existing workspace</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Organization ID</span>
            <input
              type="text"
              value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)}
              required
              placeholder="Paste your organization ID here"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Your organization administrator should have provided this ID
            </p>
          </label>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
          >
            {loading ? 'Joining…' : 'Join Workspace'}
          </button>
        </form>

        <div className="mt-6 space-y-3 border-t border-slate-200 dark:border-slate-700 pt-6 text-center">
          <div className="text-sm text-slate-500 dark:text-slate-400">
            <p>Don't have an organization ID?</p>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => navigate('/create-organization')}
              className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20"
            >
              Create a New Organization
            </button>

            <button
              onClick={() => navigate('/login')}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JoinWorkspacePage;
