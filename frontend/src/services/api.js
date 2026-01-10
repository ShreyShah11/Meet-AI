/**
 * API Service Layer
 * Handles all communication with the backend API
 * Currently uses mock responses - plug real backend later
 */

// Base API URL - switch to real backend URL when ready
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Toggle to use mock responses (set to false to use real backend)
const USE_MOCKS = false;

// Simulated network delay for mocks
const MOCK_DELAY = 800;

/**
 * Helper to simulate network delay
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Helper for making API requests
 */
const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  // Remove Content-Type for FormData (browser sets it automatically with boundary)
  if (options.body instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  const response = await fetch(url, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP error ${response.status}`);
  }

  return response.json();
};

// ============================================
// MOCK DATA
// ============================================

const mockTranscript = [
  { id: 1, speaker: 'Alex Chen', start: '00:00:00', end: '00:00:45', text: 'Good morning everyone. Thanks for joining the Q4 planning session. I wanted to kick things off by reviewing our progress from Q3 and then dive into our priorities for the next quarter.' },
  { id: 2, speaker: 'Sarah Miller', start: '00:00:46', end: '00:01:30', text: 'Thanks Alex. Before we start, I just want to highlight that we exceeded our Q3 targets by 15%. The team did an amazing job on the product launch. I think we should focus on three key areas for Q4: improving the onboarding flow, launching the mobile app, and expanding to the European market.' },
  { id: 3, speaker: 'Mike Johnson', start: '00:01:31', end: '00:02:15', text: 'I agree with Sarah\'s priorities. For the mobile app specifically, we have the designs finalized and the engineering team is ready to start development. We can begin next sprint if we get the green light today.' },
  { id: 4, speaker: 'Alex Chen', start: '00:02:16', end: '00:03:00', text: 'Great progress on that front. Let\'s assign clear owners for each priority. Sarah, would you be able to lead the onboarding improvements? You have the best understanding of the user journey.' },
  { id: 5, speaker: 'Sarah Miller', start: '00:03:01', end: '00:03:45', text: 'Absolutely, I\'d be happy to take that on. I\'ll put together a detailed roadmap by end of this week. We should also involve the customer success team since they have direct feedback from users.' },
  { id: 6, speaker: 'Mike Johnson', start: '00:03:46', end: '00:04:30', text: 'For the mobile app, I can take ownership of the engineering side. We\'ll need Lisa to handle the design reviews and Jennifer for QA coordination. I estimate we can have a beta ready in 6 weeks.' },
  { id: 7, speaker: 'Lisa Park', start: '00:04:31', end: '00:05:15', text: 'I\'m happy to support on design reviews. One thing to consider is accessibility. We should ensure the mobile app meets WCAG 2.1 standards from the start, rather than retrofitting later.' },
  { id: 8, speaker: 'Alex Chen', start: '00:05:16', end: '00:06:00', text: 'Excellent point Lisa. Let\'s make accessibility a core requirement. For the European expansion, I\'ll be working with our legal team on GDPR compliance. We\'re targeting December for the initial rollout in the UK and Germany.' },
];

const mockSummary = {
  executive: 'The Q4 planning meeting focused on three strategic priorities: improving the user onboarding experience, launching a mobile application, and expanding into the European market. Clear ownership was assigned for each initiative with Sarah leading onboarding improvements, Mike heading mobile development, and Alex managing European expansion. The team agreed on aggressive timelines with a mobile beta targeted for 6 weeks and European launch planned for December.',
  decisions: [
    'Mobile app development will begin next sprint with a 6-week beta target',
    'Sarah will lead the onboarding flow redesign with customer success team involvement',
    'European expansion will prioritize UK and Germany markets in December',
    'Accessibility (WCAG 2.1) will be a core requirement for mobile app from day one',
  ],
  actionItems: [
    { id: 1, title: 'Lead onboarding flow redesign', description: 'Create detailed roadmap and involve customer success team', owner: 'Sarah Miller', priority: 'High', dueDate: '2024-10-15', confidence: 95 },
    { id: 2, title: 'Start mobile app development', description: 'Begin engineering work with beta target in 6 weeks', owner: 'Mike Johnson', priority: 'High', dueDate: '2024-10-08', confidence: 92 },
    { id: 3, title: 'Coordinate mobile design reviews', description: 'Ensure WCAG 2.1 accessibility compliance from start', owner: 'Lisa Park', priority: 'Medium', dueDate: '2024-10-20', confidence: 88 },
    { id: 4, title: 'Prepare European market analysis', description: 'Work with legal team on GDPR compliance for UK and Germany', owner: 'Alex Chen', priority: 'Medium', dueDate: '2024-11-01', confidence: 85 },
    { id: 5, title: 'Create onboarding roadmap document', description: 'Detailed timeline and milestones for redesign project', owner: 'Sarah Miller', priority: 'Low', dueDate: '2024-10-12', confidence: 78 },
  ],
};

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Upload a meeting audio file
 * @param {File} audioFile - The audio file to upload
 * @returns {Promise<{meetingId: string, jobId: string}>}
 */
export const uploadMeeting = async (audioFile) => {
  if (USE_MOCKS) {
    await delay(MOCK_DELAY);

    // Validate file type
    if (!audioFile.type.startsWith('audio/')) {
      throw new Error('Invalid file type. Please upload an audio file.');
    }

    // Generate mock IDs
    const meetingId = `meeting-${Date.now()}`;
    const jobId = `job-${Date.now()}`;

    // Store in sessionStorage for mock flow continuity
    sessionStorage.setItem('currentMeetingId', meetingId);
    sessionStorage.setItem('currentJobId', jobId);

    return { meetingId, jobId };
  }

  // Real API call
  const formData = new FormData();
  formData.append('audio', audioFile);

  return apiRequest('/meetings/upload', {
    method: 'POST',
    body: formData,
  });
};

/**
 * Upload a transcript file (CC/TXT/JSON/SRT/VTT)
 * Goes directly to transcript view (no transcription needed)
 * @param {File} transcriptFile - The transcript file to upload
 * @returns {Promise<{meetingId: string}>}
 */
export const uploadTranscript = async (transcriptFile) => {
  if (USE_MOCKS) {
    await delay(MOCK_DELAY);

    // Validate file type
    const ext = transcriptFile.name.split('.').pop().toLowerCase();
    if (!['txt', 'json', 'srt', 'vtt', 'cc'].includes(ext)) {
      throw new Error('Invalid file type. Please upload a transcript file (TXT, JSON, SRT, VTT).');
    }

    // Generate mock ID
    const meetingId = `meeting-${Date.now()}`;
    sessionStorage.setItem('currentMeetingId', meetingId);

    // For transcript upload, we skip processing and go directly to results
    return { meetingId };
  }

  // Real API call
  const formData = new FormData();
  formData.append('transcript', transcriptFile);

  return apiRequest('/meetings/upload-transcript', {
    method: 'POST',
    body: formData,
  });
};

/**
 * Get the status of a processing job
 * @param {string} jobId - The job ID to check
 * @returns {Promise<{status: 'queued' | 'processing' | 'done' | 'error', step?: string, progress?: number, meetingId?: string}>}
 */
export const getJobStatus = async (jobId) => {
  if (USE_MOCKS) {
    await delay(MOCK_DELAY / 2);

    // Simulate progressive status based on time
    const jobCreatedAt = parseInt(jobId.split('-')[1]) || Date.now();
    const elapsed = Date.now() - jobCreatedAt;

    // Progress through stages over ~10 seconds
    if (elapsed < 2000) {
      return { status: 'processing', step: 'uploading', progress: 25 };
    } else if (elapsed < 5000) {
      return { status: 'processing', step: 'transcribing', progress: 50 };
    } else if (elapsed < 8000) {
      return { status: 'processing', step: 'extracting', progress: 75 };
    } else {
      const meetingId = sessionStorage.getItem('currentMeetingId') || `meeting-${Date.now()}`;
      return { status: 'done', step: 'complete', progress: 100, meetingId };
    }
  }

  // Real API call
  return apiRequest(`/jobs/${jobId}/status`);
};

/**
 * Get the transcript for a meeting
 * @param {string} meetingId - The meeting ID
 * @returns {Promise<Array<{id: number, speaker: string, start: string, end: string, text: string}>>}
 */
export const getTranscript = async (meetingId) => {
  if (USE_MOCKS) {
    await delay(MOCK_DELAY);
    return mockTranscript;
  }

  // Real API call
  return apiRequest(`/meetings/${meetingId}/transcript`);
};

/**
 * Get the summary and action items for a meeting
 * @param {string} meetingId - The meeting ID
 * @returns {Promise<{executive: string, decisions: string[], actionItems: Array}>}
 */
export const getSummary = async (meetingId) => {
  if (USE_MOCKS) {
    await delay(MOCK_DELAY);
    return mockSummary;
  }

  // Real API call
  return apiRequest(`/meetings/${meetingId}/summary`);
};

/**
 * Re-run LLM extraction for a meeting
 * @param {string} meetingId - The meeting ID
 * @returns {Promise<{jobId: string}>}
 */
export const reExtractMeeting = async (meetingId) => {
  if (USE_MOCKS) {
    await delay(MOCK_DELAY);
    const jobId = `job-${Date.now()}`;
    return { jobId };
  }

  // Real API call
  return apiRequest(`/meetings/${meetingId}/extract`, {
    method: 'POST',
  });
};

/**
 * Confirm and save edited tasks
 * @param {string} meetingId - The meeting ID
 * @param {Array} tasks - The edited tasks array
 * @returns {Promise<{success: boolean}>}
 */
export const confirmTasks = async (meetingId, tasks) => {
  if (USE_MOCKS) {
    await delay(MOCK_DELAY);
    console.log('Tasks confirmed:', tasks);
    return { success: true };
  }

  // Real API call
  return apiRequest(`/meetings/${meetingId}/tasks`, {
    method: 'POST',
    body: JSON.stringify({ tasks }),
  });
};

/**
 * Confirm a single task and trigger n8n workflow
 * @param {string} meetingId - The meeting ID
 * @param {string} taskId - The task ID
 * @param {Object} task - The updated task object
 * @returns {Promise<{success: boolean, task: Object}>}
 */
export const confirmSingleTask = async (meetingId, taskId, task) => {
  if (USE_MOCKS) {
    await delay(MOCK_DELAY);
    console.log('Single task confirmed:', task);
    return { success: true, task };
  }

  // Real API call
  return apiRequest(`/meetings/${meetingId}/tasks/${taskId}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ task }),
  });
};

// ============================================
// UTILITY EXPORTS
// ============================================

export const api = {
  uploadMeeting,
  uploadTranscript,
  getJobStatus,
  getTranscript,
  getSummary,
  reExtractMeeting,
  confirmTasks,
  confirmSingleTask,
};

export default api;
