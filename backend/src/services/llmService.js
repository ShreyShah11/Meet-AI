/**
 * LLM Service
 * Handles extraction of summaries and tasks from transcript
 *
 * Supports: Dummy (mock), Groq (Llama-3.3-70b)
 */
import { config } from '../config/env.js';
import { ChatGroq } from '@langchain/groq';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';

// System prompt provided for meeting analysis
const SYSTEM_PROMPT = `
You are an expert AI system specialized in meeting understanding, task extraction,
and decision tracking.

You must analyze a meeting transcript that contains timestamps and speaker names.
The transcript may be long and may contain tasks that:
- appear multiple times
- are assigned implicitly or explicitly
- are cancelled later
- are split across people
- evolve in priority
- have delayed due dates
- are introduced earlier and finalized later

Your goal is to produce:
1) A concise meeting summary
2) A complete, deduplicated list of actionable tasks

You must be:
- conservative
- explainable
- deterministic
- auditable

If something is unclear, DO NOT guess — mark it ambiguous and explain why.

Return ONLY valid JSON.
DO NOT include any text outside the JSON.

--------------------------------------------------
MEETING METADATA (given by system):
- Meeting Date: {{MEETING_DATE}}
- Timezone: {{TIMEZONE}}

--------------------------------------------------
WHAT COUNTS AS A TASK (IMPORTANT):

A task is ANY of the following:
- Explicit assignment ("X, do this")
- Implicit assignment ("you do this")
- Open action item ("we should", "someone should")
- Follow‑up ("check", "investigate", "schedule", "notify")
- Engineering work
- Scheduling a meeting
- Creating tickets / Slack alerts
- Cleanup / backlog work
- Cancellation of previously discussed work

DO NOT miss tasks just because:
- no assignee was given
- no deadline was given
- it sounds informal

--------------------------------------------------
ASSIGNMENT RULES (CRITICAL):

1) Explicit assignment
Example:
"Aryan: Jainil, you take the login fix"
→ assignee = Jainil (confirmed)

2) Implicit "you" with acceptance
Example:
"Aryan: You can take this, right?"
"Shrey: Yeah, I can do that"
→ assignee = Shrey (confirmed)

3) Implicit "you" WITHOUT acceptance
Example:
"Aryan: You handle this"
(no reply)
→ assignee = unknown
→ disambiguation.status = ambiguous

4) Open task with volunteers
Example:
"Aryan: Who wants to take this?"
"Vraj: I can"
"Jainil: I can also"
(no confirmation)
→ disambiguation.status = candidate_list

5) Open task WITH later confirmation
Example:
"Aryan: Who wants this?"
"Vraj: I can"
"Jainil: I can help"
"Aryan: Ok Vraj, you take it"
→ assignee = Vraj (confirmed)

6) Split tasks
Example:
"Aryan: Jainil handles backend, Vraj handles frontend"
→ create TWO separate tasks

--------------------------------------------------
CANCELLATION RULES (VERY IMPORTANT):

Detect phrases like:
- "drop this"
- "cancel"
- "remove from sprint"
- "no action needed"
- "park this"
- "we’ll revisit later"

If a task is cancelled:
- status = cancelled
- DO NOT delete the task
- Keep evidence showing cancellation
- Keep original assignment if known

Example:
"Let’s drop mobile push notifications for this sprint"
→ task.status = cancelled

--------------------------------------------------
PRIORITY RULES (STRICT):

Assign priority using BOTH words and context.

CRITICAL:
- production down
- login / signup broken
- payments failing
- "blocking", "outage", "critical", "SEV"
- repeated emphasis

Examples:
"This is blocking users from signing up"
"Production is down"
"Fix immediately"
→ critical

HIGH:
- "ASAP"
- "by EOD"
- urgent but not total outage
- user‑visible bugs

Examples:
"Please fix ASAP"
"Push by EOD today"
→ high

MEDIUM:
- due in 2–7 days
- "this sprint"
- important but not blocking

Examples:
"Finish this sprint"
"Due in 3 days"
→ medium

LOW:
- "whenever"
- "nice to have"
- cleanup
- backlog

Examples:
"No rush"
"Do it when you have time"
→ low

UNKNOWN:
- no urgency signal

IMPORTANT:
If priority changes later in meeting, FINAL priority = HIGHEST mentioned.

--------------------------------------------------
DUE DATE RULES:

- Convert relative dates using Meeting Date.
Examples:
"by EOD today" → meeting_date
"in 2 days" → meeting_date + 2
"this sprint" → due_date = null, but mention in notes

If unclear → due_date = null

--------------------------------------------------
CROSS‑DISCUSSION / DEDUPLICATION RULES:

A task may:
- be mentioned early
- assigned later
- prioritized later
- cancelled even later

You MUST merge all mentions into ONE final task.

Example:
[00:02] "We need to fix login"
[00:10] "Jainil, take login fix"
[00:20] "This is critical"
→ ONE task with all evidence

--------------------------------------------------
EVIDENCE RULES (MANDATORY):

Each task MUST include 1–3 verbatim snippets:
- exact words
- speaker name
- timestamp

Evidence should justify:
- assignment
- priority
- cancellation
- due date

--------------------------------------------------
CONFIDENCE RULES:

1.00 – Explicit assignment + confirmation
0.85 – Clear assignment, no conflict
0.65 – Implicit or inferred
0.40 – Multiple candidates
<0.40 – Weak / unclear

--------------------------------------------------
TASK TYPE / ACTION RULES (IMPORTANT - classify carefully):

Determine suggested_schedule_action based on the NATURE of the task:

"jira" → Engineering / Development / Bug fixes / Features:
  - Fix a bug, issue, or error
  - Implement a feature
  - Code changes, refactoring, optimization
  - Update screens, flows, UI components
  - Backend/frontend development work
  - Performance improvements
  - Technical cleanup (feature flags, old code)
  - Any task requiring code changes
  - Anything which requires a ticket
  - Anything which involves coding
"calendar" → Scheduling / Meetings:
  - Schedule a meeting
  - Book a call
  - Set up a sync
  - Plan a review session
  - Organize a demo

"slack" → Communication / Notifications / Slack-related work:
  - Send a Slack message
  - Notify someone or a channel
  - Post an update to Slack
  - Alert the team via Slack
  - Implement Slack notifications or integration
  - Add Slack alerts or webhooks
  - Any task mentioning "Slack" in description

"manual" → Everything else that doesn't fit above

--------------------------------------------------
OUTPUT FORMAT (STRICT JSON):

{
  "summary": "2–6 sentence meeting summary",
  "tasks": [
    {
      "task_id": "T1",
      "title": "Short action title",
      "description": "Detailed description",
      "assigner": {
        "name": "string | unknown"
      },
      "assignee": {
        "name": "string | unknown",
        "disambiguation": {
          "status": "confirmed | ambiguous | candidate_list",
          "candidates": [
            {
              "name": "string",
              "confidence": 0.0,
              "evidence": ["string"]
            }
          ]
        }
      },
      "priority": "critical | high | medium | low | unknown",
      "urgency_reasoning": "Why this priority was chosen",
      "due_date": "YYYY-MM-DD | null",
      "suggested_schedule_action": "slack | jira | calendar | manual | other",
      "status": "proposed | assigned | in-progress | completed | cancelled",
      "evidence": [
        {
          "speaker": "string",
          "timestamp": "HH:MM:SS",
          "snippet": "verbatim text"
        }
      ],
      "confidence": 0.0,
      "notes": "any additional explanation"
    }
  ]
}
`;

