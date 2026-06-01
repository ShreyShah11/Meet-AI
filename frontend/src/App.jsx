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

import { isAuthenticated } from './services/api';

/**
 * App - Root component with routing configuration
 */
const RequireAuth = ({ children }) => {
  return isAuthenticated() ? children : <Navigate to="/login" replace />;
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
          <Route path="/" element={<RequireAuth><UploadPage /></RequireAuth>} />
          <Route path="/processing/:jobId" element={<RequireAuth><ProcessingPage /></RequireAuth>} />
          <Route path="/meetings/:meetingId/transcript" element={<RequireAuth><TranscriptPage /></RequireAuth>} />
          <Route path="/meetings/:meetingId/summary" element={<RequireAuth><SummaryAndTasksPage /></RequireAuth>} />
          <Route path="/team-members" element={<RequireAuth><TeamMembersPage /></RequireAuth>} />
        </Route>

        <Route path="*" element={isAuthenticated() ? <Navigate to="/" replace /> : <Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

