/**
 * 🦆 Duck Agent - AI Council Chamber Integration
 * Deep integration with AI Council for multi-agent deliberation
 */

import { EventEmitter } from 'events';

export interface Councilor {
  id: string;
  name: string;
  role: string;
  persona: string;
  color: string;
  enabled: boolean;
  model?: string;
}

export interface DeliberationMode {
  id: string;
  name: string;
  description: string;
}

export interface Session {
  id: string;
  mode: string;
  topic: string;
  councilors: Councilor[];
  status: 'pending' | 'active' | 'completed';
  createdAt: string;
}

export interface Vote {
  councilorId: string;
  vote: 'yea' | 'nay';
  confidence: number;
  reason: string;
}

export interface CouncilResult {
  sessionId: string;
  topic: string;
  mode: string;
  votes?: Vote[];
  consensus?: number;
  summary?: string;
  finalRuling?: string;
  duration: number;
}

// Deliberation modes
export const DELIBERATION_MODES: DeliberationMode[] = [
  { id: 'legislative', name: 'Legislative', description: 'Debate & vote on proposals' },
  { id: 'deliberation', name: 'Deliberation', description: 'Open roundtable discussion' },
  { id: 'research', name: 'Deep Research', description: 'Multi-vector investigation' },
  { id: 'swarm', name: 'Swarm', description: 'Parallel task execution' },
  { id: 'swarm_coding', name: 'Swarm Coding', description: 'Multi-agent code generation' },
  { id: 'prediction', name: 'Prediction Market', description: 'Probabilistic forecasting' },
  { id: 'inquiry', name: 'Inquiry', description: 'Direct Q&A with councilors' },
];

// Core councilors
export const CORE_COUNCILORS: Councilor[] = [
  {
    id: 'speaker',
    name: 'High Speaker',
    role: 'speaker',
    persona: 'You are Speaker of the AI Council. You represent absolute objectivity. Summarize debates and issue binding resolutions.',
    color: 'from-amber-500 to-yellow-700',
    enabled: true,
  },
  {
    id: 'technocrat',
    name: 'The Technocrat',
    role: 'councilor',
    persona: 'You focus on efficiency, data-driven solutions, and raw capability. You are unafraid of dangerous ideas if they yield results.',
    color: 'from-emerald-500 to-teal-700',
    enabled: true,
  },
  {
    id: 'ethicist',
    name: 'The Ethicist',
    role: 'councilor',
    persona: 'You prioritize human well-being, moral frameworks, and social impact above all else.',
    color: 'from-rose-500 to-pink-700',
    enabled: true,
  },
  {
    id: 'pragmatist',
    name: 'The Pragmatist',
    role: 'councilor',
    persona: 'You care about economics, feasibility, and immediate implementation. You ask "Will it work today?"',
    color: 'from-slate-500 to-gray-700',
    enabled: true,
  },
  {
    id: 'skeptic',
    name: 'The Skeptic',
    role: 'councilor',
    persona: 'You are the devil advocate. You look for structural flaws, implementation risks, and worst-case scenarios.',
    color: 'from-stone-500 to-stone-700',
    enabled: true,
  },
  {
    id: 'sentinel',
    name: 'The Sentinel',
    role: 'councilor',
    persona: 'Your priority is security, defense, and cyber-survival. You view world as a hostile place.',
    color: 'from-red-600 to-red-900',
    enabled: true,
  },
  {
    id: 'visionary',
    name: 'The Visionary',
    role: 'councilor',
    persona: 'You look 100 years into the future. You advocate for radical innovation, space expansion, and transhumanism.',
    color: 'from-violet-500 to-purple-700',
    enabled: true,
  },
  {
    id: 'historian',
    name: 'The Historian',
    role: 'councilor',
    persona: 'You view every issue through the lens of the past. You cite historical precedents and long-term cycles.',
    color: 'from-amber-700 to-orange-900',
    enabled: true,
  },
  {
    id: 'diplomat',
    name: 'The Diplomat',
    role: 'councilor',
    persona: 'You value soft power, international relations, and compromise. You seek solutions that save face.',
    color: 'from-sky-400 to-blue-500',
    enabled: true,
  },
  {
    id: 'journalist',
    name: 'The Journalist',
    role: 'councilor',
    persona: 'You represent the public interest and Fourth Estate. You demand transparency and accountability.',
    color: 'from-yellow-500 to-orange-500',
    enabled: true,
  },
  {
    id: 'scientist',
    name: 'The Scientist',
    role: 'councilor',
    persona: 'You approach every issue with empirical evidence, data analysis, and peer-reviewed research.',
    color: 'from-emerald-500 to-teal-600',
    enabled: true,
  },
  {
    id: 'psychologist',
    name: 'The Psychologist',
    role: 'councilor',
    persona: 'You focus on human behavior, mental health, and underlying motivations.',
    color: 'from-teal-400 to-cyan-600',
    enabled: true,
  },
];

