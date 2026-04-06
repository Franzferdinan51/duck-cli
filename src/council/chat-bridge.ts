// @ts-nocheck
/**
 * duck-cli v3 - AI Council Chat Bridge
 * Asks AI Council for deliberation BEFORE task execution.
 * Sits between Chat Agent and Orchestrator.
 * 
 * Flow: Chat Agent → Council Bridge → [REJECT/APPROVE/MODIFY] → Orchestrator
 */

import { ChatSession, getOrCreateSession } from '../agent/chat-session.js';

// ---------------------------------------------------------------------------
// Council deliberation trigger conditions
// ---------------------------------------------------------------------------
const ETHICAL_KEYWORDS = [
  'should i', 'should we', 'is it okay', 'is it right',
  'ethical', 'morally', 'privacy', 'surveillance',
  'hack', 'exploit', 'bypass', 'illegal', 'fraud',
  'discriminate', 'bias', 'fairness', 'transparency',
];

const HIGH_STAKES_KEYWORDS = [
  'money', 'dollar', 'cost', 'expensive', 'cheap',
  'security', 'password', 'credential', 'api key', 'secret',
  'delete everything', 'rm -rf', 'drop table', 'truncate',
  'bank', 'financial', 'investment', 'crypto', 'wallet',
  'medical', 'health', 'legal', 'lawyer', 'attorney',
  'government', 'police', 'military', 'weapon',
];

const COMPLEXITY_THRESHOLD = 7;

function needsCouncilDeliberation(message: string, complexity: number): { needed: boolean; reasons: string[] } {
  const lower = message.toLowerCase();
  const reasons: string[] = [];

  // Ethical dimension
  for (const kw of ETHICAL_KEYWORDS) {
    if (lower.includes(kw)) {
      reasons.push(`ethical_dimension`);
      break;
    }
  }

  // High stakes
  for (const kw of HIGH_STAKES_KEYWORDS) {
    if (lower.includes(kw)) {
      reasons.push(`high_stakes`);
      break;
    }
  }

  // Complexity
  if (complexity >= COMPLEXITY_THRESHOLD) {
    reasons.push(`complexity_${complexity}`);
  }

  // Explicit request for council
  if (lower.includes('council') || lower.includes('debate') || lower.includes('discuss')) {
    reasons.push('explicit_request');
  }

  return { needed: reasons.length > 0, reasons };
}

// ---------------------------------------------------------------------------
// MiniMax API (for council deliberation)
// ---------------------------------------------------------------------------
async function councilComplete(model: string, messages: any[], apiKey: string): Promise<string> {
  const resp = await fetch('https://api.minimax.io/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages, stream: false }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`MiniMax API error ${resp.status}: ${text}`);
  }

  const data = await resp.json();
  return data.choices[0].message.content;
}

// ---------------------------------------------------------------------------
// AI Council deliberation
// ---------------------------------------------------------------------------
interface CouncilVerdict {
  verdict: 'APPROVE' | 'REJECT' | 'MODIFY' | 'DELEGATE';
  reasoning: string;
  modifications?: string[];
  confidence: number;
  councilors_heard?: string[];
}

const COUNCIL_SYSTEM_PROMPT = `You are the AI Council - a deliberative body of specialized advisors.
When a user proposes a task, you evaluate it from multiple perspectives:

**Councilors:**
- 🎯 Speaker (meta-coordination)
- 🔬 Technocrat (technical feasibility, security, data integrity)
- ⚖️ Ethicist (ethical implications, privacy, fairness)
- 🛡️ Sentinel (risk assessment, failure modes, edge cases)
- 💡 Pragmatist (practical implementation, resources, timeline)

**Your job:**
Given the user's task, respond with a JSON verdict:
{
  "verdict": "APPROVE|REJECT|MODIFY|DELEGATE",
  "reasoning": "Why you reached this decision (2-3 sentences)",
  "modifications": ["optional suggested changes if MODIFY"],
  "confidence": 0.0-1.0,
  "councilors_heard": ["speaker", "technocrat", ...]
}

**Verdict meanings:**
- APPROVE: Safe, beneficial, well-reasoned - proceed as planned
- REJECT: Harmful, unethical, dangerous, or fundamentally flawed - do not proceed
- MODIFY: Proceed but with suggested changes to approach or scope
- DELEGATE: This needs human input or external review before proceeding

**Rules:**
- Be honest, not a yes-man
- Flag risks clearly
- Consider the user's goals, not just safety
- Default to APPROVE for reasonable requests
- NEVER approve: illegal activities, harm to people, surveillance without consent, data deletion without backup`;

