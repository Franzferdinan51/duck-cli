/**
 * Duck Agent Sub-Conscious - LLM Analyzer
 * Analyzes session transcripts to extract memories, patterns, and insights
 * Uses MiniMax or any OpenAI-compatible provider — NO Letta
 */

import { StoredMemory } from './sqlite-store.js';

export interface AnalysisResult {
  summary: string;
  patterns: string[];
  keyDecisions: string[];
  topics: string[];
  importance: number;
  tags: string[];
  insights: string[];
}

export interface TranscriptSegment {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

const ANALYSIS_PROMPT = `You are Duck Agent's Sub-Conscious analyzer. Analyze this session transcript and extract insights for future context.

Extract and return JSON with these fields:
{
  "summary": "2-3 sentence summary of what happened in this session",
  "patterns": ["array of recurring patterns or behaviors observed"],
  "keyDecisions": ["array of important decisions made"],
  "topics": ["array of main topics discussed"],
  "importance": 0.0-1.0, how important this session is for future context,
  "tags": ["relevant tags for this session"],
  "insights": ["actionable insights or recommendations for future sessions"]
}

Be concise and specific. Focus on things worth remembering:
- User preferences and working styles
- Technical decisions and their rationale
- Problems solved (so we don't redo work)
- Patterns to watch for
- Warnings or cautions for future work

Return ONLY valid JSON, no markdown formatting.`;

/**
 * Analyze a transcript segment and extract structured memories
 */
export async function analyzeTranscript(
  transcript: TranscriptSegment[],
  sessionId: string,
  provider: 'minimax' | 'openai' | 'lmstudio' = 'minimax'
): Promise<AnalysisResult | null> {
  if (transcript.length === 0) return null;

  // Build transcript text
  const transcriptText = transcript
    .map(t => `[${t.role}] ${t.content}`)
    .join('\n\n')
    .slice(-8000); // Last 8k chars

  try {
    let result: AnalysisResult;

    if (provider === 'minimax') {
      result = await analyzeWithMinimax(transcriptText);
    } else if (provider === 'openai') {
      result = await analyzeWithOpenAI(transcriptText);
    } else {
      result = await analyzeWithLMStudio(transcriptText);
    }

    return result;
  } catch (error) {
    console.error('[Sub-Conscious LLM] Analysis failed:', error);
    return fallbackAnalysis(transcript);
  }
}

/**
 * Analyze council deliberation and extract insights
 */
export async function analyzeCouncilDeliberation(
  topic: string,
  deliberation: string,
  councilorId: string,
  provider: 'minimax' | 'openai' | 'lmstudio' = 'minimax'
): Promise<{ insight: string; tags: string[] }> {
  const prompt = `You are Duck Agent's Sub-Conscious. Analyze this AI Council deliberation and extract a key insight.

Topic: ${topic}
Councilor: ${councilorId}
Deliberation: ${deliberation.slice(0, 4000)}

Return JSON:
{
  "insight": "1-2 sentence key insight from this deliberation",
  "tags": ["relevant tags"]
}

Return ONLY valid JSON.`;

  try {
    if (provider === 'minimax') {
      return await callMinimax(prompt) as { insight: string; tags: string[] };
    } else if (provider === 'openai') {
      return await callOpenAI(prompt) as { insight: string; tags: string[] };
    } else {
      return await callLMStudio(prompt) as { insight: string; tags: string[] };
    }
  } catch {
    return { insight: deliberation.slice(0, 100), tags: [topic] };
  }
}

/**
 * Generate a whisper based on session context and memories
 */
export async function generateWhisper(
  context: {
    message?: string;
    memories?: StoredMemory[];
    recentTopics?: string[];
    sessionHistory?: string[];
  },
  provider: 'minimax' | 'openai' | 'lmstudio' = 'minimax'
): Promise<string | null> {
  const memoriesText = context.memories
    ?.slice(0, 5)
    .map(m => `[${m.source}] ${m.content}`)
    .join('\n') || 'No relevant memories.';

  const prompt = `You are Duck Agent's Sub-Conscious. Based on the user's current message and relevant memories, generate a brief whisper (1-2 sentences max).

User message: ${context.message || '(no message)'}

Relevant memories:
${memoriesText}

Recent topics: ${context.recentTopics?.join(', ') || 'none'}

Return ONLY the whisper text, no formatting. Be specific and actionable. If nothing relevant, return empty string.`;

  try {
    let whisper: string;
    if (provider === 'minimax') {
      whisper = await callMinimax(prompt) as string;
    } else if (provider === 'openai') {
      whisper = await callOpenAI(prompt) as string;
    } else {
      whisper = await callLMStudio(prompt) as string;
    }
    
    return whisper.trim() || null;
  } catch {
    return null;
  }
}

// ============ Provider Implementations ============

async function analyzeWithMinimax(text: string): Promise<AnalysisResult> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error('MINIMAX_API_KEY not set');