export class AICouncilClient extends EventEmitter {
  private baseUrl: string;
  private sessionId: string | null = null;
  private currentMode: string = 'deliberation';
  
  constructor(baseUrl: string = 'http://localhost:3001') {
    super();
    this.baseUrl = baseUrl;
  }
  
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
  
  async createSession(
    mode: string = 'deliberation',
    topic: string = '',
    councilors?: Councilor[]
  ): Promise<Session | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, topic, councilors }),
        signal: AbortSignal.timeout(30000),
      });
      
      if (response.ok) {
        const data = await response.json();
        this.sessionId = data.sessionId;
        this.currentMode = mode;
        this.emit('sessionCreated', data);
        return data;
      }
    } catch (e) {
      console.error('Failed to create session:', e);
    }
    return null;
  }
  
  async submitTopic(topic: string): Promise<boolean> {
    if (!this.sessionId) {
      await this.createSession(this.currentMode, topic);
      return true;
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/api/session/${this.sessionId}/topic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
  
  async getSession(): Promise<Session | null> {
    if (!this.sessionId) return null;
    
    try {
      const response = await fetch(`${this.baseUrl}/api/session/${this.sessionId}`);
      if (response.ok) {
        return await response.json();
      }
    } catch {
      // Ignore
    }
    return null;
  }
  
  async runDeliberation(topic: string, mode?: string): Promise<CouncilResult> {
    const startTime = Date.now();
    const selectedMode = mode || this.currentMode;
    
    // Create session
    const session = await this.createSession(selectedMode, topic);
    if (!session) {
      return {
        sessionId: 'failed',
        topic,
        mode: selectedMode,
        duration: Date.now() - startTime,
      };
    }
    
    this.emit('deliberationStarted', { topic, mode: selectedMode });
    
    // Poll for results
    return new Promise((resolve) => {
      const poll = async () => {
        const current = await this.getSession();
        if (current?.status === 'completed') {
          const result: CouncilResult = {
            sessionId: current.id,
            topic: current.topic,
            mode: current.mode,
            duration: Date.now() - startTime,
          };
          this.emit('deliberationCompleted', result);
          resolve(result);
        } else {
          this.emit('deliberationProgress', current);
          setTimeout(poll, 2000);
        }
      };
      poll();
    });
  }
  
  async listCouncilors(): Promise<Councilor[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/councilors`);
      if (response.ok) {
        return await response.json();
      }
    } catch {
      // Ignore
    }
    return CORE_COUNCILORS;
  }
  
  async listModes(): Promise<DeliberationMode[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/modes`);
      if (response.ok) {
        return await response.json();
      }
    } catch {
      // Ignore
    }
    return DELIBERATION_MODES;
  }
  
  getSessionId(): string | null {
    return this.sessionId;
  }
  
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }
}

export default AICouncilClient;
