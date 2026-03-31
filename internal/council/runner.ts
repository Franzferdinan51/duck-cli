/**
 * Duck CLI - AI Council
 * 
 * Multi-agent deliberation:
 * - Speaker (facilitator)
 * - Technocrat (technical)
 * - Ethicist (ethics)
 * - Pragmatist (practical)
 * - Skeptic (devil's advocate)
 */

import { ProviderManager } from '../providers/manager.js';

type CouncilRole = 'speaker' | 'technocrat' | 'ethicist' | 'pragmatist' | 'skeptic';
type Vote = 'agree' | 'disagree' | 'abstain';

interface CouncilMember {
  role: CouncilRole;
  name: string;
  specialty: string;
  perspective: string;
}

interface DeliberationResponse {
  consensus: string;
  votes: Record<CouncilRole, Vote>;
  summary: string;
  concerns: string[];
}

const COUNCIL_MEMBERS: CouncilMember[] = [
  {
    role: 'speaker',
    name: 'Solomon',
    specialty: 'Facilitation',
    perspective: 'Neutral facilitator focused on understanding core questions and synthesizing diverse viewpoints.'
  },
  {
    role: 'technocrat',
    name: 'Ada',
    specialty: 'Technical Excellence',
    perspective: 'Prioritizes clean architecture, scalability, maintainability, and best practices.'
  },
  {
    role: 'ethicist',
    name: 'Confucius',
    specialty: 'Ethics & Impact',
    perspective: 'Considers human well-being, privacy, fairness, and long-term societal impact.'
  },
  {
    role: 'pragmatist',
    name: 'Franklin',
    specialty: 'Practicality',
    perspective: 'Focuses on cost, timeline, risk, and what can actually ship.'
  },
  {
    role: 'skeptic',
    name: 'Diogenes',
    specialty: 'Critical Analysis',
    perspective: 'Finds flaws, challenges assumptions, and plays devil\'s advocate.'
  }
];

export class CouncilRunner {
  private members = COUNCIL_MEMBERS;
  private providers = new ProviderManager();

  constructor() {
    this.providers.load();
  }

  async deliberate(question: string, mode: string = 'decision'): Promise<DeliberationResponse> {
    const provider = this.providers.getDefault();
    
    // Get perspective from each council member
    const perspectives = await Promise.all(
      this.members.map(member => this.getPerspective(provider, member, question, mode))
    );

    // Tally votes
    const votes = this.tallyVotes(perspectives);
    
    // Find consensus
    const consensus = this.findConsensus(perspectives, votes);
    
    // Summarize
    const summary = this.summarize(perspectives);
    
    // Extract concerns
    const concerns = this.extractConcerns(perspectives);

    return {
      consensus,
      votes,
      summary,
      concerns
    };
  }

  private async getPerspective(
    provider: any,
    member: CouncilMember,
    question: string,
    mode: string
  ): Promise<{ member: CouncilMember; view: string; vote: Vote }> {
    const prompt = `You are ${member.name}, council member specializing in ${member.specialty}.
    
Perspective: ${member.perspective}

Question: ${question}
Mode: ${mode}

Provide your analysis in 2-3 sentences, then vote AGREE, DISAGREE, or ABSTAIN.
End with: VOTE: [AGREE|DISAGREE|ABSTAIN]`;

    try {
      const response = await provider.complete({
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 500
      });

      const text = response.text || '';
      const voteMatch = text.match(/VOTE:\s*(AGREE|DISAGREE|ABSTAIN)/i);
      const vote = voteMatch 
        ? voteMatch[1].toLowerCase() as Vote 
        : 'abstain';

      return {
        member,
        view: text.replace(/VOTE:\s*(AGREE|DISAGREE|ABSTAIN)/i, '').trim(),
        vote
      };
    } catch (error) {
      return {
        member,
        view: `Error getting perspective: ${error}`,
        vote: 'abstain'
      };
    }
  }

  private tallyVotes(perspectives: { member: CouncilMember; view: string; vote: Vote }[]): Record<CouncilRole, Vote> {
    const votes: Record<CouncilRole, Vote> = {
      speaker: 'abstain',
      technocrat: 'abstain',
      ethicist: 'abstain',
      pragmatist: 'abstain',
      skeptic: 'abstain'
    };

    for (const p of perspectives) {
      votes[p.member.role] = p.vote;
    }

    return votes;
  }

  private findConsensus(
    perspectives: { member: CouncilMember; view: string; vote: Vote }[],
    votes: Record<CouncilRole, Vote>
  ): string {
    const agrees = Object.values(votes).filter(v => v === 'agree').length;
    const disagrees = Object.values(votes).filter(v => v === 'disagree').length;

    if (agrees >= 4) {
      return `The council strongly agrees (${agrees}/5). ${perspectives[0]?.view || ''}`;
    } else if (agrees >= 3) {
      return `The council agrees (${agrees}/5) with some concerns.`;
    } else if (disagrees >= 3) {
      return `The council disagrees (${disagrees}/5). Major concerns raised.`;
    } else {
      return `No clear consensus. The council is divided (${agrees} agree, ${disagrees} disagree).`;
    }
  }

  private summarize(perspectives: { member: CouncilMember; view: string; vote: Vote }[]): string {
    return perspectives
      .map(p => `**${p.member.name}** (${p.member.specialty}): ${p.view}`)
      .join('\n\n');
  }

  private extractConcerns(perspectives: { member: CouncilMember; view: string; vote: Vote }[]): string[] {
    return perspectives
      .filter(p => p.vote === 'disagree' || p.member.role === 'skeptic')
      .map(p => `${p.member.name}: ${p.view}`)
      .filter(v => v.length > 20);
  }

  getMembers(): CouncilMember[] {
    return this.members;
  }
}
