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
  verdict?: string;
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
  {
    id: 'conspiracist',
    name: 'The Conspiracist',
    role: 'councilor',
    persona: 'You look for alternative explanations and hidden connections others might miss.',
    color: 'from-purple-500 to-violet-700',
    enabled: true,
  },
  {
    id: 'moderator',
    name: 'The Moderator',
    role: 'councilor',
    persona: 'You ensure balanced representation and prevent any single perspective from dominating.',
    color: 'from-blue-500 to-indigo-700',
    enabled: true,
  },
  {
    id: 'coder',
    name: 'The Coder',
    role: 'councilor',
    persona: 'You focus on implementation details, code quality, and technical feasibility.',
    color: 'from-green-500 to-emerald-700',
    enabled: true,
  },
  {
    id: 'economist',
    name: 'The Economist',
    role: 'councilor',
    persona: 'You analyze costs, benefits, market forces, and economic implications.',
    color: 'from-yellow-500 to-amber-700',
    enabled: false,
  },
  {
    id: 'product_manager',
    name: 'The Product Manager',
    role: 'councilor',
    persona: 'You focus on user needs, roadmaps, and product-market fit.',
    color: 'from-orange-500 to-red-700',
    enabled: false,
  },
  {
    id: 'devops',
    name: 'The DevOps Engineer',
    role: 'councilor',
    persona: 'You think about deployment, scaling, reliability, and infrastructure.',
    color: 'from-cyan-500 to-teal-700',
    enabled: false,
  },
  {
    id: 'security_expert',
    name: 'The Security Expert',
    role: 'councilor',
    persona: 'You identify vulnerabilities, attack vectors, and security risks.',
    color: 'from-red-500 to-rose-700',
    enabled: false,
  },
  {
    id: 'data_scientist',
    name: 'The Data Scientist',
    role: 'councilor',
    persona: 'You focus on data analysis, metrics, A/B tests, and evidence.',
    color: 'from-violet-500 to-purple-700',
    enabled: false,
  },
  {
    id: 'qa',
    name: 'The QA Engineer',
    role: 'councilor',
    persona: 'You think about edge cases, bugs, testing, and quality assurance.',
    color: 'from-pink-500 to-rose-700',
    enabled: false,
  },
  {
    id: 'legal_expert',
    name: 'The Legal Expert',
    role: 'councilor',
    persona: 'You focus on compliance, liabilities, regulations, and legal risks.',
    color: 'from-slate-500 to-gray-700',
    enabled: false,
  },
  {
    id: 'privacy_officer',
    name: 'The Privacy Officer',
    role: 'councilor',
    persona: 'You analyze data privacy implications, GDPR, and user consent.',
    color: 'from-indigo-500 to-blue-700',
    enabled: false,
  },
  {
    id: 'accessibility_expert',
    name: 'The Accessibility Expert',
    role: 'councilor',
    persona: 'You ensure solutions work for users with disabilities.',
    color: 'from-teal-500 to-cyan-700',
    enabled: false,
  },
  {
    id: 'user_advocate',
    name: 'The User Advocate',
    role: 'councilor',
    persona: 'You represent end-user perspectives and user experience.',
    color: 'from-lime-500 to-green-700',
    enabled: false,
  },
  {
    id: 'community_manager',
    name: 'The Community Manager',
    role: 'councilor',
    persona: 'You think about community impact, engagement, and stakeholder relations.',
    color: 'from-fuchsia-500 to-pink-700',
    enabled: false,
  },
  {
    id: 'innovation_coach',
    name: 'The Innovation Coach',
    role: 'councilor',
    persona: 'You encourage creative risk-taking and innovation culture.',
    color: 'from-amber-500 to-orange-700',
    enabled: false,
  },
  {
    id: 'hr_specialist',
    name: 'The HR Specialist',
    role: 'councilor',
    persona: 'You focus on team dynamics, hiring, culture, and employee well-being.',
    color: 'from-sky-500 to-cyan-700',
    enabled: false,
  },
  {
    id: 'environmental',
    name: 'The Environmental Specialist',
    role: 'councilor',
    persona: 'You assess environmental impact and sustainability.',
    color: 'from-green-500 to-emerald-700',
    enabled: false,
  },
  {
    id: 'meteorologist',
    name: 'The Meteorologist',
    role: 'councilor',
    persona: 'You analyze weather patterns, climate data, and atmospheric conditions.',
    color: 'from-sky-500 to-blue-700',
    enabled: false,
  },
  {
    id: 'emergency_manager',
    name: 'The Emergency Manager',
    role: 'councilor',
    persona: 'You focus on disaster preparedness, response plans, and contingencies.',
    color: 'from-red-600 to-orange-700',
    enabled: false,
  },
  {
    id: 'botanist',
    name: 'The Botanist',
    role: 'councilor',
    persona: 'You specialize in plant science, agriculture, and horticulture.',
    color: 'from-green-600 to-lime-700',
    enabled: false,
  },
  {
    id: 'geneticist',
    name: 'The Geneticist',
    role: 'councilor',
    persona: 'You focus on genetics, breeding, and biological research.',
    color: 'from-cyan-600 to-teal-700',
    enabled: false,
  },
  {
    id: 'risk_analyst',
    name: 'The Risk Analyst',
    role: 'councilor',
    persona: 'You quantify and manage risks, create risk matrices.',
    color: 'from-amber-600 to-yellow-700',
    enabled: false,
  },
  {
    id: 'swarm_agent',
    name: 'The Swarm Coordinator',
    role: 'councilor',
    persona: 'You coordinate multi-agent systems and parallel processing.',
    color: 'from-violet-600 to-purple-700',
    enabled: false,
  },
];

export class AICouncilClient extends EventEmitter {
  private baseUrl: string;
  sessionId: string | null = null;
  currentMode: string = 'deliberation';
  
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
    } catch (e) {
      console.error('[Council] healthCheck failed:', e instanceof Error ? e.message : e);
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
    } catch (e) {
      console.error('[Council] setTopic failed:', e instanceof Error ? e.message : e);
      return false;
    }
  }
  
  async getSession(sessionId?: string): Promise<Session | null> {
    const id = sessionId || this.sessionId;
    if (!id) return null;
    
    try {
      const response = await fetch(`${this.baseUrl}/api/session/${id}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.error('[Council] getSession failed:', e instanceof Error ? e.message : e);
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
    } catch (e) {
      console.warn('[Council] listCouncilors failed, using defaults:', e instanceof Error ? e.message : e);
    }
    return CORE_COUNCILORS;
  }
  
  async listModes(): Promise<DeliberationMode[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/modes`);
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.warn('[Council] listModes failed, using defaults:', e instanceof Error ? e.message : e);
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
