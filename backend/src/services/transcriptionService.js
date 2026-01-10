/**
 * Transcription Service
 * Connects to Gradio diarization endpoint running on Colab
 * Uses @gradio/client to send audio and receive speaker-diarized transcript
 */
import { Client, handle_file } from '@gradio/client';
import { config } from '../config/env.js';
import fs from 'fs';
import path from 'path';

class TranscriptionService {
  constructor() {
    this.gradioUrl = config.gradioEndpoint;
  }

  /**
   * Transcribe and diarize audio using Gradio endpoint
   * @param {string} audioPath - Path to audio file
   * @param {Object} options - Diarization options
   * @param {Function} onProgress - Callback for progress updates: (step, message) => void
   * @returns {Promise<Array>} - Array of diarized transcript segments
   */
    async transcribe(audioPath, options = {}, onProgress = () => {}) {
        const { numSpeakers = 2, minSpeakers = null, maxSpeakers = null } = options;

        console.log(`[Transcription] 🔌 Connecting to Gradio: ${this.gradioUrl}`);
        console.log(`[Transcription] 🎤 Audio file: ${audioPath}`);

        // Validate file exists
        if (!fs.existsSync(audioPath)) {
          throw new Error(`Audio file not found: ${audioPath}`);
        }

        try {
          // Connect to Gradio endpoint with explicit fetch options
          onProgress('connecting', 'Connecting to Gradio API...');
          console.log('[Transcription] ⏳ Connecting to Gradio API...');

          const client = await Client.connect(this.gradioUrl, {
            hf_token: undefined,
            status_callback: (status) => {
                // Map Gradio status to our progress callback
                // Gradio status: { stage: 'pending' | 'error' | 'complete', ... }
                console.log(`[Transcription] Status: ${status.stage}`);
                let message = 'Processing...';

                // Detailed mapping of Gradio status stages
                if (status.stage === 'pending') message = 'Waiting for worker...';
                else if (status.stage === 'generating') message = 'Generating transcript...';
                else if (status.stage === 'complete') message = 'Diarization complete!';
                else if (status.stage === 'error') message = 'Gradio error occurred';

                // You can add more granular mapping here if Gradio provides more details
                onProgress('transcribing', message);
            }
          });

          // Read audio file and create Blob
          onProgress('uploading', 'Uploading audio file...');
          console.log('[Transcription] 📤 Uploading audio file...');
          const audioBuffer = fs.readFileSync(audioPath);
          const audioBlob = new Blob([audioBuffer], {
            type: this.getMimeType(audioPath)
          });

          // Call diarization API
          onProgress('transcribing', 'Processing with diarization pipeline...');
          console.log('[Transcription] 🔄 Processing with diarization pipeline...');

          const result = await client.predict(0, [
            handle_file(audioBlob),  // Audio file
            numSpeakers,             // Number of Speakers (optional hint)
            minSpeakers,             // Min Speakers
            maxSpeakers              // Max Speakers
          ]);

          // Parse the diarization response
          const pipelineOutput = result.data[0];
          console.log('[Transcription] ✅ Diarization complete');
          // console.log('[Transcription] Raw output:', JSON.stringify(pipelineOutput, null, 2).substring(0, 500));

          // Parse and normalize segments
          const segments = this.parseGradioResponse(pipelineOutput);
          console.log(`[Transcription] 📊 Got ${segments.length} segments`);

          return segments;

        } catch (error) {
          console.error('[Transcription] ❌ Error:', error.message);

          // Explicitly propagate connection errors with clear messages
          if (error.message.includes('Connection refused') || error.message.includes('fetch failed')) {
             throw new Error(`Could not connect to Gradio server at ${this.gradioUrl}. Is it running?`);
          }

          // If Gradio is unavailable, check if we should use mock data
          if (this.shouldUseMock(error)) {
            console.warn('[Transcription] ⚠️ Gradio unavailable, using mock data for development');
            onProgress('transcribing', 'Using mock data (Gradio unavailable)...');
            return this.getMockTranscript();
          }

          throw new Error(`Transcription failed: ${error.message}`);
        }
      }

