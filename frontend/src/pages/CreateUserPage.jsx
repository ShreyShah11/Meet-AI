import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { createOwnerUser, createUser } from '../services/api';

/**
 * CreateUserPage - Create an admin or team member account
 * Second step for organization admins, or later for regular team members
 */
const CreateUserPage = () => {
  const navigate = useNavigate();
  const { organizationId } = useParams();
  const [searchParams] = useSearchParams();
  const requestedRole = searchParams.get('role') || 'member';
  const role = requestedRole === 'owner' ? 'admin' : requestedRole;
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    jiraEmail: '',
    slackUserId: '',
    slackDisplayName: '',
    googleEmail: '',
    atlassianEmail: '',
  });

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(role !== 'admin');

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate inputs
      if (!formData.name || !formData.email || !formData.password) {
        throw new Error('Name, email, and password are required');
      }

      if (formData.password.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }

      if (formData.password !== formData.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      const integrations = {
        jiraEmail: formData.jiraEmail || null,
        slackUserId: formData.slackUserId || null,
        slackDisplayName: formData.slackDisplayName || null,
        googleEmail: formData.googleEmail || null,
        atlassianEmail: formData.atlassianEmail || null,
      };

      if (role === 'admin') {
        await createOwnerUser(organizationId, formData.name, formData.email, formData.password);
      } else {
        await createUser(organizationId, formData.name, formData.email, formData.password, integrations);
      }

      // Navigate to dashboard after successful creation
      navigate(role === 'member' ? '/member' : '/', { replace: true });
    } catch (err) {
      setError(err.message || `Failed to create ${role} user`);
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
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            {role === 'admin' ? 'Create Admin Account' : 'Create Team Member Account'}
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {role === 'admin'
              ? 'Set up your organization administrator account'
              : 'Create your team member account with integration details'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Full Name</span>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Your full name"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
            />
          </label>

          {/* Email */}
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</span>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="your.email@company.com"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
            />
          </label>

          {/* Password */}
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Password</span>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="At least 8 characters"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
            />
          </label>

          {/* Confirm Password */}
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Confirm Password</span>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              placeholder="Repeat your password"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
            />
          </label>

          {/* Integration Details - Only for regular users */}
          {showIntegrations && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Integration Details (Optional)</h3>

              {/* Jira Email */}
              <label className="block mb-3">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Jira Email</span>
                <input
                  type="email"
                  name="jiraEmail"
                  value={formData.jiraEmail}
                  onChange={handleChange}
                  placeholder="your.email@jira.com"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
                />
              </label>

              {/* Slack User ID */}
              <label className="block mb-3">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Slack User ID</span>
                <input
                  type="text"
                  name="slackUserId"
                  value={formData.slackUserId}
                  onChange={handleChange}
                  placeholder="U123456789"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
                />
              </label>

              {/* Slack Display Name */}
              <label className="block mb-3">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Slack Display Name</span>
                <input
                  type="text"
                  name="slackDisplayName"
                  value={formData.slackDisplayName}
                  onChange={handleChange}
                  placeholder="john.doe"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
                />
              </label>

              {/* Google Email */}
              <label className="block mb-3">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Google Email</span>
                <input
                  type="email"
                  name="googleEmail"
                  value={formData.googleEmail}
                  onChange={handleChange}
                  placeholder="your.email@google.com"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
                />
              </label>

              {/* Atlassian Email */}
              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Atlassian Email</span>
                <input
                  type="email"
                  name="atlassianEmail"
                  value={formData.atlassianEmail}
                  onChange={handleChange}
                  placeholder="your.email@atlassian.com"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
                />
              </label>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400 mt-6"
          >
            {loading ? 'Creating Account...' : `Create ${role === 'admin' ? 'Admin' : 'Team Member'} Account`}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          <p>
            {role === 'admin'
              ? 'After creating your account, you can invite team members.'
              : 'Fill in your integration details so we can connect with your tools.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default CreateUserPage;
