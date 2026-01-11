import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { uploadMeeting, uploadTranscript } from '../services/api';
import { joinMeeting, getBotStatus, getTranscript } from '../services/botService';

/**
 * UploadPage - Dashboard-style landing page for uploading meetings
 * Supports both audio files, transcript files, and Bot integration
 */
const UploadPage = () => {
  const navigate = useNavigate();
  const audioInputRef = useRef(null);
  const transcriptInputRef = useRef(null);

  // State
  const [uploadType, setUploadType] = useState('transcript'); // 'audio', 'transcript', 'bot'
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);

  // Bot State
  const [meetingUrl, setMeetingUrl] = useState('');
  const [botId, setBotId] = useState('');
  const [botStatus, setBotStatus] = useState('');
  const [botLogs, setBotLogs] = useState([]);
  const [botTranscript, setBotTranscript] = useState(null);

  const addBotLog = (message) => {
    setBotLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev]);
  };

  // File type configurations
  const fileTypes = {
    audio: {
      accept: 'audio/*',
      extensions: ['MP3', 'WAV', 'M4A', 'WEBM'],
      validate: (file) => file.type.startsWith('audio/'),
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      ),
      label: 'Audio Recording',
      description: 'Upload audio for AI transcription'
    },
    transcript: {
      accept: '.txt,.json,.srt,.vtt,.cc',
      extensions: ['TXT', 'JSON', 'SRT', 'VTT'],
      validate: (file) => {
        const ext = file.name.split('.').pop().toLowerCase();
        return ['txt', 'json', 'srt', 'vtt', 'cc'].includes(ext);
      },
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      ),
      label: 'Transcript / Captions',
      description: 'Upload existing transcript or CC file'
    },
    bot: {
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      ),
      label: 'Join Meeting Bot',
      description: 'Send AI bot to record a meeting (Zoom/Meet)'
    }
  };

  const currentType = fileTypes[uploadType];

  // Handle file selection
  const handleFileSelect = useCallback((selectedFile) => {
    setError(null);
    if (uploadType === 'bot') return;

    // Validate file type
    if (!currentType.validate(selectedFile)) {
      setError(`Please select a valid ${uploadType} file`);
      return;
    }

    // Validate file size (max 500MB)
    const maxSize = 500 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      setError('File size must be less than 500MB');
      return;
    }

    setFile(selectedFile);
  }, [currentType, uploadType]);

  // Drag handlers
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (uploadType === 'bot') return;

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, [handleFileSelect, uploadType]);

  // Handle file input change
  const handleInputChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  // Open file dialog
  const openFileDialog = () => {
    if (uploadType === 'audio') {
      audioInputRef.current?.click();
    } else if (uploadType === 'transcript') {
      transcriptInputRef.current?.click();
    }
  };

  // Handle upload
  const handleUpload = async () => {
    if (!file || isUploading) return;

    setIsUploading(true);
    setError(null);

    try {
      let result;
      if (uploadType === 'audio') {
        result = await uploadMeeting(file);
      } else {
        result = await uploadTranscript(file);
      }

      // Navigate to processing or directly to transcript
      if (result.jobId) {
        navigate(`/processing/${result.jobId}`);
      } else if (result.meetingId) {
        navigate(`/meetings/${result.meetingId}/transcript`);
      }
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.');
      setIsUploading(false);
    }
  };

  // --- Bot Polling Logic ---
  useEffect(() => {
    let pollInterval;

    const terminalStatuses = ['left', 'completed', 'stopped', 'failed', 'error', 'kicked', 'finished', 'ended'];
    const lowerStatus = String(botStatus).toLowerCase();
    const isTerminal = terminalStatuses.some(s => lowerStatus.includes(s));

    // Valid if we have an ID and it's NOT terminal
    if (botId && !isTerminal) {
      pollInterval = setInterval(async () => {
        await checkBotStatus();
      }, 5000);
    }

    return () => clearInterval(pollInterval);
  }, [botId, botStatus]); // Only re-run if status changes

  // --- Auto-Process Logic ---
  // Use a ref to track if we've already processed this botId to prevent double-execution
  const processedBotIdRef = useRef(null);

  useEffect(() => {
    if (!botId) return;

    const endStatuses = ['left', 'completed', 'stopped', 'finished', 'failed', 'error', 'kicked', 'ended'];
    const normalizedStatus = String(botStatus).toLowerCase();
    const isEnded = endStatuses.some(s => normalizedStatus.includes(s));

    // Logic: Ended + Not yet processed this specific bot ID
    if (isEnded && processedBotIdRef.current !== botId) {
      console.log('🏁 Auto-processing triggered for:', botId, 'Status:', normalizedStatus);
      processedBotIdRef.current = botId; // Mark as processed immediately

      const process = async () => {
        try {
          addBotLog(`✅ Meeting ended (${botStatus}). fetching transcript...`);

          // 1. Fetch with retry
          let data = null;
          let retries = 20; // Increase retries (20 * 2s = 40s wait)
          while (retries > 0) {
            try {
              data = await getTranscript(botId);

              // Validate content: Must have segments
              const hasContent = (data && data.transcript && data.transcript.length > 0) ||
                (Array.isArray(data) && data.length > 0);

              if (hasContent) {
                addBotLog(`✅ Transcript found with items!`);
                break;
              } else {
                addBotLog(`⚠️ Transcript empty/incomplete. Retrying... (${retries})`);
              }
            } catch (e) {
              // 404 is also 'not ready'
              addBotLog(`⏳ Transcript not ready (404/Error)... retrying (${retries})`);
            }
            await new Promise(r => setTimeout(r, 2000));
            retries--;
          }

          if (!data || (Array.isArray(data) && data.length === 0) || (data.transcript && data.transcript.length === 0)) {
            addBotLog('⚠️ Warning: Uploading empty transcript (Timed out waiting for content)');
          }


          // SANITIZATON: Map data to ensure 'text' field exists for Mongoose validation
          // The bot API might return 'content' or nothing for silent segments
          const cleanData = {};

          const mapSegment = (s) => ({
            ...s,
            // Check deep nested 'transcription.transcript' first, then 'text', then 'content'
            text: (s.text) ||
              (s.content) ||
              (s.transcription && s.transcription.transcript) ||
              '[No speech detected]',
            // Robust speaker check
            speaker: s.speaker || s.participant || s.user_name || 'Speaker'
          });

          let rawSegments = [];
          if (data && data.transcript) {
            rawSegments = data.transcript;
          } else if (Array.isArray(data)) {
            rawSegments = data;
          }

          // Log keys for debugging speaker issue
          if (rawSegments.length > 0) {
            const sample = rawSegments[0];
            const keys = Object.keys(sample).join(', ');
            addBotLog(`🔍 Segment Keys: ${keys}`);
            if (sample.transcription) {
              addBotLog(`🔍 Nested Keys: ${Object.keys(sample.transcription).join(', ')}`);
            }
          }

          cleanData.transcript = rawSegments.map(mapSegment);

          setBotTranscript(data); // Save raw to state for preview

          // 2. Prepare Upload
          addBotLog('📤 Auto-uploading transcript...');
          const jsonString = JSON.stringify(cleanData, null, 2);
          const blob = new Blob([jsonString], { type: 'application/json' });
          const file = new File([blob], `meeting_${botId}.json`, { type: 'application/json' });

          addBotLog('🔄 Processing with AI...');
          const result = await uploadTranscript(file);

          if (result.meetingId) {
            addBotLog('✅ Success! Redirecting in 2s...');
            setTimeout(() => {
              navigate(`/meetings/${result.meetingId}/transcript`);
            }, 2000);
          } else {
            addBotLog('⚠️ Upload OK but no meetingId returned??');
          }

        } catch (err) {
          console.error('Auto-processing error:', err);
          addBotLog(`❌ Auto-process Failed: ${err.message}`);
          processedBotIdRef.current = null; // Reset lock to allow retry
        }
      };

      process();
    }
  }, [botId, botStatus, navigate]); // Check whenever status changes

  // Bot Handlers
  const handleBotJoin = async (e) => {
    e.preventDefault();
    if (!meetingUrl) return;

    setIsUploading(true);
    setError(null);
    setBotLogs([]);
    setBotTranscript(null);
    setBotId(''); // Reset ID
    setBotStatus(''); // Reset Status

    addBotLog(`Dispatching bot to ${meetingUrl}...`);

    try {
      const data = await joinMeeting(meetingUrl);
      setBotId(data.bot_id);
      setBotStatus('joining'); // Optimistic update
      addBotLog(`✅ Bot dispatched! ID: ${data.bot_id}`);
    } catch (err) {
      setError(err.message);
      addBotLog(`❌ Error: ${err.message}`);
      setIsUploading(false);
    }
  };

  const checkBotStatus = async () => {
    if (!botId) return;
    try {
      const data = await getBotStatus(botId);

      // Intelligent status extraction
      let newStatus = 'unknown';
      if (typeof data === 'string') newStatus = data;
      else if (data.status) newStatus = data.status;
      else if (data.data?.status) newStatus = data.data.status;
      else if (data.state) newStatus = data.state;

      // Log raw keys if status is weird
      if (newStatus === 'unknown') {
        console.log('Unknown status object keys:', Object.keys(data));
        addBotLog(`⚠️ Unknown Status Response: ${JSON.stringify(data).substring(0, 50)}`);
      }

      if (newStatus !== botStatus) {
        setBotStatus(newStatus);
        addBotLog(`🤖 Status Update: ${newStatus}`);
      }
    } catch (err) {
      console.error('Check Status Error:', err);
      if (err.message.includes('500')) {
        addBotLog(`⚠️ Server Error: ${err.message}`);
      } else if (err.message.includes('404')) {
        addBotLog(`⚠️ Bot Status: ${err.message}`);
      }
    }
  };

  const fetchBotTranscript = async () => {
    if (!botId) return;
    try {
      addBotLog('📥 Fetching transcript manually...');
      const data = await getTranscript(botId);
      setBotTranscript(data);
      addBotLog('✅ Transcript received!');
    } catch (err) {
      addBotLog(`❌ Transcript Error: ${err.message}`);
    }
  };


  // Remove selected file
  const removeFile = () => {
    setFile(null);
    setError(null);
  };

  // Switch upload type
  const switchType = (type) => {
    if (type !== uploadType) {
      setUploadType(type);
      setFile(null);
      setError(null);
    }
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="py-8 px-4">
      {/* Dashboard Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center mb-10"
      >
        <h1 className="text-3xl font-semibold text-primary mb-2">
          Meeting Intelligence Dashboard
        </h1>
        <p className="text-secondary max-w-md mx-auto">
          Upload recordings, transcripts, or join live meetings to extract insights
        </p>
      </motion.div>

      {/* Upload Type Selector */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="flex justify-center flex-wrap gap-4 mb-8"
      >
        {Object.entries(fileTypes).map(([type, config]) => (
          <button
            key={type}
            onClick={() => switchType(type)}
            className={`
              flex items-center gap-3 px-6 py-4 rounded-2xl border-2 transition-all duration-200
              ${uploadType === type
                ? 'border-accent bg-accent/10 shadow-lg'
                : 'border-[var(--border-color)] hover:border-accent/50 bg-[var(--bg-card)]'
              }
            `}
          >
            <div className={`
              w-12 h-12 rounded-xl flex items-center justify-center
              ${uploadType === type ? 'bg-accent/20' : 'bg-[var(--bg-surface)]'}
            `}>
              <svg
                className={`w-6 h-6 ${uploadType === type ? 'text-accent' : 'text-secondary'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {config.icon}
              </svg>
            </div>
            <div className="text-left">
              <p className={`font-medium ${uploadType === type ? 'text-accent' : 'text-primary'}`}>
                {config.label}
              </p>
              <p className="text-sm text-secondary">
                {config.description}
              </p>
            </div>
          </button>
        ))}
      </motion.div>

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="max-w-2xl mx-auto"
      >
        <div className="glass-card p-8">

          {/* CONTENT: If BOT type */}
          {uploadType === 'bot' ? (
            <div className="space-y-6">
              <form onSubmit={handleBotJoin} className="relative">
                <input
                  type="text"
                  placeholder="Paste Meeting URL (Zoom/Teams/Meet)"
                  className="w-full p-4 pl-12 border rounded-xl bg-[var(--bg-surface)] focus:ring-2 focus:ring-accent focus:outline-none transition-all"
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                  disabled={isUploading || !!botId}
                />
                <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>

                <button
                  type="submit"
                  disabled={isUploading || !!botId || !meetingUrl}
                  className="mt-4 w-full btn-primary py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? 'Launching Bot...' : 'Join Meeting Now'}
                </button>
              </form>

              {/* Bot Status & Logs */}
              {botId && (
                <div className="bg-gray-900 rounded-xl p-4 text-sm font-mono text-gray-300">
                  <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${botStatus === 'running' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span>
                      Status: <span className="text-white font-bold uppercase">{botStatus || 'INIT'}</span>
                    </span>
                    <div className="flex gap-2">
                      <button onClick={checkBotStatus} className="text-xs hover:text-white underline">Check Status</button>
                      <button onClick={fetchBotTranscript} className="text-xs text-green-400 hover:text-green-300 underline">Get Transcript</button>
                    </div>
                  </div>
                  <div className="h-40 overflow-y-auto space-y-1 custom-scrollbar">
                    {botLogs.length === 0 && <span className="opacity-50">Waiting for bot events...</span>}
                    {botLogs.map((log, i) => (
                      <div key={i}>{log}</div>
                    ))}
                  </div>
                </div>
              )}

              {botTranscript && (
                <div className="bg-green-50 border border-green-200 p-4 rounded-xl">
                  <h3 className="font-bold text-green-800 mb-2">Transcript Preview</h3>
                  <div className="max-h-40 overflow-y-auto text-sm text-gray-700 whitespace-pre-wrap">
                    {JSON.stringify(botTranscript, null, 2)}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* CONTENT: If FILE type */
            <>
              <div
                className={`
                    relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer
                    transition-all duration-200 ease-out
                    ${isDragging
                    ? 'border-accent bg-accent/5 scale-[1.02]'
                    : file
                      ? 'border-green-500/50 bg-green-500/5'
                      : 'border-[var(--border-color)] hover:border-accent/50 hover:bg-accent/5'
                  }
                    `}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={!file ? openFileDialog : undefined}
              >
                {/* Hidden inputs */}
                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleInputChange}
                  className="hidden"
                />
                <input
                  ref={transcriptInputRef}
                  type="file"
                  accept=".txt,.json,.srt,.vtt,.cc"
                  onChange={handleInputChange}
                  className="hidden"
                />

                <AnimatePresence mode="wait">
                  {file ? (
                    <motion.div
                      key="file-selected"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="flex flex-col items-center gap-4"
                    >
                      <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                        <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-primary truncate max-w-[400px]">{file.name}</p>
                        <p className="text-sm text-secondary mt-1">{formatFileSize(file.size)}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFile(); }}
                        className="text-sm text-secondary hover:text-red-500 transition-colors"
                      >
                        Remove file
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="drop-zone"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="flex flex-col items-center gap-4"
                    >
                      <motion.div
                        className={`w-20 h-20 rounded-full flex items-center justify-center
                            ${isDragging ? 'bg-accent/20' : 'bg-accent/10'} transition-colors`}
                        animate={isDragging ? { scale: 1.1 } : { scale: 1 }}
                      >
                        <svg
                          className={`w-10 h-10 ${isDragging ? 'text-accent' : 'text-accent/80'}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        >
                          {currentType.icon}
                        </svg>
                      </motion.div>

                      <div>
                        <p className="font-medium text-primary text-lg">
                          {isDragging ? 'Drop your file here' : `Drag & drop ${currentType.label.toLowerCase()}`}
                        </p>
                        <p className="text-secondary mt-1">or click to browse</p>
                      </div>

                      <p className="text-sm text-secondary">
                        {currentType.extensions.join(', ')} up to 500MB
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Upload button for files */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-8 w-full btn-primary py-4 text-lg"
                disabled={!file || isUploading}
                onClick={handleUpload}
              >
                {isUploading ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Analyze {uploadType === 'audio' ? 'Recording' : 'Transcript'}
                  </>
                )}
              </motion.button>
            </>
          )}

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-4 text-sm text-red-500 text-center"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

        </div>

        {/* Quick tips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 text-center"
        >
          <p className="text-sm text-secondary">
            {uploadType === 'transcript' && '💡 Tip: For best results, use SRT or VTT files with speaker labels'}
            {uploadType === 'audio' && '💡 Tip: Clear audio recordings produce more accurate transcriptions'}
            {uploadType === 'bot' && '💡 Tip: Ensure the bot is admitted to the meeting'}
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default UploadPage;
