/**
 * Duck Agent - Deliberation Engine
 * Clean local deliberation with MiniMax API + Sub-Conscious integration
 * 
 * Sub-Conscious integration:
 * - Before deliberation: Query relevant memories from daemon
 * - During deliberation: Inject relevant context into prompts
 * - After deliberation: Store insights back to daemon
 */

import { AICouncilClient, CORE_COUNCILORS, Councilor, CouncilResult, Vote } from './client.js';
import { SubconsciousClient } from '../subconscious/client.js';

export interface DeliberationOptions {
  mode: string;
  topic: string;
  councilors?: Councilor[];
  threshold?: number;
  maxRounds?: number;
  autoVote?: boolean;
  useSubconscious?: boolean;
}

export interface DeliberationState {
  round: number;
  phase: 'opening' | 'debate' | 'rebuttal' | 'vote' | 'summary';
  currentSpeaker: string | null;
  contributions: Map<string, string>;
  votes: Vote[];
}

type CounResult = CouncilResult;

export class DeliberationEngine {
  private client: AICouncilClient;
  private subconscious: SubconsciousClient | null = null;
  private state: DeliberationState;
  private localMode = false;
  private subconsciousMemories: any[] = [];
  private sessionId: string = '';

  constructor(client?: AICouncilClient) {
    this.client = client || new AICouncilClient();
    this.state = {
      round: 0,
      phase: 'opening',
      currentSpeaker: null,
      contributions: new Map(),
      votes: [],
    };
  }

  async deliberate(options: DeliberationOptions): Promise<CounResult> {
    const startTime = Date.now();
    const { mode, topic, councilors } = options;
    const enabled = (councilors || CORE_COUNCILORS.filter(c => c.enabled)).slice(0, 3);
    this.sessionId = `council_${Date.now()}`;

    // ── Connect to Sub-Conscious daemon ──────────────────────────
    const useSubconscious = options.useSubconscious !== false;
    if (useSubconscious) {
      try {
        this.subconscious = new SubconsciousClient();
        const daemonUp = await this.subconscious.ping().catch(() => false);
        if (daemonUp) {
          const memories = await this.subconscious.getCouncilMemories(topic, 5);
          this.subconsciousMemories = memories.memories;
          console.log(`   🧠 Sub-Conscious: loaded ${this.subconsciousMemories.length} relevant memories`);
        } else {
          console.log(`   ${c.dim}Sub-Conscious daemon not running (skipping)${c.reset}`);
          this.subconscious = null;
        }
      } catch (e) {
        console.log(`   ${c.dim}Sub-Conscious unavailable: ${(e as Error).message}${c.reset}`);
        this.subconscious = null;
      }
    }

    // ── Build subconscious context ────────────────────────────────
    let subconsciousPrompt = '';
    if (this.subconsciousMemories.length > 0) {
      const memText = this.subconsciousMemories
        .map((m: any) => `[${m.councilor_id}]: ${m.insight}`)
        .join('\n');
      subconsciousPrompt = `\n\n${c.dim}Previous relevant deliberations:${c.reset}\n${memText}\n`;
    }

    // ── Run deliberation ──────────────────────────────────────────
    this.localMode = true;
    console.log('   [Running local deliberation with MiniMax]');

    let result: CounResult;
    switch (mode) {
      case 'legislative': result = await this.runLegislative(topic, enabled, startTime, subconsciousPrompt); break;
      case 'deliberation': result = await this.runDeliberation(topic, enabled, startTime, subconsciousPrompt); break;
      case 'decision': result = await this.runDeliberation(topic, enabled, startTime, subconsciousPrompt); break;
      case 'inquiry': result = await this.runInquiry(topic, enabled, startTime, subconsciousPrompt); break;
      case 'research': result = await this.runResearch(topic, enabled, startTime, subconsciousPrompt); break;
      case 'prediction': result = await this.runPrediction(topic, enabled, startTime, subconsciousPrompt); break;
      case 'swarm_coding': result = await this.runSwarmCoding(topic, enabled, startTime, subconsciousPrompt); break;
      default: result = await this.runDeliberation(topic, enabled, startTime, subconsciousPrompt);
    }

    // ── Store deliberation in Sub-Conscious ────────────────────
    if (this.subconscious && result.summary) {
      try {
        for (const c of enabled) {
          const contrib = this.state.contributions.get(c.id) || result.summary || '';
          if (contrib.length > 20) {
            await this.subconscious.storeCouncilMemory(
              this.sessionId,
              topic,
              c.id,
              contrib
            );
          }
        }
        console.log(`   🧠 Sub-Conscious: stored ${enabled.length} councilor memories`);
      } catch (e) {
        console.log(`   ${c.dim}Sub-Conscious store failed: ${(e as Error).message}${c.reset}`);
      }
    }

    return result;
  }

