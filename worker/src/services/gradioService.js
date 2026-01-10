const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

/**
 * Gradio Service
 * Handles communication with Gradio/WhisperX endpoint for transcription
 */
class GradioService {
  constructor() {
    this.endpoint = process.env.GRADIO_ENDPOINT || 'http://localhost:7860';
    this.timeout = 300000; // 5 minutes timeout for long audio files
  }

  /**
   * Send audio file to Gradio for transcription
   * @param {string} audioPath - Path to audio file
   * @returns {Promise<Array>} - Transcript segments
   */
  async transcribe(audioPath) {
    console.log(`[Gradio] Transcribing: ${audioPath}`);

    // Check if file exists
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    try {
      // Create form data with audio file
      const formData = new FormData();
      formData.append('file', fs.createReadStream(audioPath));

      // Gradio predict API endpoint
      const response = await axios.post(
        `${this.endpoint}/api/predict`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
          timeout: this.timeout,
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );

      // Parse Gradio response
      // Expected format: { data: [[segments]] } or { data: [transcript_json] }
      const result = this.parseGradioResponse(response.data);

      console.log(`[Gradio] Transcription complete: ${result.length} segments`);
      return result;

    } catch (error) {
      // Handle connection errors gracefully
      if (error.code === 'ECONNREFUSED') {
        console.warn('[Gradio] Endpoint not available, using mock transcript');
        return this.getMockTranscript();
      }

      console.error('[Gradio] Transcription error:', error.message);
      throw error;
    }
  }

  /**
   * Parse Gradio API response into transcript segments
   */
  parseGradioResponse(data) {
    try {
      // Handle various Gradio response formats
      if (data.data && Array.isArray(data.data)) {
        const transcriptData = data.data[0];

        // If it's a string (JSON), parse it
        if (typeof transcriptData === 'string') {
          return JSON.parse(transcriptData);
        }

        // If it's already an array of segments
        if (Array.isArray(transcriptData)) {
          return transcriptData.map((seg, idx) => ({
            id: idx + 1,
            speaker: seg.speaker || `Speaker ${idx % 4 + 1}`,
            start: this.formatTime(seg.start || seg.start_time || 0),
            end: this.formatTime(seg.end || seg.end_time || 0),
            text: seg.text || seg.transcript || ''
          }));
        }
      }

      // WhisperX specific format
      if (data.segments) {
        return data.segments.map((seg, idx) => ({
          id: idx + 1,
          speaker: seg.speaker || `Speaker ${(idx % 4) + 1}`,
          start: this.formatTime(seg.start),
          end: this.formatTime(seg.end),
          text: seg.text
        }));
      }

      throw new Error('Unexpected Gradio response format');

    } catch (error) {
      console.error('[Gradio] Parse error:', error);
      throw new Error('Failed to parse transcription response');
    }
  }

  /**
   * Format seconds to HH:MM:SS string
   */
  formatTime(seconds) {
    if (typeof seconds === 'string') return seconds;

    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Get mock transcript for development/testing
   */
  getMockTranscript() {
    return [
      { id: 1, speaker: 'Alex Chen', start: '00:00:00', end: '00:00:45', text: 'Good morning everyone. Thanks for joining the Q4 planning session. I wanted to kick things off by reviewing our progress from Q3.' },
      { id: 2, speaker: 'Sarah Miller', start: '00:00:46', end: '00:01:30', text: 'Thanks Alex. Before we start, I just want to highlight that we exceeded our Q3 targets by 15%. The team did an amazing job on the product launch.' },
      { id: 3, speaker: 'Mike Johnson', start: '00:01:31', end: '00:02:15', text: 'I agree with Sarah\'s priorities. For the mobile app specifically, we have the designs finalized and the engineering team is ready.' },
      { id: 4, speaker: 'Alex Chen', start: '00:02:16', end: '00:03:00', text: 'Great progress. Let\'s assign clear owners for each priority. Sarah, would you be able to lead the onboarding improvements?' },
      { id: 5, speaker: 'Sarah Miller', start: '00:03:01', end: '00:03:45', text: 'Absolutely, I\'d be happy to take that on. I\'ll put together a detailed roadmap by end of this week.' },
      { id: 6, speaker: 'Mike Johnson', start: '00:03:46', end: '00:04:30', text: 'For the mobile app, I can take ownership. We\'ll need Lisa for design reviews. I estimate beta in 6 weeks.' },
      { id: 7, speaker: 'Lisa Park', start: '00:04:31', end: '00:05:15', text: 'Happy to support design reviews. We should ensure WCAG 2.1 accessibility from the start.' },
      { id: 8, speaker: 'Alex Chen', start: '00:05:16', end: '00:06:00', text: 'Excellent point. For European expansion, I\'m working with legal on GDPR. Targeting December for UK and Germany.' }
    ];
  }

  /**
   * Health check for Gradio endpoint
   */
  async healthCheck() {
    try {
      const response = await axios.get(`${this.endpoint}/api/`, { timeout: 5000 });
      return { available: true, endpoint: this.endpoint };
    } catch (error) {
      return { available: false, endpoint: this.endpoint, error: error.message };
    }
  }
}

module.exports = new GradioService();
