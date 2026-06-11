import { config } from '../config/env.js';
import { Meeting, TranscriptVectorChunk } from '../models/index.js';

const PINECONE_CONTROL_URL = 'https://api.pinecone.io';

const sanitizeIndexName = (meetingId) => `meetflow-${meetingId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 45);

const formatTime = (seconds = 0) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

class VectorService {
  constructor() {
    this.pineconeApiKey = config.vectors.pineconeApiKey;
    this.embeddingApiKey = config.vectors.embeddingApiKey;
    this.embeddingModel = config.vectors.embeddingModel;
    this.dimension = config.vectors.embeddingDimension;
    this.topK = config.vectors.topK;
  }

  get isPineconeEnabled() {
    return Boolean(this.pineconeApiKey && this.embeddingApiKey);
  }

  buildTranscriptChunks(segments = [], options = {}) {
    const maxChars = options.maxChars || 1800;
    const overlapSegments = options.overlapSegments || 2;
    const chunks = [];
    let current = [];
    let currentLength = 0;

    const flush = () => {
      if (current.length === 0) return;
      const text = current.map((seg) => `[${formatTime(seg.start)}] ${seg.speaker}: ${seg.text}`).join('\n');
      chunks.push({
        chunkId: `chunk-${chunks.length + 1}`,
        text,
        speakerNames: [...new Set(current.map((seg) => seg.speaker).filter(Boolean))],
        start: current[0]?.start || 0,
        end: current[current.length - 1]?.end || 0
      });
      current = current.slice(-overlapSegments);
      currentLength = current.reduce((sum, seg) => sum + String(seg.text || '').length, 0);
    };

    for (const segment of segments) {
      const text = String(segment.text || '').trim();
      if (!text) continue;

      if (currentLength + text.length > maxChars && current.length > 0) {
        flush();
      }

      current.push({
        speaker: segment.speaker || 'Unknown',
        start: segment.start || 0,
        end: segment.end || segment.start || 0,
        text
      });
      currentLength += text.length;
    }

    flush();
    return chunks;
  }

  async indexTranscript({ meeting, transcript }) {
    const chunks = this.buildTranscriptChunks(transcript.segments || []);
    const indexName = sanitizeIndexName(meeting._id.toString());
    const namespace = meeting._id.toString();

    await TranscriptVectorChunk.deleteMany({ meetingId: meeting._id });

    if (chunks.length > 0) {
      await TranscriptVectorChunk.insertMany(chunks.map((chunk) => ({
        organizationId: meeting.organizationId,
        meetingId: meeting._id,
        chunkId: chunk.chunkId,
        text: chunk.text,
        speakerNames: chunk.speakerNames,
        start: chunk.start,
        end: chunk.end,
        pineconeIndexName: indexName,
        pineconeVectorId: `${namespace}-${chunk.chunkId}`,
        metadata: {
          startTime: formatTime(chunk.start),
          endTime: formatTime(chunk.end)
        }
      })));
    }

    const vectorUpdate = {
      vectorIndexName: indexName,
      vectorNamespace: namespace,
      vectorChunkCount: chunks.length,
      vectorStatus: this.isPineconeEnabled ? 'pending' : 'unavailable',
      vectorError: this.isPineconeEnabled ? null : 'PINECONE_API_KEY and OPENAI_API_KEY are required for Pinecone indexing'
    };

    await Meeting.findByIdAndUpdate(meeting._id, vectorUpdate);

    if (!this.isPineconeEnabled || chunks.length === 0) {
      return { ...vectorUpdate, chunks };
    }

    try {
      const host = await this.ensurePineconeIndex(indexName);
      const embeddings = await this.embedTexts(chunks.map((chunk) => chunk.text));
      const vectors = chunks.map((chunk, index) => ({
        id: `${namespace}-${chunk.chunkId}`,
        values: embeddings[index],
        metadata: {
          meetingId: namespace,
          organizationId: meeting.organizationId.toString(),
          chunkId: chunk.chunkId,
          text: chunk.text.slice(0, 3500),
          speakers: chunk.speakerNames.join(', '),
          start: chunk.start,
          end: chunk.end,
          startTime: formatTime(chunk.start),
          endTime: formatTime(chunk.end)
        }
      }));

      await this.upsertPineconeVectors(host, namespace, vectors);
      await Meeting.findByIdAndUpdate(meeting._id, {
        vectorStatus: 'indexed',
        vectorError: null
      });

      return { indexName, namespace, chunks, status: 'indexed' };
    } catch (error) {
      console.error('[Vector] Pinecone indexing error:', error.message);
      await Meeting.findByIdAndUpdate(meeting._id, {
        vectorStatus: 'error',
        vectorError: error.message
      });
      return { indexName, namespace, chunks, status: 'error', error: error.message };
    }
  }

  async retrieve(meeting, question, topK = this.topK) {
    if (this.isPineconeEnabled && meeting.vectorStatus === 'indexed' && meeting.vectorIndexName) {
      try {
        return await this.retrieveFromPinecone(meeting, question, topK);
      } catch (error) {
        console.error('[Vector] Pinecone retrieval error:', error.message);
      }
    }

    return this.retrieveFromMongo(meeting, question, topK);
  }

  async retrieveFromMongo(meeting, question, topK) {
    const chunks = await TranscriptVectorChunk.find({ meetingId: meeting._id });
    const terms = String(question || '').toLowerCase().split(/\W+/).filter((term) => term.length > 2);

    return chunks
      .map((chunk) => {
        const text = chunk.text.toLowerCase();
        const score = terms.reduce((sum, term) => sum + (text.includes(term) ? 1 : 0), 0);
        return {
          score,
          text: chunk.text,
          metadata: {
            chunkId: chunk.chunkId,
            startTime: formatTime(chunk.start),
            endTime: formatTime(chunk.end),
            speakers: chunk.speakerNames?.join(', ') || ''
          }
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async retrieveFromPinecone(meeting, question, topK) {
    const host = await this.getPineconeIndexHost(meeting.vectorIndexName);
    const [embedding] = await this.embedTexts([question]);
    const response = await fetch(`https://${host}/query`, {
      method: 'POST',
      headers: this.pineconeDataHeaders(),
      body: JSON.stringify({
        vector: embedding,
        namespace: meeting.vectorNamespace || meeting._id.toString(),
        topK,
        includeMetadata: true
      })
    });

    if (!response.ok) {
      throw new Error(`Pinecone query failed: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    return (data.matches || []).map((match) => ({
      score: match.score,
      text: match.metadata?.text || '',
      metadata: match.metadata || {}
    }));
  }

  async ensurePineconeIndex(indexName) {
    const existingHost = await this.getPineconeIndexHost(indexName).catch(() => null);
    if (existingHost) return existingHost;

    const response = await fetch(`${PINECONE_CONTROL_URL}/indexes`, {
      method: 'POST',
      headers: this.pineconeControlHeaders(),
      body: JSON.stringify({
        name: indexName,
        dimension: this.dimension,
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: config.vectors.pineconeCloud,
            region: config.vectors.pineconeRegion
          }
        }
      })
    });

    if (!response.ok && response.status !== 409) {
      throw new Error(`Pinecone index create failed: ${response.status} ${await response.text()}`);
    }

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const host = await this.getPineconeIndexHost(indexName).catch(() => null);
      if (host) return host;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error(`Pinecone index ${indexName} was not ready in time`);
  }

  async getPineconeIndexHost(indexName) {
    const response = await fetch(`${PINECONE_CONTROL_URL}/indexes/${indexName}`, {
      headers: this.pineconeControlHeaders()
    });
    if (!response.ok) {
      throw new Error(`Pinecone describe index failed: ${response.status}`);
    }
    const data = await response.json();
    if (!data.host) throw new Error('Pinecone index host missing');
    return data.host;
  }

  async upsertPineconeVectors(host, namespace, vectors) {
    const response = await fetch(`https://${host}/vectors/upsert`, {
      method: 'POST',
      headers: this.pineconeDataHeaders(),
      body: JSON.stringify({ namespace, vectors })
    });
    if (!response.ok) {
      throw new Error(`Pinecone upsert failed: ${response.status} ${await response.text()}`);
    }
  }

  async embedTexts(texts) {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.embeddingApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.embeddingModel,
        input: texts
      })
    });

    if (!response.ok) {
      throw new Error(`Embedding request failed: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    return data.data.map((item) => item.embedding);
  }

  pineconeControlHeaders() {
    return {
      'Api-Key': this.pineconeApiKey,
      'Content-Type': 'application/json'
    };
  }

  pineconeDataHeaders() {
    return {
      'Api-Key': this.pineconeApiKey,
      'Content-Type': 'application/json'
    };
  }

  async answerWithGemini(question, context) {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const prompt = `You are a helpful assistant answering questions about a meeting.\nUse the provided transcript context to answer the user's question.\nIf the answer is not contained in the context, politely say so.\n\nContext:\n${context}\n\nQuestion:\n${question}\n\nAnswer:`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiApiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No answer generated.';
  }
}

export const vectorService = new VectorService();
export default vectorService;
