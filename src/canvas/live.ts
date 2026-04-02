/**
 * 🦆 Duck Agent - Canvas Live Renderer
 * Wires pretext-canvas + a2ui into the agent for live visual output
 * Renders messages, votes, consensus meters, and particles on Canvas
 */

import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawn } from 'child_process';

export interface CanvasConfig {
  width?: number;
  height?: number;
  background?: string;
  outputPath?: string;
  autoOpen?: boolean;
  port?: number;
}

export interface RenderMessage {
  role: 'user' | 'agent';
  content: string;
  timestamp?: Date;
}

export class CanvasLiveRenderer {
  private config: Required<CanvasConfig>;
  private messages: RenderMessage[] = [];

  constructor(config: CanvasConfig = {}) {
    this.config = {
      width: config.width ?? 800,
      height: config.height ?? 600,
      background: config.background ?? '#0a0a1a',
      outputPath: config.outputPath ?? join(tmpdir(), 'duck-canvas.html'),
      autoOpen: config.autoOpen ?? true,
      port: config.port ?? 9229,
    };
  }

  /**
   * Add a message to the render queue
   */
  addMessage(msg: RenderMessage): void {
    this.messages.push(msg);
  }

  /**
   * Generate canvas script for messages
   */
  private generateMessageScript(): string {
    const lines: string[] = [];
    const W = this.config.width;
    
    for (let i = 0; i < this.messages.length; i++) {
      const msg = this.messages[i];
      const prepared = prepareWithSegments(msg.content, '16px Inter, sans-serif');
      const { lines: textLines } = layoutWithLines(prepared, W - 100, 20);
      
      const bubbleH = textLines.length * 20 + 30;
      const bx = msg.role === 'agent' ? 20 : W - 220;
      const by = 60 + i * 90;
      const bgColor = msg.role === 'agent' ? '#1e3a5f' : '#2d4a2d';
      const textColor = msg.role === 'agent' ? '#60a5fa' : '#4ade80';
      
      lines.push(
        `ctx.fillStyle = '${bgColor}';`,
        `ctx.beginPath();`,
        `ctx.roundRect(${bx}, ${by}, 200, ${bubbleH}, 12);`,
        `ctx.fill();`,
        `ctx.fillStyle = '${textColor}';`,
        `ctx.font = '14px Inter';`,
      );
      
      for (const line of textLines) {
        lines.push(`ctx.fillText("${this.escapeJS(line.text)}", ${bx + 12}, ${by + 24 + (line as any).y});`);
      }
    }
    
    return lines.join('\n');
  }

  private escapeJS(str: string): string {
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }

  /**
   * Generate vote panel script
   */
  private generateVoteScript(question: string, options: { label: string; votes: number }[]): string {
    const total = options.reduce((s, o) => s + o.votes, 0);
    const W = this.config.width;
    const lines: string[] = [];
    
    lines.push(`ctx.fillStyle = '#ffffff'; ctx.font = 'bold 18px Inter'; ctx.fillText("${this.escapeJS(question)}", 20, ${this.config.height - 200});`);
    
    let y = this.config.height - 170;
    for (const opt of options) {
      const pct = total > 0 ? opt.votes / total : 0;
      const barW = pct * (W - 60);
      lines.push(
        `ctx.fillStyle = '#ffffff22'; ctx.fillRect(20, ${y}, ${W - 60}, 24);`,
        `ctx.fillStyle = '#60a5fa'; ctx.fillRect(20, ${y}, ${barW}, 24);`,
        `ctx.fillStyle = '#ffffff'; ctx.font = '14px Inter'; ctx.fillText("${this.escapeJS(opt.label)} (${Math.round(pct * 100)}%)", 30, ${y + 17});`
      );
      y += 36;
    }
    
    return lines.join('\n');
  }

  /**
   * Generate consensus meter script
   */
  private generateConsensusMeterScript(value: number, label: string): string {
    const W = this.config.width;
    const color = value >= 0.7 ? '#4ade80' : value >= 0.4 ? '#fbbf24' : '#f87171';
    return [
      `ctx.fillStyle = '#ffffff33'; ctx.fillRect(20, ${this.config.height - 60}, ${W - 40}, 30);`,
      `ctx.fillStyle = '${color}'; ctx.fillRect(20, ${this.config.height - 60}, ${(W - 40) * value}, 30);`,
      `ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px Inter'; ctx.fillText("${this.escapeJS(label)}: ${Math.round(value * 100)}%", 20, ${this.config.height - 70});`,
    ].join('\n');
  }

  /**
   * Render to HTML file
   */
  render(): string {
    const msgScript = this.generateMessageScript();
    
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Duck Agent Canvas</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: ${this.config.background}; overflow: hidden; }
canvas { display: block; }
#overlay { position: fixed; top: 20px; right: 20px; color: #555; font: 12px monospace; }
</style>
</head>
<body>
<canvas id="duck-canvas"></canvas>
<div id="overlay">🦆 Duck Canvas Live</div>
<script>
(function() {
  const canvas = document.getElementById('duck-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, '#0a0a1a');
  grad.addColorStop(1, '#1a1a3a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ${msgScript}
  
  ctx.fillStyle = 'rgba(0,0,0,0.03)';
  for (let y = 0; y < canvas.height; y += 4) { ctx.fillRect(0, y, canvas.width, 2); }
})();
</script>
</body>
</html>`;
  }

  /**
   * Save and open
   */
  save(): string {
    const html = this.render();
    writeFileSync(this.config.outputPath, html);
    if (this.config.autoOpen) this.open();
    return this.config.outputPath;
  }

  /**
   * Open in browser
   */
  open(): void {
    const { platform } = require('os');
    const cmd = platform() === 'darwin' ? 'open' : platform() === 'win32' ? 'start' : 'xdg-open';
    spawn(cmd, [this.config.outputPath], { detached: true, stdio: 'ignore' });
  }

  /**
   * Quick static render for council/agent output
   */
  static renderToHTML(title: string, content: string): string {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>${title}</title>
<style>
body { background: linear-gradient(135deg, #0a0a1a, #1a1a3a); color: #fff; font: 16px Inter, sans-serif; padding: 40px; min-height: 100vh; }
h1 { color: #60a5fa; margin-bottom: 20px; }
p { line-height: 1.8; max-width: 800px; }
</style>
</head>
<body>
<h1>🦆 ${title}</h1>
<p>${content.replace(/\n/g, '<br>')}</p>
</body></html>`;
  }
}

export default CanvasLiveRenderer;
