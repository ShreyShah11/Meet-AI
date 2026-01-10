import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { uploadMeeting, uploadTranscript } from '../services/api';

/**
 * UploadPage - Dashboard-style landing page for uploading meetings
 * Supports both audio files and transcript files (CC/TXT/JSON)
 */
const UploadPage = () => {
  const navigate = useNavigate();
  const audioInputRef = useRef(null);
  const transcriptInputRef = useRef(null);

  // State
  const [uploadType, setUploadType] = useState('transcript'); // 'audio' or 'transcript'
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);

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
    }
  };

  const currentType = fileTypes[uploadType];

  // Handle file selection
  const handleFileSelect = useCallback((selectedFile) => {
    setError(null);

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

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, [handleFileSelect]);

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
    } else {
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
          Upload your meeting recording or transcript to extract insights, summaries, and action items
        </p>
      </motion.div>

      {/* Upload Type Selector */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="flex justify-center gap-4 mb-8"
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

      {/* Upload Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="max-w-2xl mx-auto"
      >
        <div className="glass-card p-8">
          {/* Drop zone */}
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

          {/* Upload button */}
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
        </div>

        {/* Quick tips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 text-center"
        >
          <p className="text-sm text-secondary">
            {uploadType === 'transcript'
              ? '💡 Tip: For best results, use SRT or VTT files with speaker labels'
              : '💡 Tip: Clear audio recordings produce more accurate transcriptions'
            }
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default UploadPage;
