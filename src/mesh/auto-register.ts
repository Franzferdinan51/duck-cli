/**
 * 🦆 Duck Agent - Mesh Auto-Registration
 * Ensures all agents auto-register to mesh on startup
 */

import { AgentMesh } from './agent-mesh-enhanced.js';
import { MetaAgentSystem } from '../agent/meta-agent-system.js';

export interface MeshAutoRegisterConfig {
  meshUrl: string;
  autoStart: boolean;
  retryAttempts: number;
  retryDelay: number;
}

/**
 * Mesh Auto-Registration Manager
 * Automatically connects all agents to mesh on startup
 */
export class MeshAutoRegister {
  private mesh: AgentMesh;
  private metaSystem: MetaAgentSystem;
  private config: MeshAutoRegisterConfig;
  private registered: boolean = false;

  constructor(
    mesh: AgentMesh,
    metaSystem: MetaAgentSystem,
    config: Partial<MeshAutoRegisterConfig> = {}
  ) {
    this.mesh = mesh;
    this.metaSystem = metaSystem;
    this.config = {
      meshUrl: config.meshUrl || 'ws://localhost:4000',
      autoStart: config.autoStart !== false,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 5000
    };
  }

  /**
   * Start auto-registration process
   */
  async start(): Promise<void> {
    if (!this.config.autoStart) {
      console.log('[MeshAutoRegister] Auto-registration disabled');
      return;
    }

    console.log('[MeshAutoRegister] Starting auto-registration...');
    console.log(`[MeshAutoRegister] Mesh URL: ${this.config.meshUrl}`);

    // Connect meta system to mesh
    this.metaSystem.connectToMesh(this.mesh);

    // Wait for all agents to register
    await this.waitForRegistration();

    this.registered = true;
    console.log('[MeshAutoRegister] ✅ All agents registered to mesh');
  }

  /**
   * Wait for all agents to register with retry
   */
  private async waitForRegistration(): Promise<void> {
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const status = this.metaSystem.getStatus();
        
        if (status.meshConnected && status.totalAgents > 0) {
          console.log(`[MeshAutoRegister] ${status.totalAgents} agents connected`);
          return;
        }

        if (attempt < this.config.retryAttempts) {
          console.log(`[MeshAutoRegister] Retry ${attempt}/${this.config.retryAttempts}...`);
          await new Promise(r => setTimeout(r, this.config.retryDelay));
        }
      } catch (e) {
        console.error('[MeshAutoRegister] Registration error:', e);
        if (attempt < this.config.retryAttempts) {
          await new Promise(r => setTimeout(r, this.config.retryDelay));
        }
      }
    }

    throw new Error('Failed to register all agents to mesh');
  }

  /**
   * Check if all agents are registered
   */
  isRegistered(): boolean {
    return this.registered;
  }

  /**
   * Get registration status
   */
  getStatus(): {
    registered: boolean;
    meshUrl: string;
    agentCount: number;
  } {
    const status = this.metaSystem.getStatus();
    return {
      registered: this.registered,
      meshUrl: this.config.meshUrl,
      agentCount: status.totalAgents
    };
  }
}

export default MeshAutoRegister;
