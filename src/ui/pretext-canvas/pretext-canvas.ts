/**
 * 🦆 Duck Agent - Pretext Canvas Renderer
 * Character-level text measurement with Canvas rendering
 * Combines Pretext + Textura for AI-controlled generative UI
 */

import { prepareWithSegments, layoutWithLines, layoutNextLine } from '@chenglou/pretext';

export interface MessageBubble {
  id: string;
  text: string;
  sender: 'user' | 'agent';
  timestamp: Date;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  lines?: Line[];
}

export interface Line {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VoteOption {
  id: string;
  label: string;
  votes: number;
  percentage: number;
}

export interface VotePanel {
  id: string;
  question: string;
  options: VoteOption[];
  totalVotes: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface ConsensusMeter {
  id: string;
  label: string;
  value: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface StreamingMessage {
  id: string;
  text: string;
  prepared: any;
  lines: Line[];
  height: number;
  x: number;
  y: number;
  width: number;
}

const PARTICLE_COLORS = [
  '#4f46e5', '#8b5cf6', '#ec4899', '#06b6d4', 
  '#10b981', '#f59e0b', '#ef4444', '#6366f1'
];

export class PretextCanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private messages: Map<string, MessageBubble> = new Map();
  private votePanels: Map<string, VotePanel> = new Map();
  private consensusMeters: Map<string, ConsensusMeter> = new Map();
  private particles: Particle[] = [];
  private streamingMessages: Map<string, StreamingMessage> = new Map();
  private animationFrame: number = 0;
  private width: number;
  private height: number;
  private fontSize: number;
  private lineHeight: number;
  private padding: number;
  
  constructor(canvas: HTMLCanvasElement, width = 400, height = 600) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.width = width;
    this.height = height;
    this.fontSize = 16;
    this.lineHeight = 1.4;
    this.padding = 12;
  }
  
  /**
   * Measure text with Pretext
   */
  measureText(text: string, maxWidth: number): { width: number; height: number; lines: Line[] } {
    const font = `${this.fontSize}px system-ui, sans-serif`;
    const lh = this.fontSize * this.lineHeight;
    
    const prepared = prepareWithSegments(text, font);
    const result = layoutWithLines(prepared, maxWidth - this.padding * 2, lh);
    const rawLines = result.lines || [];
    let y = 0;
    const lines: Line[] = rawLines.map(l => {
      const line = { text: l.text, x: 0, y, width: l.width, height: lh };
      y += lh;
      return line;
    });
    
    return { width: maxWidth, height: result.height, lines };
  }
  
  /**
   * Pre-measure a message for streaming
   */
  prepareStreamingMessage(id: string, text: string, x: number, y: number, width: number): StreamingMessage {
    const font = `${this.fontSize}px system-ui, sans-serif`;
    const lh = this.fontSize * this.lineHeight;
    
    const prepared = prepareWithSegments(text, font);
    const result = layoutWithLines(prepared, width - this.padding * 2, lh);
    let yPos = 0;
    const lines: Line[] = result.lines.map((l: any) => {
      const line = { text: l.text, x: 0, y: yPos, width: l.width, height: lh };
      yPos += lh;
      return line;
    });
    const height = result.height + this.padding * 2;
    
    const msg: StreamingMessage = {
      id,
      text: '',
      prepared,
      lines: lines as Line[],
      height,
      x,
      y,
      width: width as number,
    };
    
    this.streamingMessages.set(id, msg);
    return msg;
  }
  
  /**
   * Update streaming message with more text
   */
  updateStreamingMessage(id: string, text: string): void {
    const msg = this.streamingMessages.get(id);
    if (!msg) return;
    
    msg.text = text;
    // Re-measure with new text
    const measured = this.measureText(text, msg.width);
    msg.height = measured.height + this.padding * 2;
  }
  
  /**
   * Create a message bubble
   */
  createMessage(id: string, text: string, sender: 'user' | 'agent'): MessageBubble {
    const measured = this.measureText(text, this.width);
    const isUser = sender === 'user';
    
    const bubble: MessageBubble = {
      id,
      text,
      sender,
      timestamp: new Date(),
      x: isUser ? this.width - measured.width - this.padding * 2 - 10 : 10,
      y: 0, // Will be calculated in layout
      width: measured.width + this.padding * 2,
      height: measured.height + this.padding * 2,
      lines: measured.lines,
    };
    
    this.messages.set(id, bubble);
    return bubble;
  }
  
