/**
 * Upload Middleware
 * Multer configuration for audio file uploads
 */
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Storage configuration
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4().slice(0, 8)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

/**
 * File filter - accept audio only
 */
const fileFilter = (req, file, cb) => {
  // Allowed audio types
  const audioTypes = [
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
    'audio/wave', 'audio/webm', 'audio/ogg', 'audio/flac',
    'audio/x-flac', 'audio/mp4', 'audio/x-m4a', 'audio/aac'
  ];

  // Allowed transcript types
  const transcriptTypes = [
    'text/plain', 'application/json', 'text/vtt', 'application/x-subrip', 'text/srt'
  ];

  // Generic validation based on fieldname
  if (file.fieldname === 'transcript') {
      // Allow typical transcript extensions/mimes
      const ext = path.extname(file.originalname).toLowerCase();
      if (['.txt', '.json', '.srt', '.vtt', '.cc'].includes(ext) ||
          transcriptTypes.includes(file.mimetype)) {
          return cb(null, true);
      }
      return cb(new Error('Invalid transcript file. Allowed: .txt, .json, .srt, .vtt'), false);
  }

  // Audio validation (default or explicit 'audio' field)
  if (file.mimetype.startsWith('audio/') || audioTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only audio files are allowed'), false);
  }
};

/**
 * Multer upload instance
 */
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB
  }
});

export default upload;
