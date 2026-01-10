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
    const chunks = [];
    let currentChunk = {
      blocks: [],
      text: '',
      wordCount: 0,
      startTime: 0,
      endTime: 0
    };

    const maxWords = Math.floor(this.config.maxChunkTokens / this.config.tokensPerWord);

    for (const block of blocks) {
      const potentialWordCount = currentChunk.wordCount + block.wordCount;

      // If adding this block exceeds limit, save current chunk and start new
      if (potentialWordCount > maxWords && currentChunk.blocks.length > 0) {
        chunks.push(this.finalizeChunk(currentChunk, chunks.length));

        // Start new chunk with overlap
        const overlapBlocks = this.getOverlapBlocks(currentChunk.blocks);
        currentChunk = {
          blocks: [...overlapBlocks],
          text: overlapBlocks.map(b => `${b.speaker}: ${b.text}`).join('\n'),
          wordCount: overlapBlocks.reduce((sum, b) => sum + b.wordCount, 0),
          startTime: overlapBlocks[0]?.start || block.start,
          endTime: overlapBlocks[overlapBlocks.length - 1]?.end || block.start
        };
      }

      // Add block to current chunk
      currentChunk.blocks.push(block);
      currentChunk.text += `\n${block.speaker}: ${block.text}`;
      currentChunk.wordCount += block.wordCount;

      if (currentChunk.blocks.length === 1) {
        currentChunk.startTime = block.start;
      }
      currentChunk.endTime = block.end;
    }

    // Don't forget the last chunk
    if (currentChunk.blocks.length > 0) {
      chunks.push(this.finalizeChunk(currentChunk, chunks.length));
    }

    return chunks;
  }

  /**
   * Get overlap blocks from previous chunk
   */
  getOverlapBlocks(blocks) {
    const overlapCount = Math.min(this.config.overlapSentences, blocks.length);
    return blocks.slice(-overlapCount);
  }

  /**
   * Finalize chunk with metadata
   */
  finalizeChunk(chunk, index) {
    const speakers = [...new Set(chunk.blocks.map(b => b.speaker))];

    return {
      index,
      text: chunk.text.trim(),
      wordCount: chunk.wordCount,
      tokenEstimate: Math.ceil(chunk.wordCount * this.config.tokensPerWord),
      startTime: chunk.startTime,
      endTime: chunk.endTime,
      speakers,
      segmentCount: chunk.blocks.length
    };
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
