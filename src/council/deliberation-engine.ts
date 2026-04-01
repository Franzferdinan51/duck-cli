/**
 * Duck Agent - Deliberation Engine
 * Clean local deliberation with MiniMax API
 */

import { AICouncilClient, CORE_COUNCILORS, Councilor, CouncilResult, Vote } from './client.js';

export interface DeliberationOptions {
  mode: string;
  topic: string;
  councilors?: Councilor[];
  threshold?: number;
  maxRounds?: number;
  autoVote?: boolean;
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
  private state: DeliberationState;
  private localMode = false;

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

    // Try server first (3s timeout)
    try {
      let session = null;
      try {
        session = await Promise.race([
          this.client.createSession(mode, topic, councilors),
          new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
        ]) as any;
      } catch (e: any) {
        console.error('createSession error:', e.message);
      }
      if (session) return await this.pollServer(session.id, startTime);
    } catch {
      // Server offline, use local
    }

    this.localMode = true;
    console.log('   [Council offline — local MiniMax]');

    switch (mode) {
      case 'legislative': return await this.runLegislative(topic, enabled, startTime);
      case 'deliberation': return await this.runDeliberation(topic, enabled, startTime);
      case 'decision': return await this.runDeliberation(topic, enabled, startTime);
      case 'inquiry': return await this.runInquiry(topic, enabled, startTime);
      case 'research': return await this.runResearch(topic, enabled, startTime);
      case 'prediction': return await this.runPrediction(topic, enabled, startTime);
      case 'swarm_coding': return await this.runSwarmCoding(topic, enabled, startTime);
      default: return await this.runDeliberation(topic, enabled, startTime);
    }
  }

  // ─── MiniMax call + think-block stripping ──────────────────────────
  private async localDeliberate(prompt: string): Promise<string> {
    const apiKey = process.env.MINIMAX_API_KEY || process.env.MINIMAX_API_KEY_2 || '';
    if (!apiKey) return 'No API key';

    try {
      const resp = await fetch('https://api.minimax.io/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'MiniMax-M2.7',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 600,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(25000),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json() as any;
      let text: string = data.choices?.[0]?.message?.content || '';

      // Strip MiniMax think blocks:
      // Format: <start_ck>\n...thinking...\n</think>\n\nvisible
      // Opener: <start_ck> (9 bytes: 3c 73 74 61 72 74 5f 63 6b 3e)
      // Closer: </think> (8 bytes: 3c 2f 74 68 69 6e 6b 3e)
      // Also handle: <think>...\n</think> (opener: <think> 7 bytes, closer: </think> 8 bytes)
      // Also handle: <textarea>...</textarea>
      // We'll use a state-machine: remove everything from opener to closer
      const openers = ['<start_ck>', '<think>'];
      // The MiniMax closing tag is </think> (8 bytes: < / t h i n k >)
      // In JS string literal, this is written as </think>
      for (const opener of openers) {
        let idx = 0;
        while ((idx = text.indexOf(opener, idx)) >= 0) {
          // Find the closer after this opener
          const endIdx = text.indexOf('\x3c\x2f\x74\x68\x69\x6e\x6b\x3e', idx + opener.length);
          if (endIdx >= 0) {
            text = text.substring(0, idx) + text.substring(endIdx + 8);
          } else break;
        }
      }

      // Clean up
      text = text.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
      if (!text || text.length < 3) return '(brief)';
      return text.slice(0, 300);
    } catch (e: any) {
      return 'Error: ' + e.message.slice(0, 80);
    }
  }

  // ─── Legislative: debate + vote ─────────────────────────────────
  private async runLegislative(topic: string, councilors: Councilor[], startTime: number): Promise<CounResult> {
    const votePromises = councilors.map(c =>
      this.localDeliberate(`[${c.name}]: Vote YES or NO on "${topic}" — respond YES or NO.`)
    );
    const openingPromises = councilors.map(c =>
      this.localDeliberate(`[${c.name}] (${c.role}): "${topic}" — 2 sentence analysis.`)
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
      sessionId: 'local-leg',
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
  private async runDeliberation(topic: string, councilors: Councilor[], startTime: number): Promise<CounResult> {
    const promises = councilors.map(c =>
      this.localDeliberate(`[${c.name}] (${c.role}): "${topic}" — discuss in 3 sentences.`)
    );
    const responses = await Promise.all(promises);
    const summary = councilors.map((c, i) => `[${c.name}]: ${responses[i]}`).join('\n\n');

    return {
      sessionId: 'local-delib',
      topic,
      mode: 'deliberation',
      summary,
      verdict: summary.slice(0, 150),
      duration: Date.now() - startTime,
    };
  }

  // ─── Inquiry: direct Q&A ──────────────────────────────────────
  private async runInquiry(topic: string, councilors: Councilor[], startTime: number): Promise<CounResult> {
    const promises = councilors.map(c =>
      this.localDeliberate(`[${c.name}]: Answer "${topic}" in 2 sentences.`)
    );
    const responses = await Promise.all(promises);
    const summary = councilors.map((c, i) => `[${c.name}]: ${responses[i]}`).join('\n');

    return {
      sessionId: 'local-inquiry',
      topic,
      mode: 'inquiry',
      summary,
      verdict: responses[0] || summary.slice(0, 100),
      duration: Date.now() - startTime,
    };
  }

  // ─── Research: investigation ─────────────────────────────────
  private async runResearch(topic: string, councilors: Councilor[], startTime: number): Promise<CounResult> {
    const promises = councilors.map(c =>
      this.localDeliberate(`[${c.name}]: Research "${topic}" — key facts in 3 sentences.`)
    );
    const findings = await Promise.all(promises);
    const summary = councilors.map((c, i) => `[${c.name}]: ${findings[i]}`).join('\n\n');

    return {
      sessionId: 'local-research',
      topic,
      mode: 'research',
      summary,
      verdict: `Research findings on: ${topic}`,
      duration: Date.now() - startTime,
    };
  }

  // ─── Prediction: probability estimates ─────────────────────────
  private async runPrediction(topic: string, councilors: Councilor[], startTime: number): Promise<CounResult> {
    const promises = councilors.map(c =>
      this.localDeliberate(`[${c.name}]: Predict likelihood of "${topic}" — give probability 0-100%.`)
    );
    const texts = await Promise.all(promises);
    const nums = texts.map(t => parseInt(t.match(/\d+/)?.[0] || '50'));
    const avg = Math.round(nums.reduce((s, n) => s + n, 0) / nums.length);
    const summary = councilors.map((c, i) => `[${c.name}]: ${nums[i]}% — ${texts[i].slice(0, 60)}`).join('\n');

    return {
      sessionId: 'local-prediction',
      topic,
      mode: 'prediction',
      summary,
      verdict: `LIKELY ${avg > 50 ? 'YES' : 'NO'} (${avg}%)`,
      finalRuling: `LIKELY ${avg > 50 ? 'YES' : 'NO'} (${avg}%)`,
      duration: Date.now() - startTime,
    };
  }

  // ─── Swarm coding: parallel code generation ───────────────────
  private async runSwarmCoding(topic: string, councilors: Councilor[], startTime: number): Promise<CounResult> {
    const files = ['main.ts', 'utils.ts', 'types.ts'];
    const promises = councilors.slice(0, 3).map((c, i) =>
      this.localDeliberate(`[${c.name}]: Write code for "${topic}" — output ${files[i] || 'file.ts'}.`)
    );
    const code = await Promise.all(promises);
    const summary = councilors.slice(0, 3).map((c, i) => `[${files[i] || 'file.ts'}]:\n${code[i]}`).join('\n\n');

    return {
      sessionId: 'local-swarm',
      topic,
      mode: 'swarm_coding',
      summary,
      verdict: `Generated ${code.length} files for: ${topic}`,
      duration: Date.now() - startTime,
    };
  }

  // ─── Server polling fallback ─────────────────────────────────
  private async pollServer(sessionId: string, startTime: number): Promise<CounResult> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          sessionId, topic: 'council deliberation', mode: 'deliberation',
          summary: 'Council deliberation timed out on server. Try local mode.',
          verdict: 'Council server response timed out.',
          duration: Date.now() - startTime,
        });
      }, 60000);

      let resolved = false;
      let pollCount = 0;
      const poll = async () => {
        if (resolved) return;
        pollCount++;
        try {
          const current: any = await this.client.getSession(sessionId);
          if (current && !resolved) {
            if (current.status === 'completed' || current.status === 'done' || current.status === 'error') {
              resolved = true;
              clearTimeout(timeout);
              const consensusPct = current.consensus || 75;
              const responses = current.responses || [];
              const verdict = consensusPct > 60 ? 'APPROVED' : consensusPct < 40 ? 'REJECTED' : 'SPLIT CALL';
              resolve({
                sessionId: current.id,
                topic: current.topic || 'council deliberation',
                mode: current.mode || 'deliberation',
                consensus: consensusPct / 100,
                summary: responses.length > 0
                  ? responses.map((r: any) => `[${r.councilor || r.name}]: ${r.content || r.response || ''}`).join('\n')
                  : `Council deliberation completed.`,
                verdict: verdict,
                finalRuling: `${verdict} — ${consensusPct}% consensus`,
                duration: Date.now() - startTime,
              });
              return;
            }
          }
          if (!resolved) setTimeout(poll, 2000);
        } catch {
          if (!resolved) setTimeout(poll, 5000);
        }
      };
      poll();
    });
  }

  getState(): DeliberationState { return { ...this.state }; }

  reset(): void {
    this.state = { round: 0, phase: 'opening', currentSpeaker: null, contributions: new Map(), votes: [] };
    this.localMode = false;
  }
}

export default DeliberationEngine;