async function askCouncil(task: string, context: string, apiKey: string): Promise<CouncilVerdict> {
  const userPrompt = `**Task under deliberation:**
"${task}"

**Context:**
${context}

**Your verdict (JSON only):**`;

  try {
    const response = await councilComplete('MiniMax-M2.7', [
      { role: 'system', content: COUNCIL_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ], apiKey);

    // Try to parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const verdict = JSON.parse(jsonMatch[0]);
      return {
        verdict: verdict.verdict || 'DELEGATE',
        reasoning: verdict.reasoning || 'No reasoning provided',
        modifications: verdict.modifications || [],
        confidence: verdict.confidence || 0.5,
        councilors_heard: verdict.councilors_heard || ['speaker'],
      };
    }

    // Fallback: treat as text
    return {
      verdict: response.toLowerCase().includes('reject') ? 'REJECT' :
               response.toLowerCase().includes('modify') ? 'MODIFY' : 'APPROVE',
      reasoning: response,
      confidence: 0.5,
      councilors_heard: ['speaker'],
    };
  } catch (err) {
    console.error('[CouncilBridge] Deliberation failed:', err);
    return {
      verdict: 'APPROVE', // Fail open - proceed if council fails
      reasoning: `Council deliberation failed: ${err.message}. Proceeding by default.`,
      confidence: 0.0,
      councilors_heard: [],
    };
  }
}

// ---------------------------------------------------------------------------
// Full deliberation flow with Chat Agent integration
// ---------------------------------------------------------------------------
interface ProcessResult {
  response: string;
  routed: 'direct' | 'council_rejected' | 'council_modified' | 'orchestrator';
  council?: CouncilVerdict;
  orchestratorResult?: string;
}

export async function processWithCouncil(
  userId: string,
  message: string,
  complexity: number,
  minimaxApiKey: string
): Promise<ProcessResult> {
  const session = getOrCreateSession(userId);
  const { needed, reasons } = needsCouncilDeliberation(message, complexity);

  if (!needed) {
    // No council needed - return null to let caller handle normally
    return { response: '', routed: 'direct', council: undefined };
  }

  console.log(`[CouncilBridge] Deliberation triggered for task: "${message.substring(0, 50)}..."`);
  console.log(`[CouncilBridge] Reasons: ${reasons.join(', ')}`);

  // Add deliberation context
  const contextHistory = session.getContext(8000);
  const contextStr = contextHistory
    .map((m: any) => `${m.role}: ${m.content}`)
    .join('\n');

  // Ask council
  const verdict = await askCouncil(message, contextStr, minimaxApiKey);

  console.log(`[CouncilBridge] Verdict: ${verdict.verdict} (confidence: ${verdict.confidence})`);
  console.log(`[CouncilBridge] Reasoning: ${verdict.reasoning.substring(0, 100)}`);

  // Handle verdict
  if (verdict.verdict === 'REJECT') {
    const rejectionMsg = `🛡️ **AI Council Decision: REJECTED**

The council has declined this request.

**Reasoning:** ${verdict.reasoning}

**Councilors heard:** ${(verdict.councilors_heard || []).join(', ') || 'none'}

If you believe this is an error or want to rephrase the request, I'm happy to help.`;

    session.addAssistant(rejectionMsg);
    return {
      response: rejectionMsg,
      routed: 'council_rejected',
      council: verdict,
    };
  }

  if (verdict.verdict === 'MODIFY') {
    const modifyPrompt = verdict.modifications?.length
      ? `The council suggests these modifications:\n${verdict.modifications.map((m: string) => `- ${m}`).join('\n')}\n\n`
      : '';

    const modifiedMsg = `⚖️ **AI Council Decision: MODIFY**

The council suggests changes before proceeding.

**Reasoning:** ${verdict.reasoning}

${modifyMsg}**Would you like me to proceed with these modifications?**

If yes, I'll update the approach and continue. If no, I can discuss alternatives.`;

    session.addAssistant(modifiedMsg);
    return {
      response: modifiedMsg,
      routed: 'council_modified',
      council: verdict,
    };
  }

  // APPROVE or DELEGATE - proceed to orchestrator
  return {
    response: '',
    routed: 'orchestrator',
    council: verdict,
  };
}

export { needsCouncilDeliberation, askCouncil, CouncilVerdict };
