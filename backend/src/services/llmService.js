/**
 * LLM Service
 * Handles extraction of summaries and tasks from transcript
 *
 * DUMMY IMPLEMENTATION - Replace with real LLM provider later
 * Supports: Gemini, Groq, Ollama, OpenAI
 */
import { config } from '../config/env.js';

class LLMService {
  constructor() {
    this.provider = config.llm.provider;
    console.log(`[LLM] Provider: ${this.provider}`);
  }

  /**
   * Extract insights from a single chunk (Pass 1)
   * @param {Object} chunk - Chunk object with text
   * @returns {Promise<Object>} - Extracted insights
   */
  async extractFromChunk(chunk) {
    console.log(`[LLM] Pass 1 - Extracting from chunk ${chunk.index}`);

    // DUMMY: Generate mock extraction based on chunk content
    if (this.provider === 'dummy') {
      return this.dummyChunkExtraction(chunk);
    }

    // TODO: Add real LLM providers
    // switch (this.provider) {
    //   case 'gemini': return this.extractWithGemini(chunk);
    //   case 'groq': return this.extractWithGroq(chunk);
    //   case 'ollama': return this.extractWithOllama(chunk);
    //   case 'openai': return this.extractWithOpenAI(chunk);
    // }

    throw new Error(`LLM provider '${this.provider}' not implemented`);
  }

  /**
   * Merge chunk extractions into final summary (Pass 2)
   * @param {Array} chunkExtractions - Array of chunk extraction results
   * @returns {Promise<Object>} - Merged summary
   */
  async mergeExtractions(chunkExtractions) {
    console.log(`[LLM] Pass 2 - Merging ${chunkExtractions.length} extractions`);

    if (this.provider === 'dummy') {
      return this.dummyMerge(chunkExtractions);
    }

    // TODO: Add real LLM merge logic

    throw new Error(`LLM provider '${this.provider}' not implemented`);
  }

  /**
   * DUMMY: Generate mock extraction for a chunk
   */
  dummyChunkExtraction(chunk) {
    const topics = [];
    const decisions = [];
    const actionItems = [];

    // Simple keyword-based extraction (dummy logic)
    const text = chunk.text.toLowerCase();

    // Extract topics based on keywords
    if (text.includes('q4') || text.includes('quarter')) {
      topics.push('Q4 Planning');
    }
    if (text.includes('mobile') || text.includes('app')) {
      topics.push('Mobile App Development');
    }
    if (text.includes('onboarding')) {
      topics.push('User Onboarding');
    }
    if (text.includes('europe') || text.includes('gdpr')) {
      topics.push('European Expansion');
    }

    // Extract decisions
    if (text.includes('will begin') || text.includes('will start')) {
      decisions.push(`Initiative to start based on discussion in chunk ${chunk.index + 1}`);
    }
    if (text.includes('will lead') || text.includes('take ownership')) {
      decisions.push(`Ownership assignment from chunk ${chunk.index + 1}`);
    }

    // Extract action items from speaker context
    for (const speaker of chunk.speakers) {
      if (text.includes('roadmap') || text.includes('deadline')) {
        actionItems.push({
          title: `Follow-up from ${speaker}`,
          description: `Action item identified in chunk ${chunk.index + 1}`,
          owner: speaker,
          priority: 'Medium',
          confidence: 70 + Math.floor(Math.random() * 20)
        });
      }
    }

    return {
      chunkIndex: chunk.index,
      summary: `Discussion covering ${topics.join(', ') || 'various topics'} (${this.formatTime(chunk.startTime)} - ${this.formatTime(chunk.endTime)})`,
      topics,
      decisions,
      actionItems
    };
  }

  /**
   * DUMMY: Merge all chunk extractions
   */
  dummyMerge(chunkExtractions) {
    // Collect all topics, decisions, and action items
    const allTopics = new Set();
    const allDecisions = [];
    const allActionItems = [];

    for (const extraction of chunkExtractions) {
      extraction.topics?.forEach(t => allTopics.add(t));
      allDecisions.push(...(extraction.decisions || []));
      allActionItems.push(...(extraction.actionItems || []));
    }

    // Generate executive summary
    const executive = `The Q4 planning meeting covered ${allTopics.size} main topics: ${[...allTopics].join(', ')}. The team made ${allDecisions.length} key decisions and identified ${allActionItems.length} action items. Clear ownership was assigned for each initiative with aggressive timelines established.`;

    // Deduplicate and enrich action items
    const mergedActionItems = this.deduplicateActionItems(allActionItems);

    // Add dummy items if none found
    if (mergedActionItems.length === 0) {
      mergedActionItems.push(
        { title: 'Lead onboarding flow redesign', description: 'Create detailed roadmap', owner: 'Sarah Miller', priority: 'High', dueDate: this.getDueDate(7), confidence: 95 },
        { title: 'Start mobile app development', description: 'Begin engineering work', owner: 'Mike Johnson', priority: 'High', dueDate: this.getDueDate(3), confidence: 92 },
        { title: 'Coordinate design reviews', description: 'Ensure accessibility compliance', owner: 'Lisa Park', priority: 'Medium', dueDate: this.getDueDate(14), confidence: 88 },
        { title: 'Prepare European market analysis', description: 'GDPR compliance for UK and Germany', owner: 'Alex Chen', priority: 'Medium', dueDate: this.getDueDate(21), confidence: 85 }
      );
    }

    return {
      executive,
      topics: [...allTopics],
      decisions: [...new Set(allDecisions)],
      actionItems: mergedActionItems,
      chunkCount: chunkExtractions.length,
      extractionModel: 'dummy'
    };
  }

  /**
   * Deduplicate action items by title similarity
   */
  deduplicateActionItems(items) {
    const seen = new Map();

    for (const item of items) {
      const key = item.title.toLowerCase().slice(0, 20);
      if (!seen.has(key)) {
        seen.set(key, {
          ...item,
          id: seen.size + 1,
          dueDate: item.dueDate || this.getDueDate(7 + seen.size * 3)
        });
      }
    }

    return [...seen.values()];
  }

  /**
   * Get due date N days from now
   */
  getDueDate(daysFromNow) {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().split('T')[0];
  }

  /**
   * Format seconds to HH:MM:SS
   */
  formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

export const llmService = new LLMService();
export default llmService;