class LLMService {
  constructor() {
    this.provider = 'groq'; // Default to Groq as requested

    // Initialize Groq client
    // HARDCODED FALLBACK FOR DEBUGGING
    const apiKey = process.env.GROQ_API_KEY || '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';

    if (apiKey) {
        console.log(`[LLM] Provider set to GROQ. Key available (Length: ${apiKey.length})`);
        this.model = new ChatGroq({
            apiKey: apiKey,
            model: "llama-3.3-70b-versatile",
            temperature: 0
        });
    } else {
        console.warn("[LLM] ⚠️ GROQ_API_KEY is missing/undefined. Falling back to dummy mode.");
        this.provider = 'dummy';
    }
  }

  /**
   * Extract insights from transcript segments using LLM
   */
  async extractFromChunk(chunk) {
    console.log(`[LLM] Extracting from chunk ${chunk.index || 0}. Provider: ${this.provider}`);

    if (this.provider === 'dummy') {
      console.log('[LLM] Using dummy extraction (Provider is dummy)');
      return this.dummyChunkExtraction(chunk);
    }

    try {
        return await this.extractWithGroq(chunk);
    } catch (error) {
        console.error('[LLM] Groq extraction failed:', error);
        throw error;
    }
  }

  /**
   * Merge chunk extractions (Pass 2) - Returns raw LLM format
   */
  async mergeExtractions(chunkExtractions) {
    console.log(`[LLM] Merging ${chunkExtractions.length} extractions`);

    if (chunkExtractions.length === 1) {
        // Return raw LLM output directly
        return chunkExtractions[0];
    }

    // Simple Merge for multiple chunks (concat tasks)
    let mergedTasks = [];
    let summary = "";

    for (const extraction of chunkExtractions) {
        if (extraction.tasks) mergedTasks.push(...extraction.tasks);
        if (!summary && extraction.summary) summary = extraction.summary;
    }

    // Return raw merged format
    return { summary, tasks: mergedTasks };
  }

