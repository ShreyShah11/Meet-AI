/**
 * Chunking Service
 * Splits transcript into chunks for LLM processing
 */

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  maxChunkTokens: 2000,     // Approximate token limit per chunk
  overlapSentences: 2,       // Sentences to overlap between chunks
  tokensPerWord: 1.3,        // Approximate tokens per word
};

class ChunkingService {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Chunk transcript segments for LLM processing
   * @param {Array} segments - Transcript segments
   * @returns {Array} - Array of chunk objects
   */
  chunkTranscript(segments) {
    if (!segments || segments.length === 0) {
      return [];
    }

    console.log(`[Chunking] Processing ${segments.length} segments`);

    // Flatten segments into text blocks by speaker
    const textBlocks = this.segmentsToBlocks(segments);

    // Split into chunks
    const chunks = this.splitIntoChunks(textBlocks);

    console.log(`[Chunking] Created ${chunks.length} chunks`);
    return chunks;
  }

  /**
   * Convert segments to text blocks with speaker context
   */
  segmentsToBlocks(segments) {
    return segments.map((seg, idx) => ({
      index: idx,
      speaker: seg.speaker,
      text: seg.text,
      start: seg.start,
      end: seg.end,
      wordCount: seg.text.split(/\s+/).length
    }));
  }

  /**
   * Split text blocks into chunks respecting token limits
   */
  splitIntoChunks(blocks) {
    // Single chunk logic as requested by user
    if (blocks.length === 0) return [];

    const text = blocks.map(b => `${b.speaker}: ${b.text}`).join('\n');
    const wordCount = blocks.reduce((sum, b) => sum + b.wordCount, 0);
    const speakers = [...new Set(blocks.map(b => b.speaker))];

    const singleChunk = {
      index: 0,
      text,
      wordCount,
      tokenEstimate: Math.ceil(wordCount * this.config.tokensPerWord),
      startTime: blocks[0].start,
      endTime: blocks[blocks.length - 1].end,
      blocks,
      speakers,
      segmentCount: blocks.length
    };

    return [singleChunk];
  }

  /**
   * Get overlap blocks from previous chunk (Unused now)
   */
  getOverlapBlocks(blocks) {
    return [];
  }

  /**
   * Finalize chunk with metadata (Unused now)
   */
  finalizeChunk(chunk, index) {
    return chunk;
  }

  /**
   * Format time in seconds to HH:MM:SS
   */
  formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

export const chunkingService = new ChunkingService();
export default chunkingService;