  /**
   * Create a vote panel
   */
  createVotePanel(id: string, question: string, options: string[]): VotePanel {
    const panel: VotePanel = {
      id,
      question,
      options: options.map((label, i) => ({
        id: `opt_${i}`,
        label,
        votes: 0,
        percentage: 0,
      })),
      totalVotes: 0,
      x: 20,
      y: 100,
      width: this.width - 40,
      height: 200,
    };
    
    this.votePanels.set(id, panel);
    return panel;
  }
  
  /**
   * Update vote
   */
  vote(panelId: string, optionId: string): void {
    const panel = this.votePanels.get(panelId);
    if (!panel) return;
    
    const option = panel.options.find(o => o.id === optionId);
    if (option) {
      option.votes++;
      panel.totalVotes++;
      panel.options.forEach(o => {
        o.percentage = panel.totalVotes > 0 
          ? Math.round((o.votes / panel.totalVotes) * 100) 
          : 0;
      });
    }
  }
  
  /**
   * Create consensus meter
   */
  createConsensusMeter(id: string, label: string, value: number): ConsensusMeter {
    const meter: ConsensusMeter = {
      id,
      label,
      value,
      x: 20,
      y: 100,
      width: this.width - 40,
      height: 40,
    };
    
    this.consensusMeters.set(id, meter);
    return meter;
  }
  
