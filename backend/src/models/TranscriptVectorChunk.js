import mongoose from 'mongoose';

const transcriptVectorChunkSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  meetingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meeting',
    required: true,
    index: true
  },
  chunkId: {
    type: String,
    required: true
  },
  text: {
    type: String,
    required: true
  },
  speakerNames: [String],
  start: Number,
  end: Number,
  pineconeIndexName: String,
  pineconeVectorId: String,
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: { type: Date, default: Date.now }
});

transcriptVectorChunkSchema.index({ meetingId: 1, chunkId: 1 }, { unique: true });
transcriptVectorChunkSchema.index({ meetingId: 1, text: 'text' });

export const TranscriptVectorChunk = mongoose.model('TranscriptVectorChunk', transcriptVectorChunkSchema);
export default TranscriptVectorChunk;
