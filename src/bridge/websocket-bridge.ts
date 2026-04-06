/**
 * WebSocket Bridge - Real WebSocket connection to OpenClaw Gateway
 */

import { EventEmitter } from "events";
import WebSocket, { RawData } from "ws";
import { ACPProtocol } from "./acp-protocol";
import {
  ACPMessage,
  BridgeConfig,
  BridgeState,
  BridgeEvent,
  BridgeEventHandler,
  generateId,
  timestamp,
} from "./types";

/**
 * WebSocket Bridge for OpenClaw Gateway Communication
 */
export class WebSocketBridge extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: BridgeConfig;
  private state: BridgeState = "disconnected";
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private lastPongTime: number = 0;
  private explicitlyDisconnected: boolean = false;
  private messageQueue: ACPMessage[] = [];
  private handlers: Map<string, (msg: ACPMessage) => void> = new Map();
  private connectResolve: ((value: void) => void) | null = null;
  private connectReject: ((err: Error) => void) | null = null;

  constructor(config: BridgeConfig) {
    super();
    this.config = {
      reconnectInterval: 5000,
      heartbeatInterval: 30000,
      connectionTimeout: 10000,
      ...config,
    };
  }

  /**
   * Connect to the OpenClaw gateway
   */
  async connect(): Promise<void> {
    if (this.state === "connected" || this.state === "connecting") {
      return;
    }

    this.setState("connecting");
    this.emitEvent("state_change", { state: "connecting" });

    return new Promise((resolve, reject) => {
      this.connectResolve = resolve;
      this.connectReject = reject;

      try {
        console.log(`[WS Bridge] Connecting to ${this.config.gatewayUrl}...`);
        this.ws = new WebSocket(this.config.gatewayUrl);

        // Set connection timeout
        const timeout = setTimeout(() => {
          if (this.state === "connecting") {
            this.ws?.close();
            reject(new Error("Connection timeout"));
          }
        }, this.config.connectionTimeout);

        this.ws.on("open", () => {
          clearTimeout(timeout);
          console.log(`[WS Bridge] Connected to ${this.config.gatewayUrl}`);
          this.setState("connected");
          this.emitEvent("connected", {});
          this.startHeartbeat();
          // Reset explicit disconnect flag on successful connect
          this.explicitlyDisconnected = false;
          this.flushMessageQueue();
          this.connectResolve?.();
          this.connectResolve = null;
          this.connectReject = null;
        });

        this.ws.on("message", (data: RawData) => {
          this.handleMessage(data);
        });

        this.ws.on("close", (code: number, reason: Buffer) => {
          console.log(`[WS Bridge] Disconnected (code: ${code}, reason: ${reason.toString()})`);
          this.cleanup();
          const wasConnected = this.state === "connected";
          this.setState("disconnected");
          this.emitEvent("disconnected", { code, reason: reason.toString(), wasConnected });

          // Auto-reconnect if was previously connected AND not explicitly disconnected
          if (wasConnected && !this.explicitlyDisconnected && this.config.reconnectInterval) {
            this.scheduleReconnect();
          }
          // Reset explicit disconnect flag
          this.explicitlyDisconnected = false;
        });

        this.ws.on("error", (err: Error) => {
          console.error(`[WS Bridge] Error: ${err.message}`);
          this.emitEvent("error", { error: err.message });
          
          if (this.connectReject) {
            clearTimeout(timeout);
            this.connectReject(err);
            this.connectReject = null;
            this.connectResolve = null;
          }
        });

        this.ws.on("pong", () => {
          this.lastPongTime = Date.now();
          const latency = this.lastPongTime - (this.lastPingTime || 0);
          console.log(`[WS Bridge] Pong received, latency: ${latency}ms`);
        });

      } catch (err) {
        this.setState("error");
        reject(err);
      }
    });
  }

  private lastPingTime: number = 0;

  /**
   * Start heartbeat/ping interval
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === 1 /* WebSocket.OPEN */) {
        this.lastPingTime = Date.now();
        this.ws.ping();
        
        // Check if we received a pong recently (within 2 heartbeat intervals)
        const staleThreshold = (this.config.heartbeatInterval || 30000) * 2;
        if (this.lastPongTime && Date.now() - this.lastPongTime > staleThreshold) {
          console.warn("[WS Bridge] Connection seems stale, reconnecting...");
          this.ws.close();
        }
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return; // Already scheduled
    }

    this.setState("reconnecting");
    this.emitEvent("state_change", { state: "reconnecting" });

    console.log(`[WS Bridge] Scheduling reconnect in ${this.config.reconnectInterval}ms...`);
    
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      
      try {
        await this.connect();
      } catch (err) {
        console.error(`[WS Bridge] Reconnect failed: ${err}`);
        // Will schedule another reconnect via close handler
      }
    }, this.config.reconnectInterval);
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: RawData): void {
    try {
      let message: ACPMessage;
      
      if (data instanceof Buffer) {
        message = ACPProtocol.deserialize(data.toString());
      } else if (typeof data === "string") {
        message = ACPProtocol.deserialize(data);
      } else {
        console.warn("[WS Bridge] Unknown message type:", typeof data);
        return;
      }

      // Validate message
      const validation = ACPProtocol.validate(message);
      if (!validation.valid) {
        console.warn(`[WS Bridge] Invalid message: ${validation.error}`);
        return;
      }

      console.log(`[WS Bridge] ← ${ACPProtocol.getTypeLabel(message.type)} from ${message.source}`);

      // Emit event for general listeners
      this.emitEvent("message", { message });

      // Emit specific event for message type
      this.emit(message.type, message);

      // Handle message-specific handlers
      const handler = this.handlers.get(message.type);
      if (handler) {
        handler(message);
      }

      // Handle tool calls specifically
      if (message.type === "tool_call") {
        this.emit("tool_call", message);
      }
    } catch (err) {
      console.error(`[WS Bridge] Failed to handle message: ${err}`);
    }
  }

  /**
   * Send an ACP message
   */
  async send(message: ACPMessage): Promise<void> {
    const serialized = ACPProtocol.serialize(message);
    
    if (this.ws && this.ws.readyState === 1 /* WebSocket.OPEN */) {
      this.ws.send(serialized);
      console.log(`[WS Bridge] → ${ACPProtocol.getTypeLabel(message.type)} to ${message.target || "gateway"}`);
    } else {
      console.warn("[WS Bridge] Not connected, queueing message");
      this.messageQueue.push(message);
    }
  }

  /**
   * Send a message and wait for a specific response type
   */
  async sendAndWait<T extends ACPMessage>(
    message: ACPMessage,
    responseType: string,
    timeoutMs: number = 30000
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.handlers.delete(responseType);
        reject(new Error(`Timeout waiting for ${responseType} response`));
      }, timeoutMs);

      const handler = (msg: ACPMessage) => {
        clearTimeout(timer);
        this.handlers.delete(responseType);
        resolve(msg as T);
      };

      this.handlers.set(responseType, handler);
      this.send(message);
    });
  }

  /**
   * Flush queued messages
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift()!;
      this.send(msg);
    }
  }

  /**
   * Disconnect from gateway
   */
  disconnect(reason?: string): void {
    console.log(`[WS Bridge] Disconnecting: ${reason || "no reason"}`);
    
    // Don't auto-reconnect if we explicitly disconnected
    this.explicitlyDisconnected = true;
    this.clearReconnect();
    
    if (this.ws) {
      this.ws.close(1000, reason);
    }
    
    this.cleanup();
    this.setState("disconnected");
  }

  /**
   * Cleanup timers and state
   */
  private cleanup(): void {
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws = null;
    }
  }

  /**
   * Clear reconnection timer
   */
  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Set bridge state
   */
  private setState(state: BridgeState): void {
    if (this.state !== state) {
      this.state = state;
      this.emit("stateChanged", state);
    }
  }

  /**
   * Get current state
   */
  getState(): BridgeState {
    return this.state;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === "connected" && this.ws?.readyState === 1 /* WebSocket.OPEN */;
  }

  /**
   * Emit a bridge event
   */
  private emitEvent(type: BridgeEvent["type"], data?: any): void {
    const event: BridgeEvent = {
      type,
      data,
      timestamp: timestamp(),
    };
    this.emit("event", event);
  }

  // Override to properly chain
  addListener(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.addListener(event, listener);
  }

  on(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  once(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.once(event, listener);
  }

  off(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.off(event, listener);
  }

  removeListener(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.removeListener(event, listener);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<BridgeConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current config
   */
  getConfig(): BridgeConfig {
    return { ...this.config };
  }

  /**
   * Get connection URL
   */
  getUrl(): string {
    return this.config.gatewayUrl;
  }
}
