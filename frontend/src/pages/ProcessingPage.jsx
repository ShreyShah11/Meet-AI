import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getJobStatus } from '../services/api';

/**
 * ProcessingPage - Enhanced progress display during audio analysis
 * Shows detailed step progress with real-time updates from backend
 */
const ProcessingPage = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();

  // Processing steps - matches backend steps
  const allSteps = [
    { id: 'queued', label: 'Queued', description: 'Waiting to start processing' },
    { id: 'uploading', label: 'Uploading', description: 'Transferring audio file' },
    { id: 'connecting', label: 'Connecting to AI', description: 'Establishing connection to transcription service' },
    { id: 'transcribing', label: 'Transcribing & Diarizing', description: 'Identifying speakers and converting speech to text' },
    { id: 'saving_transcript', label: 'Saving Transcript', description: 'Storing transcription results' },
    { id: 'chunking', label: 'Analyzing Content', description: 'Breaking down conversation for analysis' },
    { id: 'extracting', label: 'Extracting Insights', description: 'Finding key decisions and action items' },
    { id: 'merging', label: 'Generating Summary', description: 'Creating your meeting summary' },
    { id: 'saving_summary', label: 'Saving Results', description: 'Finalizing your meeting analysis' },
    { id: 'done', label: 'Complete!', description: 'Your meeting is ready to view' },
  ];

  // State
  const [currentStep, setCurrentStep] = useState('queued');
  const [stepLabel, setStepLabel] = useState('Queued');
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState(null);
  const [startTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);

  // Update elapsed time
  useEffect(() => {
    const timer = setInterval(() => {
      if (!isComplete && !error) {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime, isComplete, error]);

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get step index
  const getStepIndex = (stepId) => allSteps.findIndex(s => s.id === stepId);

  // Poll for job status
  const pollStatus = useCallback(async () => {
    if (!jobId) {
      setError('No job ID provided');
      return;
    }

    try {
      const status = await getJobStatus(jobId);

      if (status.status === 'error') {
        setError(status.error || 'Processing failed. Please try again.');
        return;
      }

      // Update state from backend
      if (status.step) setCurrentStep(status.step);
      if (status.label) setStepLabel(status.label);
      if (status.progress !== undefined) setProgress(status.progress);

      if (status.status === 'done') {
        setIsComplete(true);
        setTimeout(() => {
          const meetingId = status.meetingId || sessionStorage.getItem('currentMeetingId');
          if (meetingId) {
            navigate(`/meetings/${meetingId}/transcript`);
          } else {
            setError('Meeting ID not found');
          }
        }, 1500);
      }
    } catch (err) {
      console.error('Status poll error:', err);
    }
  }, [jobId, navigate]);

  // Start polling on mount
  useEffect(() => {
    if (!jobId) {
      navigate('/');
      return;
    }

    pollStatus();
    const interval = setInterval(() => {
      if (!isComplete && !error) pollStatus();
    }, 1000);

    return () => clearInterval(interval);
  }, [jobId, pollStatus, isComplete, error, navigate]);

  // Get step status for display
  const getStepStatus = (stepId) => {
    const currentIndex = getStepIndex(currentStep);
    const stepIndex = getStepIndex(stepId);

    if (isComplete || stepId === 'done' && currentStep === 'done') return 'complete';
    if (stepIndex < currentIndex) return 'complete';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };

  // Visible steps (skip queued when past it)
  const visibleSteps = allSteps.filter(s => s.id !== 'queued');

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="glass-card p-10 w-full max-w-lg"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.h1
            className="text-2xl font-semibold text-primary mb-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {error ? 'Processing Error' : isComplete ? 'Analysis Complete!' : 'Analyzing Your Meeting'}
          </motion.h1>
          <motion.p className="text-secondary" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {error ? 'Something went wrong' : isComplete ? 'Redirecting to your results...' : stepLabel}
          </motion.p>
        </div>

        {/* Error state */}
        {error ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-red-500 mb-6">{error}</p>
            <button onClick={() => navigate('/')} className="btn-primary">Try Again</button>
          </motion.div>
        ) : (
          <>
            {/* Progress bar */}
            <div className="mb-8">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-secondary">Progress</span>
                <span className="text-primary font-medium">{progress}%</span>
              </div>
              <div className="h-2 bg-[var(--border-color)] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-accent rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
              <div className="flex justify-between text-xs mt-2 text-secondary">
                <span>Elapsed: {formatTime(elapsedTime)}</span>
                <span>Step {getStepIndex(currentStep) + 1} of {allSteps.length}</span>
              </div>
            </div>

            {/* Step list - compact */}
            <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
              {visibleSteps.map((step, index) => {
                const status = getStepStatus(step.id);
                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
                      status === 'active' ? 'bg-accent/10' : ''
                    }`}
                  >
                    {/* Status icon */}
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                      ${status === 'complete' ? 'bg-green-500 text-white' :
                        status === 'active' ? 'bg-accent text-white' :
                        'bg-[var(--bg-surface)] border border-[var(--border-color)] text-secondary'}
                    `}>
                      {status === 'complete' ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : status === 'active' ? (
                        <motion.div
                          className="w-3 h-3 bg-white rounded-full"
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        />
                      ) : (
                        <span className="text-xs">{index + 1}</span>
                      )}
                    </div>

                    {/* Label */}
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate ${
                        status === 'active' ? 'text-accent' :
                        status === 'complete' ? 'text-primary' : 'text-secondary'
                      }`}>
                        {step.label}
                      </p>
                      {status === 'active' && (
                        <p className="text-xs text-secondary truncate">{step.description}</p>
                      )}
                    </div>

                    {/* Active indicator */}
                    {status === 'active' && (
                      <motion.div
                        className="px-2 py-1 rounded-full bg-accent/20 text-accent text-xs font-medium"
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        Processing
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Info footer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-6 pt-4 border-t border-[var(--border-color)]"
            >
              <div className="flex items-center gap-3 text-sm text-secondary">
                <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p>Processing time depends on audio length. Typically 30 seconds to 3 minutes.</p>
              </div>
            </motion.div>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default ProcessingPage;
