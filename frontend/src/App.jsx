import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import MainLayout from './layouts/MainLayout';

// Pages
import LoginPage from './pages/LoginPage';
import CreateOrganizationPage from './pages/CreateOrganizationPage';
import JoinWorkspacePage from './pages/JoinWorkspacePage';
import CreateUserPage from './pages/CreateUserPage';
import UploadPage from './pages/UploadPage';
import ProcessingPage from './pages/ProcessingPage';
import TranscriptPage from './pages/TranscriptPage';
import SummaryAndTasksPage from './pages/SummaryAndTasksPage';
import TeamMembersPage from './pages/TeamMembersPage';
import MemberDashboardPage from './pages/MemberDashboardPage';
import MeetingChatPage from './pages/MeetingChatPage';

import { getUserRole, isAdmin, isAuthenticated } from './services/api';

/**
 * App - Root component with routing configuration
 */
const RequireAuth = ({ children }) => {
  return isAuthenticated() ? children : <Navigate to="/login" replace />;
};

const RequireAdmin = ({ children }) => {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  return isAdmin() ? children : <Navigate to="/member" replace />;
};

const RequireMember = ({ children }) => {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  return getUserRole() === 'member' ? children : <Navigate to="/" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/create-organization" element={<CreateOrganizationPage />} />
        <Route path="/join-workspace" element={<JoinWorkspacePage />} />
        <Route path="/create-user/:organizationId" element={<CreateUserPage />} />

        <Route element={<MainLayout />}>
          <Route path="/" element={<RequireAdmin><UploadPage /></RequireAdmin>} />
          <Route path="/processing/:jobId" element={<RequireAdmin><ProcessingPage /></RequireAdmin>} />
          <Route path="/meetings/:meetingId/transcript" element={<RequireAdmin><TranscriptPage /></RequireAdmin>} />
          <Route path="/meetings/:meetingId/summary" element={<RequireAdmin><SummaryAndTasksPage /></RequireAdmin>} />
          <Route path="/team-members" element={<RequireAdmin><TeamMembersPage /></RequireAdmin>} />
          <Route path="/member" element={<RequireMember><MemberDashboardPage /></RequireMember>} />
          <Route path="/member/meetings/:meetingId/chat" element={<RequireMember><MeetingChatPage /></RequireMember>} />
        </Route>

        <Route path="*" element={isAuthenticated() ? <Navigate to={getUserRole() === 'member' ? '/member' : '/'} replace /> : <Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

