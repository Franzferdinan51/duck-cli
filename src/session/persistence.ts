/**
 * 🦆 Duck Agent - Session Persistence
 * Ensures session context persists across restarts and doesn't unbind
 */

import { SessionManager } from './session-manager.js';

export interface PersistentSessionConfig {
  bindToProcess: boolean;
  restoreOnStart: boolean;
  persistContext: boolean;
}

/**
 * Session Persistence Manager
 * Prevents session unbinding and ensures context survives restarts
 */
export class SessionPersistence {
  private sessionManager: SessionManager;
  private config: PersistentSessionConfig;
  private processHandlersInstalled: boolean = false;

  constructor(
    sessionManager: SessionManager,
    config: Partial<PersistentSessionConfig> = {}
  ) {
    this.sessionManager = sessionManager;
    this.config = {
      bindToProcess: config.bindToProcess !== false,
      restoreOnStart: config.restoreOnStart !== false,
      persistContext: config.persistContext !== false
    };
  }

  /**
   * Initialize persistence
   */
  async initialize(): Promise<void> {
    await this.sessionManager.initialize();
    
    if (this.config.bindToProcess) {
      this.installProcessHandlers();
    }
    
    console.log('[SessionPersistence] Initialized');
  }

  /**
   * Install process handlers to prevent unbinding
   */
  private installProcessHandlers(): void {
    if (this.processHandlersInstalled) return;

    // Save on exit
    process.on('exit', () => {
      console.log('[SessionPersistence] Process exit - saving sessions...');
      this.sessionManager.saveSessions();
    });

    // Save on SIGINT (Ctrl+C)
    process.on('SIGINT', async () => {
      console.log('[SessionPersistence] SIGINT received - saving sessions...');
      await this.sessionManager.saveSessions();
      process.exit(0);
    });

    // Save on SIGTERM
    process.on('SIGTERM', async () => {
      console.log('[SessionPersistence] SIGTERM received - saving sessions...');
      await this.sessionManager.saveSessions();
      process.exit(0);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      console.error('[SessionPersistence] Uncaught exception:', error);
      await this.sessionManager.saveSessions();
    });

    this.processHandlersInstalled = true;
    console.log('[SessionPersistence] Process handlers installed');
  }

  /**
   * Ensure session doesn't unbind
   */
  keepAlive(): void {
    const session = this.sessionManager.getActiveSession();
    
    // Update last active to prevent timeout
    setInterval(() => {
      session.lastActiveAt = new Date();
    }, 60000); // Every minute

    console.log('[SessionPersistence] Session keep-alive enabled');
  }

  /**
   * Get current session with guaranteed persistence
   */
  getBoundSession() {
    return this.sessionManager.getActiveSession();
  }

  /**
   * Force immediate save
   */
  async forceSave(): Promise<void> {
    await this.sessionManager.saveSessions();
    console.log('[SessionPersistence] Sessions force-saved');
  }
}

export default SessionPersistence;