  // ─── Build prompt with Sub-Conscious context ──────────────────
  private buildPrompt(base: string, councilor: Councilor, extraContext = ''): string {
    return base + extraContext;
  }

  // ─── MiniMax call + think-block stripping ──────────────────────────
  private async localDeliberate(prompt: string, councilor?: Councilor): Promise<string> {
    const apiKey = process.env.MINIMAX_API_KEY || process.env.MINIMAX_API_KEY_2 || '';
    if (!apiKey) return 'No API key';

    // ── Inject Sub-Conscious memories if available ─────────────
    let finalPrompt = prompt;
    if (this.subconscious && this.subconsciousMemories.length > 0) {
      const memText = this.subconsciousMemories
        .slice(0, 3)
        .map((m: any) => `• ${m.insight}`)
        .join('\n');
      finalPrompt = `${prompt}\n\n${c.dim}Relevant prior context:\n${memText}${c.reset}`;
    }

    try {
      const resp = await fetch('https://api.minimax.io/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'MiniMax-M2.7',
          messages: [
            { role: 'system', content: 'You are a concise AI councilor. Give brief, direct responses. No preamble.' },
            { role: 'user', content: finalPrompt },
          ],
          temperature: 0.7,
          max_tokens: 400,
        }),
      });

      const data: any = await resp.json();
      let text = data.choices?.[0]?.message?.content || '';

      // Strip think blocks
      text = stripThinkBlocks(text);

      // Track contribution
      if (councilor) {
        const existing = this.state.contributions.get(councilor.id) || '';
        this.state.contributions.set(councilor.id, existing + ' ' + text);
      }

      return text;
    } catch (e: any) {
      return `Error: ${e.message.slice(0, 80)}`;
    }
  }

  // ─── Legislative: debate + vote ─────────────────────────────────
  private async runLegislative(topic: string, councilors: Councilor[], startTime: number, ctx: string): Promise<CounResult> {
    const votePromises = councilors.map(c =>
      this.localDeliberate(`[${c.name}]: Vote YES or NO on "${topic}" — respond YES or NO.`, c)
    );
    const openingPromises = councilors.map(c =>
      this.localDeliberate(`[${c.name}] (${c.role}): "${topic}" — 2 sentence analysis.`, c)
    );
    const [openings, voteTexts] = await Promise.all([Promise.all(openingPromises), Promise.all(votePromises)]);

    const votes: any[] = voteTexts.map((t, i) => ({
      councilorId: councilors[i].id,
      vote: (t.toLowerCase().includes('yes') || t.toLowerCase().includes('yea')) ? 'yea' : 'nay',
      confidence: 7,
      reason: t.slice(0, 80),
    }));

    const summary = councilors.map((c, i) => `[${c.name}]: ${openings[i]}`).join('\n');
    const yesCnt = votes.filter(v => v.vote === 'yea').length;
    const consensus = votes.length > 0 ? yesCnt / votes.length : 0.5;
    const ruling = consensus > 0.6 ? 'APPROVED' : consensus < 0.4 ? 'REJECTED' : 'SPLIT';

    return {
      sessionId: this.sessionId,
      topic,
      mode: 'legislative',
      votes: votes as Vote[],
      consensus,
      summary,
      verdict: ruling,
      finalRuling: ruling,
      duration: Date.now() - startTime,
    };
  }

  // ─── Deliberation: open discussion ────────────────────────────────
  private async runDeliberation(topic: string, councilors: Councilor[], startTime: number, ctx: string): Promise<CounResult> {
    const promises = councilors.map(c =>
      this.localDeliberate(`[${c.name}] (${c.role}): "${topic}" — discuss in 3 sentences.`, c)
    );
    const responses = await Promise.all(promises);
    const summary = councilors.map((c, i) => `[${c.name}]: ${responses[i]}`).join('\n\n');

    return {
      sessionId: this.sessionId,
      topic,
      mode: 'deliberation',
      summary,
      verdict: summary.slice(0, 150),
      duration: Date.now() - startTime,
    };
  }

  // ─── Inquiry: direct Q&A ──────────────────────────────────────
  private async runInquiry(topic: string, councilors: Councilor[], startTime: number, ctx: string): Promise<CounResult> {
    const promises = councilors.map(c =>
      this.localDeliberate(`[${c.name}]: Answer "${topic}" in 2 sentences.`, c)
    );
    const responses = await Promise.all(promises);
    const summary = councilors.map((c, i) => `[${c.name}]: ${responses[i]}`).join('\n');

    return {
      sessionId: this.sessionId,
      topic,
      mode: 'inquiry',
      summary,
      verdict: responses[0] || summary.slice(0, 100),
      duration: Date.now() - startTime,
    };
  }

  // ─── Research: investigation ─────────────────────────────────
  private async runResearch(topic: string, councilors: Councilor[], startTime: number, ctx: string): Promise<CounResult> {
    const promises = councilors.map(c =>
      this.localDeliberate(`[${c.name}]: Research "${topic}" — key facts in 3 sentences.`, c)
    );
    const findings = await Promise.all(promises);
    const summary = councilors.map((c, i) => `[${c.name}]: ${findings[i]}`).join('\n\n');

    return {
      sessionId: this.sessionId,
      topic,
      mode: 'research',
      summary,
      verdict: `Research findings on: ${topic}`,
      duration: Date.now() - startTime,
    };
  }

  // ─── Prediction: probability estimates ─────────────────────────
  private async runPrediction(topic: string, councilors: Councilor[], startTime: number, ctx: string): Promise<CounResult> {
    const promises = councilors.map(c =>
      this.localDeliberate(`[${c.name}]: Predict likelihood of "${topic}" — give probability 0-100%.`, c)
    );
    const texts = await Promise.all(promises);
    const nums = texts.map(t => parseInt(t.match(/\d+/)?.[0] || '50'));
    const avg = Math.round(nums.reduce((s, n) => s + n, 0) / nums.length);
    const summary = councilors.map((c, i) => `[${c.name}]: ${nums[i]}% — ${texts[i].slice(0, 60)}`).join('\n');

    return {
      sessionId: this.sessionId,
      topic,
      mode: 'prediction',
      summary,
      verdict: `LIKELY ${avg > 50 ? 'YES' : 'NO'} (${avg}%)`,
      finalRuling: `LIKELY ${avg > 50 ? 'YES' : 'NO'} (${avg}%)`,
      duration: Date.now() - startTime,
    };
  }

  // ─── Swarm coding: parallel code generation ───────────────────
  private async runSwarmCoding(topic: string, councilors: Councilor[], startTime: number, ctx: string): Promise<CounResult> {
    const files = ['main.ts', 'utils.ts', 'types.ts'];
    const promises = councilors.slice(0, 3).map((c, i) =>
      this.localDeliberate(`[${c.name}]: Write code for "${topic}" — output ${files[i] || 'file.ts'}.`, c)
    );
    const code = await Promise.all(promises);
    const summary = councilors.slice(0, 3).map((c, i) => `[${files[i] || 'file.ts'}]:\n${code[i]}`).join('\n\n');

    return {
      sessionId: this.sessionId,
      topic,
      mode: 'swarm_coding',
      summary,
      verdict: `Generated ${code.length} files for: ${topic}`,
      duration: Date.now() - startTime,
    };
  }

  getState(): DeliberationState { return { ...this.state }; }

  reset(): void {
    this.state = { round: 0, phase: 'opening', currentSpeaker: null, contributions: new Map(), votes: [] };
    this.subconscious = null;
    this.subconsciousMemories = [];
    this.localMode = false;
  }
}

// ─── Utilities ──────────────────────────────────────────────────────────

const c = {
  dim: '\x1b[2m',
  reset: '\x1b[0m',
};

function stripThinkBlocks(text: string): string {
  try {
    const openers = ['<start_ck>', '<think>'];
    for (const opener of openers) {
      let idx = 0;
      while ((idx = text.indexOf(opener, idx)) >= 0) {
        const endIdx = text.indexOf('\x3c\x2f\x74\x68\x69\x6e\x6b\x3e', idx + opener.length);
        if (endIdx >= 0) {
          text = text.substring(0, idx) + text.substring(endIdx + 8);
        } else break;
      }
    }
    text = text.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text || text.length < 3) return '(brief)';
    return text.slice(0, 300);
  } catch (e: any) {
    return 'Error: ' + e.message.slice(0, 80);
  }
}

export default DeliberationEngine;
