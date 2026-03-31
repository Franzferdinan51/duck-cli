/**
 * Duck CLI - AI Council Integration
 * 
 * Integrates with AI-Bot-Council-Concensus for:
 * - Multi-agent deliberation
 * - Voting and consensus
 * - Expert council opinions
 * - Swarm coding
 */

export interface CouncilMessage {
  role: 'user' | 'assistant' | 'councilor';
  councilor?: string;
  content: string;
}

export interface CouncilVote {
  councilor: string;
  vote: 'for' | 'against' | 'abstain';
  reasoning?: string;
}

export interface CouncilResult {
  consensus: 'for' | 'against' | 'split';
  votes: CouncilVote[];
  summary: string;
}

export interface CouncilOptions {
  councilUrl?: string;
  mode?: 'legislative' | 'research' | 'prediction' | 'inquiry';
}

export class AICouncilIntegration {
  private councilUrl: string;
  private mode: string;

  constructor(options: CouncilOptions = {}) {
    this.councilUrl = options.councilUrl || 'http://localhost:3000';
    this.mode = options.mode || 'legislative';
  }

  async ask(question: string): Promise<CouncilResult | string> {
    try {
      const response = await fetch(`${this.councilUrl}/api/council`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, mode: this.mode })
      });

      if (!response.ok) {
        throw new Error(`Council request failed: ${response.status}`);
      }

      const data = await response.json();
      return data as CouncilResult;
    } catch (error: any) {
      // Fallback to direct response if council not available
      if (error.code === 'ECONNREFUSED') {
        return `AI Council not available at ${this.councilUrl}. Start it with: ./start-ai-council.sh`;
      }
      return `Council error: ${error.message}`;
    }
  }

  async vote(topic: string, votes: CouncilVote[]): Promise<CouncilResult> {
    const response = await fetch(`${this.councilUrl}/api/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, votes })
    });

    if (!response.ok) {
      throw new Error(`Vote failed: ${response.status}`);
    }

    return response.json();
  }

  async getCouncilors(): Promise<string[]> {
    const response = await fetch(`${this.councilUrl}/api/councilors`);
    
    if (!response.ok) {
      return ['Speaker', 'Technocrat', 'Ethicist', 'Pragmatist', 'Skeptic', 'Sentinel'];
    }

    const data = await response.json();
    return data.councilors || [];
  }
}

export default AICouncilIntegration;