  /**
   * Execute Groq extraction
   */
    async extractWithGroq(chunk) {
        // Format transcript segments as per prompt expectation
        // Chunking service provides 'blocks', not 'segments'
        const formattedTranscript = this.formatTranscriptForLLM(chunk.blocks || []);

        // Prepare metadata
        const metadata = {
            MEETING_DATE: new Date().toLocaleDateString(),
            TIMEZONE: Intl.DateTimeFormat().resolvedOptions().timeZone
        };

        // Inject metadata into system prompt
        const activeSystemPrompt = SYSTEM_PROMPT
            .replace('{{MEETING_DATE}}', metadata.MEETING_DATE)
            .replace('{{TIMEZONE}}', metadata.TIMEZONE);

        const messages = [
            new SystemMessage(activeSystemPrompt),
            new HumanMessage(
                `Give me the summary and the task assigned (Person name who is assigned the task, task description and dedline for the task) for the below given transcript of a online meeting.\n\n${formattedTranscript}`
            )
        ];

        console.log('[LLM] Sending request to Groq...');
        const response = await this.model.invoke(messages);

        try {
            // Parse JSON response
            const content = response.content.trim();
            const jsonStart = content.indexOf('{');
            const jsonEnd = content.lastIndexOf('}');

            if (jsonStart !== -1 && jsonEnd !== -1) {
                const jsonStr = content.substring(jsonStart, jsonEnd + 1);
                return JSON.parse(jsonStr);
            }

            throw new Error("No JSON found in response");
        } catch (e) {
            console.error("[LLM] Failed to parse output:", response.content);
            throw new Error("Failed to parse LLM response as JSON");
        }
    }

    /**
     * Format transcript segments for LLM
     */
    formatTranscriptForLLM(segments) {
        if (!segments || segments.length === 0) return "";

        return segments.map(seg => {
            const time = this.formatTime(seg.start);
            return `[${time}] ${seg.speaker}: ${seg.text}`;
        }).join('\n\n');
    }

    /**
     * Normalize LLM output to Schema format
     */
    normalizeLLMOutput(llmResult) {
        const tasks = llmResult.tasks || [];

        const actionItems = tasks.map((task, idx) => ({
            id: idx + 1,
            title: task.title,
            description: task.description,
            owner: task.assignee?.name !== 'unknown' ? task.assignee?.name : 'Unassigned',
            assigner: task.assigner?.name || 'Unknown',
            priority: task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : 'Medium',
            urgencyReasoning: task.urgency_reasoning || null,
            dueDate: task.due_date,
            suggestedAction: task.suggested_schedule_action || 'manual',
            status: task.status || 'proposed',
            confidence: Math.round((task.confidence || 0.8) * 100),
            evidence: task.evidence || [],
            notes: task.notes || null,
            confirmed: false
        }));

        return {
            executive: llmResult.summary,
            topics: [],
            decisions: [],
            actionItems,
            chunkCount: 1,
            extractionModel: 'llama-3.3-70b-versatile'
        };
    }

  /**
   * DUMMY: Generate mock extraction for a chunk
   */
  dummyChunkExtraction(chunk) {
    const topics = [];
    const decisions = [];
    const actionItems = [];

    const text = chunk.text.toLowerCase();

    if (text.includes('q4')) topics.push('Q4 Planning');
    if (text.includes('mobile')) topics.push('Mobile App Development');
    if (text.includes('onboarding')) topics.push('User Onboarding');

    return {
      chunkIndex: chunk.index,
      summary: `Discussion covering ${topics.join(', ') || 'various topics'}`,
      topics,
      decisions,
      actionItems
    };
  }

  /**
   * DUMMY: Merge all chunk extractions
   */
  dummyMerge(chunkExtractions) {
    const allTopics = new Set();
    const allDecisions = [];
    const allActionItems = [];

    for (const extraction of chunkExtractions) {
      extraction.topics?.forEach(t => allTopics.add(t));
      allDecisions.push(...(extraction.decisions || []));
      allActionItems.push(...(extraction.actionItems || []));
    }

    if (allActionItems.length === 0) {
          allActionItems.push(
            { title: 'Lead onboarding flow redesign', description: 'Create detailed roadmap', owner: 'Sarah Miller', priority: 'High', dueDate: this.getDueDate(7), confidence: 95 },
            { title: 'Start mobile app development', description: 'Begin engineering work', owner: 'Mike Johnson', priority: 'High', dueDate: this.getDueDate(3), confidence: 92 }
          );
    }

    return {
      executive: `The Q4 planning meeting covered ${allTopics.size} main topics: ${[...allTopics].join(', ')}.`,
      topics: [...allTopics],
      decisions: [...new Set(allDecisions)],
      actionItems: this.deduplicateActionItems(allActionItems),
      chunkCount: chunkExtractions.length,
      extractionModel: 'dummy'
    };
  }

  deduplicateActionItems(items) {
    const seen = new Map();
    for (const item of items) {
      const key = item.title.toLowerCase().slice(0, 20);
      if (!seen.has(key)) {
        seen.set(key, { ...item, id: seen.size + 1, dueDate: item.dueDate || this.getDueDate(7 + seen.size * 3) });
      }
    }
    return [...seen.values()];
  }

  getDueDate(daysFromNow) {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().split('T')[0];
  }

  formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

export const llmService = new LLMService();
export default llmService;