  /**
   * Spawn particles
   */
  spawnParticles(x: number, y: number, count: number = 10): void {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4 - 2,
        life: 1,
        maxLife: 60 + Math.random() * 60,
        size: 2 + Math.random() * 4,
        color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
      });
    }
  }
  
  /**
   * Layout all messages vertically
   */
  layout(): void {
    let y = 10;
    const spacing = 8;
    
    for (const msg of this.messages.values()) {
      msg.y = y;
      y += (msg.height || 0) + spacing;
    }
    
    // Position vote panels
    let voteY = y + 20;
    for (const panel of this.votePanels.values()) {
      panel.y = voteY;
      voteY += (panel.height || 0) + 20;
    }
    
    // Position consensus meters
    let meterY = voteY + 20;
    for (const meter of this.consensusMeters.values()) {
      meter.y = meterY;
      meterY += (meter.height || 0) + 10;
    }
  }
  
  /**
   * Render everything
   */
  render(): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
    
    // Background
    this.ctx.fillStyle = '#0a0a1a';
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    // Render messages
    for (const msg of this.messages.values()) {
      this.renderMessage(msg);
    }
    
    // Render vote panels
    for (const panel of this.votePanels.values()) {
      this.renderVotePanel(panel);
    }
    
    // Render consensus meters
    for (const meter of this.consensusMeters.values()) {
      this.renderConsensusMeter(meter);
    }
    
    // Render streaming messages
    for (const msg of this.streamingMessages.values()) {
      this.renderStreamingMessage(msg);
    }
    
    // Render particles
    this.renderParticles();
  }
  
  /**
   * Render a message bubble
   */
  private renderMessage(msg: MessageBubble): void {
    const isUser = msg.sender === 'user';
    const bgColor = isUser ? '#4f46e5' : '#1e293b';
    const radius = 12;
    
    // Bubble background
    this.ctx.fillStyle = bgColor;
    this.roundRect(msg.x!, msg.y!, msg.width!, msg.height || 0, radius);
    this.ctx.fill();
    
    // Text
    this.ctx.fillStyle = '#fff';
    this.ctx.font = `${this.fontSize}px system-ui, sans-serif`;
    this.ctx.textBaseline = 'top';
    
    const textX = msg.x! + this.padding;
    const textY = msg.y! + this.padding;
    
    for (const line of msg.lines || []) {
      this.ctx.fillText(line.text, textX + line.x, textY + line.y);
    }
    
    // Timestamp
    this.ctx.font = '10px system-ui, sans-serif';
    this.ctx.fillStyle = 'rgba(255,255,255,0.5)';
    const time = msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.ctx.fillText(time, msg.x! + this.padding, msg.y! + (msg.height || 0) - 14);
  }
  
  /**
   * Render a vote panel
   */
  private renderVotePanel(panel: VotePanel): void {
    // Panel background
    this.ctx.fillStyle = '#1e293b';
    this.roundRect(panel.x!, panel.y!, panel.width!, panel.height || 0, 12);
    this.ctx.fill();
    
    // Question
    this.ctx.fillStyle = '#fff';
    this.ctx.font = 'bold 14px system-ui, sans-serif';
    this.ctx.fillText(panel.question, panel.x! + 12, panel.y! + 20);
    
    // Options
    let optY = panel.y! + 50;
    for (const opt of panel.options) {
      // Option background
      this.ctx.fillStyle = '#0f172a';
      this.roundRect(panel.x! + 12, optY, panel.width! - 24, 36, 6);
      this.ctx.fill();
      
      // Progress bar
      const barWidth = (panel.width! - 48) * (opt.percentage / 100);
      this.ctx.fillStyle = '#4f46e5';
      this.roundRect(panel.x! + 12, optY, barWidth, 36, 6);
      this.ctx.fill();
      
      // Label
      this.ctx.fillStyle = '#fff';
      this.ctx.font = '14px system-ui, sans-serif';
      this.ctx.fillText(opt.label, panel.x! + 20, optY + 12);
      
      // Percentage
      this.ctx.fillStyle = opt.percentage > 50 ? '#fff' : '#94a3b8';
      this.ctx.fillText(`${opt.percentage}%`, panel.x! + panel.width! - 50, optY + 12);
      
      optY += 44;
    }
    
    // Total votes
    this.ctx.fillStyle = '#64748b';
    this.ctx.font = '12px system-ui, sans-serif';
    this.ctx.fillText(`${panel.totalVotes} votes`, panel.x! + 12, panel.y! + (panel.height || 0) - 16);
  }
  
  /**
   * Render consensus meter
   */
  private renderConsensusMeter(meter: ConsensusMeter): void {
    // Label
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = '12px system-ui, sans-serif';
    this.ctx.fillText(meter.label, meter.x!, meter.y!);
    
    // Bar background
    this.ctx.fillStyle = '#1e293b';
    this.roundRect(meter.x!, meter.y! + 16, meter.width!, 20, 10);
    this.ctx.fill();
    
    // Progress
    const progress = meter.value / 100;
    const gradient = this.ctx.createLinearGradient(meter.x!, 0, meter.x! + meter.width!, 0);
    gradient.addColorStop(0, '#ef4444');
    gradient.addColorStop(0.5, '#f59e0b');
    gradient.addColorStop(1, '#10b981');
    
    this.ctx.fillStyle = gradient;
    this.roundRect(meter.x!, meter.y! + 16, meter.width! * progress, 20, 10);
    this.ctx.fill();
    
    // Value
    this.ctx.fillStyle = '#fff';
    this.ctx.font = 'bold 14px system-ui, sans-serif';
    this.ctx.fillText(`${meter.value}%`, meter.x! + meter.width! - 35, meter.y! + 40);
  }
  
  /**
   * Render streaming message
   */
  private renderStreamingMessage(msg: StreamingMessage): void {
    const bgColor = '#1e293b';
    
    this.ctx.fillStyle = bgColor;
    this.roundRect(msg.x, msg.y, msg.width, msg.height, 12);
    this.ctx.fill();
    
    // Cursor blink effect
    const cursorVisible = Math.floor(Date.now() / 500) % 2 === 0;
    
    this.ctx.fillStyle = '#fff';
    this.ctx.font = `${this.fontSize}px system-ui, sans-serif`;
    this.ctx.textBaseline = 'top';
    
    const textX = msg.x + this.padding;
    const textY = msg.y + this.padding;
    
    for (const line of msg.lines) {
      this.ctx.fillText(line.text, textX + line.x, textY + line.y);
    }
    
    // Blinking cursor
    if (cursorVisible && msg.text.length > 0) {
      const lastLine = msg.lines[msg.lines.length - 1];
      const cursorX = textX + lastLine.x + lastLine.width + 2;
      const cursorY = textY + lastLine.y;
      this.ctx.fillRect(cursorX, cursorY, 2, this.fontSize);
    }
  }
  
  /**
   * Update and render particles
   */
  private renderParticles(): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      
      // Update
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1; // gravity
      p.life++;
      
      // Draw
      const alpha = 1 - p.life / p.maxLife;
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.globalAlpha = 1;
      
      // Remove dead particles
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
      }
    }
  }
  
  /**
   * Rounded rectangle helper
   */
  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.lineTo(x + w - r, y);
    this.ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    this.ctx.lineTo(x + w, y + h - r);
    this.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.ctx.lineTo(x + r, y + h);
    this.ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    this.ctx.lineTo(x, y + r);
    this.ctx.quadraticCurveTo(x, y, x + r, y);
    this.ctx.closePath();
  }
  
  /**
   * Start animation loop
   */
  startAnimation(): void {
    const animate = () => {
      this.render();
      this.animationFrame = requestAnimationFrame(animate);
    };
    animate();
  }
  
  /**
   * Stop animation
   */
  stopAnimation(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
  }
  
  /**
   * Clear all
   */
  clear(): void {
    this.messages.clear();
    this.votePanels.clear();
    this.consensusMeters.clear();
    this.particles = [];
    this.streamingMessages.clear();
  }
  
}

export default PretextCanvasRenderer;