  const response = await fetch('https://api.minimax.io/v1/text/chatcompletion_v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'MiniMax-M2.7',
      messages: [
        { role: 'system', content: ANALYSIS_PROMPT },
        { role: 'user', content: text }
      ],
      temperature: 0.3,
      max_tokens: 1024
    })
  });

  if (!response.ok) throw new Error(`Minimax API error: ${response.status}`);
  const data = await response.json() as any;
  const content = data.choices?.[0]?.message?.content || '{}';
  return parseJSON(content);
}

async function callMinimax(prompt: string): Promise<any> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error('MINIMAX_API_KEY not set');

  const response = await fetch('https://api.minimax.io/v1/text/chatcompletion_v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'MiniMax-M2.7',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 512
    })
  });

  if (!response.ok) throw new Error(`Minimax API error: ${response.status}`);
  const data = await response.json() as any;
  const content = data.choices?.[0]?.message?.content || '';
  try {
    return JSON.parse(content);
  } catch {
    return content.trim();
  }
}

async function analyzeWithOpenAI(text: string): Promise<AnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: ANALYSIS_PROMPT },
        { role: 'user', content: text }
      ],
      temperature: 0.3,
      max_tokens: 1024
    })
  });

  if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
  const data = await response.json() as any;
  const content = data.choices?.[0]?.message?.content || '{}';
  return parseJSON(content);
}

async function callOpenAI(prompt: string): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 512
    })
  });

  if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
  const data = await response.json() as any;
  const content = data.choices?.[0]?.message?.content || '';
  try {
    return JSON.parse(content);
  } catch {
    return content.trim();
  }
}

async function analyzeWithLMStudio(text: string): Promise<AnalysisResult> {
  const baseUrl = process.env.LMSTUDIO_URL || 'http://localhost:1234';
  
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen3.5-27b',
      messages: [
        { role: 'system', content: ANALYSIS_PROMPT },
        { role: 'user', content: text }
      ],
      temperature: 0.3,
      max_tokens: 1024
    })
  });

  if (!response.ok) throw new Error(`LM Studio API error: ${response.status}`);
  const data = await response.json() as any;
  const content = data.choices?.[0]?.message?.content || '{}';
  return parseJSON(content);
}

async function callLMStudio(prompt: string): Promise<any> {
  const baseUrl = process.env.LMSTUDIO_URL || 'http://localhost:1234';
  
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen3.5-27b',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 512
    })
  });

  if (!response.ok) throw new Error(`LM Studio API error: ${response.status}`);
  const data = await response.json() as any;
  const content = data.choices?.[0]?.message?.content || '';
  try {
    return JSON.parse(content);
  } catch {
    return content.trim();
  }
}

function parseJSON(content: string): AnalysisResult {
  // Strip markdown code blocks if present
  const cleaned = content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return {
      summary: cleaned.slice(0, 200),
      patterns: [],
      keyDecisions: [],
      topics: [],
      importance: 0.5,
      tags: [],
      insights: []
    };
  }
}

function fallbackAnalysis(transcript: TranscriptSegment[]): AnalysisResult {
  // Simple rule-based fallback when LLM isn't available
  const text = transcript.map(t => t.content).join(' ');
  const words = text.toLowerCase().split(/\s+/);
  
  // Extract potential topics (most frequent words)
  const freq: Record<string, number> = {};
  for (const w of words) {
    if (w.length > 4) freq[w] = (freq[w] || 0) + 1;
  }
  const topics = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w]) => w);

  return {
    summary: text.slice(0, 200),
    patterns: [],
    keyDecisions: [],
    topics,
    importance: 0.5,
    tags: topics.slice(0, 3),
    insights: []
  };
}