      /**
       * Get MIME type from file extension
       */
      getMimeType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
          '.mp3': 'audio/mpeg',
          '.wav': 'audio/wav',
          '.m4a': 'audio/mp4',
          '.webm': 'audio/webm',
          '.ogg': 'audio/ogg',
          '.flac': 'audio/flac'
        };
        return mimeTypes[ext] || 'audio/mpeg';
      }

      /**
       * Check if we should fall back to mock data
       */
      shouldUseMock(error) {
        // Disabled mock fallback to surface errors as requested by user
        return false;

        /*
        const mockTriggers = [
          'ECONNREFUSED',
          'fetch failed',
          'Failed to fetch',
          'NetworkError',
          'ENOTFOUND',
          'getaddrinfo',
          'ETIMEDOUT',
          'socket hang up'
        ];
        return mockTriggers.some(trigger => error.message?.includes(trigger));
        */
      }

      /**
       * Parse Gradio diarization response into our standard segment format
       * The Gradio endpoint returns JSON with segments containing speaker, start, end, text
       */
      parseGradioResponse(data) {
        // Handle if data is already parsed JSON object
        if (typeof data === 'object' && data !== null) {
          // If it's the expected format with segments array
          if (data.segments && Array.isArray(data.segments)) {
            return this.normalizeSegments(data.segments);
          }

          // If it's a direct array of segments
          if (Array.isArray(data)) {
            return this.normalizeSegments(data);
          }

          // If it has a transcript property
          if (data.transcript && Array.isArray(data.transcript)) {
            return this.normalizeSegments(data.transcript);
          }

          // If it has a diarization property (WhisperX format)
          if (data.diarization && Array.isArray(data.diarization)) {
            return this.normalizeSegments(data.diarization);
          }

          // If it has word_segments (detailed WhisperX format)
          if (data.word_segments || data.segments) {
            const segs = data.segments || data.word_segments;
            return this.normalizeSegments(segs);
          }
        }

        // Handle JSON string
        if (typeof data === 'string') {
          try {
            const parsed = JSON.parse(data);
            return this.parseGradioResponse(parsed);
          } catch {
            // Not valid JSON, treat as plain text
            return [{
              speaker: 'Speaker 1',
              start: 0,
              end: 0,
              text: data
            }];
          }
        }

        console.warn('[Transcription] Unexpected response format:', typeof data, data);
        throw new Error('Unexpected transcription response format');
      }

      /**
       * Normalize segments to our standard format
       * Handles various field names from different diarization outputs
       */
      normalizeSegments(segments) {
        return segments.map((seg, idx) => {
          // Extract speaker - handle various naming conventions
          let speaker = seg.speaker || seg.label || seg.spk || seg.speaker_id;
          if (!speaker) {
            speaker = `Speaker ${(idx % 4) + 1}`;
          }
          // Clean up speaker name (remove "SPEAKER_" prefix if present)
          if (typeof speaker === 'string' && speaker.startsWith('SPEAKER_')) {
            const speakerNum = parseInt(speaker.replace('SPEAKER_', '')) + 1;
            speaker = `Speaker ${speakerNum}`;
          }

          // Extract timestamps - handle various field names
          const start = seg.start ?? seg.start_time ?? seg.begin ?? seg.from ?? 0;
          const end = seg.end ?? seg.end_time ?? seg.finish ?? seg.to ?? start;

          // Extract text
          const text = seg.text || seg.transcript || seg.content || seg.words || '';

          return { speaker, start, end, text };
        });
      }

      /**
       * Health check - verify Gradio endpoint is reachable
       */
      async healthCheck() {
        try {
          const client = await Client.connect(this.gradioUrl);
          return { healthy: true, endpoint: this.gradioUrl };
        } catch (error) {
          return { healthy: false, endpoint: this.gradioUrl, error: error.message };
        }
      }

      /**
       * Mock transcript for development when Gradio is unavailable
       */
      getMockTranscript() {
        return [
          { speaker: 'Alex Chen', start: 0, end: 45, text: 'Good morning everyone. Thanks for joining the Q4 planning session. I wanted to kick things off by reviewing our progress from Q3 and then dive into our priorities for the next quarter.' },
          { speaker: 'Sarah Miller', start: 46, end: 90, text: 'Thanks Alex. Before we start, I just want to highlight that we exceeded our Q3 targets by 15%. The team did an amazing job on the product launch. I think we should focus on three key areas for Q4: improving the onboarding flow, launching the mobile app, and expanding to the European market.' },
          { speaker: 'Mike Johnson', start: 91, end: 135, text: 'I agree with Sarah\'s priorities. For the mobile app specifically, we have the designs finalized and the engineering team is ready to start development. We can begin next sprint if we get the green light today.' },
          { speaker: 'Alex Chen', start: 136, end: 180, text: 'Great progress on that front. Let\'s assign clear owners for each priority. Sarah, would you be able to lead the onboarding improvements? You have the best understanding of the user journey.' },
          { speaker: 'Sarah Miller', start: 181, end: 225, text: 'Absolutely, I\'d be happy to take that on. I\'ll put together a detailed roadmap by end of this week. We should also involve the customer success team since they have direct feedback from users.' },
          { speaker: 'Mike Johnson', start: 226, end: 270, text: 'For the mobile app, I can take ownership of the engineering side. We\'ll need Lisa to handle the design reviews and Jennifer for QA coordination. I estimate we can have a beta ready in 6 weeks.' },
          { speaker: 'Lisa Park', start: 271, end: 315, text: 'I\'m happy to support on design reviews. One thing to consider is accessibility. We should ensure the mobile app meets WCAG 2.1 standards from the start, rather than retrofitting later.' },
          { speaker: 'Alex Chen', start: 316, end: 360, text: 'Excellent point Lisa. Let\'s make accessibility a core requirement. For the European expansion, I\'ll be working with our legal team on GDPR compliance. We\'re targeting December for the initial rollout in the UK and Germany.' }
        ];
      }
    }

    export const transcriptionService = new TranscriptionService();
    export default transcriptionService;
