/**
 * Duck Agent Desktop — Agent Mesh Panel
 *
 * Visual mesh of connected agents with real-time status,
 * latency, message routing, and mesh topology.
 *
 * Design patterns: from Agent Mesh API + Lobster Edition mesh dashboard
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DuckCard } from './components/duck-card';
import { StatusIndicator } from './components/status-indicator';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MeshAgent {
  id: string;
  name: string;
  type: 'duckbot' | 'agent-smith' | 'canna' | 'canary' | 'duckets' | 'unknown';
  status: 'online' | 'busy' | 'idle' | 'offline';
  latency: number; // ms
  location: { x: number; y: number }; // normalized 0-1
  model?: string;
  capabilities: string[];
  color: string;
  emoji: string;
}

interface MeshEdge {
  from: string;
  to: string;
  active: boolean;
  messagesPerMin: number;
}

interface MeshPanelProps {
  addToast: (t: { type: string; message: string }) => void;
  gateway: { connected: boolean; url: string; latency: number };
  session: { active: boolean; agentCount: number; messageCount: number };
  setSession: React.Dispatch<React.SetStateAction<{ active: boolean; agentCount: number; messageCount: number }>>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const AGENTS: MeshAgent[] = [
  {
    id: 'duckbot',
    name: 'DuckBot',
    type: 'duckbot',
    status: 'online',
    latency: 0,
    location: { x: 0.5, y: 0.2 },
    model: 'MiniMax-M2.7',
    capabilities: ['reasoning', 'coding', 'vision', 'speech', 'image'],
    color: '#fbbf24',
    emoji: '🦆',
  },
  {
    id: 'agent-smith',
    name: 'Agent Smith',
    type: 'agent-smith',
    status: 'online',
    latency: 42,
    location: { x: 0.8, y: 0.4 },
    model: 'qwen3.5-27b',
    capabilities: ['coding', 'reasoning', 'windows'],
    color: '#22c55e',
    emoji: '🤖',
  },
  {
    id: 'canna',
    name: 'CannaAI',
    type: 'canna',
    status: 'busy',
    latency: 8,
    location: { x: 0.2, y: 0.4 },
    model: 'MiniMax-M2.7',
    capabilities: ['vision', 'chat', 'grow'],
    color: '#a855f7',
    emoji: '🌱',
  },
  {
    id: 'canary',
    name: 'Canary',
    type: 'canary',
    status: 'idle',
    latency: 65,
    location: { x: 0.3, y: 0.7 },
    model: 'jan-v3-4b',
    capabilities: ['fast-response', 'local'],
    color: '#06b6d4',
    emoji: '🐦',
  },
  {
    id: 'duckets',
    name: 'Duckets iPhone',
    type: 'duckets',
    status: 'offline',
    latency: 0,
    location: { x: 0.7, y: 0.7 },
    capabilities: ['telegram', 'mobile'],
    color: '#8b949e',
    emoji: '📱',
  },
];

const EDGES: MeshEdge[] = [
  { from: 'duckbot', to: 'agent-smith', active: true, messagesPerMin: 12 },
  { from: 'duckbot', to: 'canna', active: true, messagesPerMin: 8 },
  { from: 'duckbot', to: 'canary', active: false, messagesPerMin: 0 },
  { from: 'canna', to: 'agent-smith', active: true, messagesPerMin: 3 },
  { from: 'agent-smith', to: 'duckets', active: false, messagesPerMin: 0 },
];

// ─── Component ───────────────────────────────────────────────────────────────

const MeshPanel: React.FC<MeshPanelProps> = ({ addToast, gateway }) => {
  const [agents] = useState<MeshAgent[]>(AGENTS);
  const [edges] = useState<MeshEdge[]>(EDGES);
  const [selectedAgent, setSelectedAgent] = useState<MeshAgent | null>(null);
  const [viewMode, setViewMode] = useState<'mesh' | 'list'>('mesh');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  // ── Draw Mesh Visualization ─────────────────────────────────────────────
  const drawMesh = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Draw edges
    edges.forEach(edge => {
      const fromAgent = agents.find(a => a.id === edge.from);
      const toAgent = agents.find(a => a.id === edge.to);
      if (!fromAgent || !toAgent) return;

      const x1 = fromAgent.location.x * W;
      const y1 = fromAgent.location.y * H;
      const x2 = toAgent.location.x * W;
      const y2 = toAgent.location.y * H;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);

      if (edge.active) {
        const pulse = (Math.sin(Date.now() / 1000) + 1) / 2;
        ctx.strokeStyle = `rgba(251, 191, 36, ${0.3 + pulse * 0.3})`;
        ctx.lineWidth = 1 + pulse;
      } else {
        ctx.strokeStyle = 'rgba(48, 54, 61, 0.5)';
        ctx.lineWidth = 0.5;
      }
      ctx.stroke();
    });

    // Draw agent nodes
    agents.forEach(agent => {
      const cx = agent.location.x * W;
      const cy = agent.location.y * H;
      const radius = selectedAgent?.id === agent.id ? 18 : 14;

      // Glow for online agents
      if (agent.status !== 'offline') {
        const gradient = ctx.createRadialGradient(cx, cy, radius, cx, cy, radius * 2.5);
        gradient.addColorStop(0, `${agent.color}33`);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = agent.status === 'offline' ? '#21262d' : `${agent.color}33`;
      ctx.fill();
      ctx.strokeStyle = agent.status === 'offline' ? '#30363d' : agent.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Status dot
      const dotColors: Record<string, string> = {
        online: '#22c55e',
        busy: '#fbbf24',
        idle: '#06b6d4',
        offline: '#484f58',
      };
      ctx.beginPath();
      ctx.arc(cx + radius * 0.5, cy - radius * 0.5, 4, 0, Math.PI * 2);
      ctx.fillStyle = dotColors[agent.status];
      if (agent.status === 'busy') {
        // Pulsing for busy
        const pulse = (Math.sin(Date.now() / 300) + 1) / 2;
        ctx.globalAlpha = 0.5 + pulse * 0.5;
      }
      ctx.fill();
      ctx.globalAlpha = 1;

      // Label
      ctx.fillStyle = '#e6edf3';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(agent.name, cx, cy + radius + 14);
      ctx.fillStyle = '#8b949e';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.fillText(`${agent.latency}ms`, cx, cy + radius + 26);
    });

    animationRef.current = requestAnimationFrame(drawMesh);
  }, [agents, edges, selectedAgent]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    };

    resize();
    window.addEventListener('resize', resize);
    animationRef.current = requestAnimationFrame(drawMesh);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationRef.current);
    };
  }, [drawMesh]);

  // ─── Render ──────────────────────────────────────────────────────────────
  const onlineCount = agents.filter(a => a.status !== 'offline').length;
  const activeEdges = edges.filter(e => e.active).length;
  const totalMsgPerMin = edges.reduce((sum, e) => sum + e.messagesPerMin, 0);

  return (
    <div className="duck-mesh flex flex-col h-full p-4 space-y-4">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1c2333] border border-[#30363d] flex items-center justify-center text-2xl">
            🕸️
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#e6edf3]" style={{ fontFamily: 'var(--font-display)' }}>
              Agent Mesh
            </h2>
            <p className="text-xs text-[#8b949e]">
              {onlineCount}/{agents.length} agents online · {activeEdges} connections
            </p>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex bg-[#161b22] border border-[#30363d] rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('mesh')}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              viewMode === 'mesh' ? 'bg-[#1c2333] text-[#fbbf24]' : 'text-[#8b949e]'
            }`}
          >
            Mesh
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              viewMode === 'list' ? 'bg-[#1c2333] text-[#fbbf24]' : 'text-[#8b949e]'
            }`}
          >
            List
          </button>
        </div>
      </div>

      {/* ── Stats Row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Online', value: onlineCount, color: 'text-emerald-400' },
          { label: 'Busy', value: agents.filter(a => a.status === 'busy').length, color: 'text-amber-400' },
          { label: 'Connections', value: activeEdges, color: 'text-[#fbbf24]' },
          { label: 'Msg/min', value: totalMsgPerMin, color: 'text-cyan-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-[#161b22] border border-[#30363d] rounded-xl p-2 text-center">
            <div className={`text-lg font-bold font-mono ${stat.color}`}>{stat.value}</div>
            <div className="text-[10px] text-[#484f58]">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ── Main Content ───────────────────────────────────────────────── */}
      {viewMode === 'mesh' ? (
        <DuckCard className="flex-1 min-h-0 relative overflow-hidden p-0">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full cursor-crosshair"
            onClick={(e) => {
              const canvas = canvasRef.current;
              if (!canvas) return;
              const rect = canvas.getBoundingClientRect();
              const x = (e.clientX - rect.left) / canvas.width;
              const y = (e.clientY - rect.top) / canvas.height;

              // Find nearest agent
              let nearest: MeshAgent | null = null;
              let nearestDist = Infinity;
              agents.forEach(a => {
                const d = Math.hypot(a.location.x - x, a.location.y - y);
                if (d < nearestDist && d < 0.1) {
                  nearestDist = d;
                  nearest = a;
                }
              });

              setSelectedAgent(nearest !== selectedAgent ? nearest : null);
            }}
          />
          <div className="absolute bottom-2 right-2 text-[10px] text-[#484f58]">
            Click node to inspect · Live mesh
          </div>
        </DuckCard>
      ) : (
        <div className="space-y-2 flex-1 overflow-y-auto">
          {agents.map(agent => (
            <DuckCard
              key={agent.id}
              className={`cursor-pointer transition-all ${
                selectedAgent?.id === agent.id ? 'border-[#fbbf24]/50' : ''
              }`}
              onClick={() => setSelectedAgent(selectedAgent?.id === agent.id ? null : agent)}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{agent.emoji}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#e6edf3]">{agent.name}</span>
                    <StatusIndicator status={agent.status} />
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {agent.model && (
                      <span className="text-[10px] font-mono text-[#8b949e]">{agent.model}</span>
                    )}
                    {agent.latency > 0 && (
                      <span className="text-[10px] font-mono text-[#484f58]">{agent.latency}ms</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 max-w-[200px]">
                  {agent.capabilities.slice(0, 3).map(cap => (
                    <span key={cap} className="text-[9px] bg-[#21262d] text-[#8b949e] px-1.5 py-0.5 rounded">
                      {cap}
                    </span>
                  ))}
                </div>
              </div>

              {/* Expanded details */}
              {selectedAgent?.id === agent.id && (
                <div className="mt-3 pt-3 border-t border-[#30363d] space-y-2 animate-panel-enter">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[#484f58]">Type</span>
                      <div className="text-[#e6edf3]">{agent.type}</div>
                    </div>
                    <div>
                      <span className="text-[#484f58]">Latency</span>
                      <div className="text-[#fbbf24] font-mono">{agent.latency}ms</div>
                    </div>
                  </div>
                  <div>
                    <span className="text-[#484f58] text-xs">Capabilities</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {agent.capabilities.map(cap => (
                        <span key={cap} className="text-[10px] bg-[#fbbf24]/10 text-[#fbbf24] px-2 py-0.5 rounded-full">
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </DuckCard>
          ))}
        </div>
      )}

      {/* ── Selected Agent Quick View ───────────────────────────────────── */}
      {selectedAgent && viewMode === 'mesh' && (
        <DuckCard className="border-[#fbbf24]/30">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{selectedAgent.emoji}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#e6edf3]">{selectedAgent.name}</span>
                <StatusIndicator status={selectedAgent.status} />
              </div>
              <div className="text-xs text-[#8b949e] mt-0.5">
                {selectedAgent.model || 'No model'} · {selectedAgent.latency}ms
              </div>
            </div>
            <button
              onClick={() => setSelectedAgent(null)}
              className="text-[#484f58] hover:text-[#8b949e] text-lg"
            >
              ✕
            </button>
          </div>
        </DuckCard>
      )}
    </div>
  );
};

export default MeshPanel;
