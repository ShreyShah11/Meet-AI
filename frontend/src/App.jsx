import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Layouts
import MainLayout from './layouts/MainLayout';

// Pages
import UploadPage from './pages/UploadPage';
import ProcessingPage from './pages/ProcessingPage';
import TranscriptPage from './pages/TranscriptPage';
import SummaryAndTasksPage from './pages/SummaryAndTasksPage';
import TeamMembersPage from './pages/TeamMembersPage';

/**
 * App - Root component with routing configuration
 */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* All routes wrapped in MainLayout */}
        <Route element={<MainLayout />}>
          {/* Upload page - Landing */}
          <Route path="/" element={<UploadPage />} />

          {/* Processing page - Shows progress */}
          <Route path="/processing/:jobId" element={<ProcessingPage />} />

          {/* Transcript page - Meeting transcript */}
          <Route path="/meetings/:meetingId/transcript" element={<TranscriptPage />} />

          {/* Summary page - AI insights and tasks */}
          <Route path="/meetings/:meetingId/summary" element={<SummaryAndTasksPage />} />

          {/* Team Members page - Configure service mappings */}
          <Route path="/team-members" element={<TeamMembersPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

