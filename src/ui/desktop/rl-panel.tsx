/**
 * Duck Agent Desktop — OpenClaw-RL Status Panel
 *
 * Real-time reinforcement learning task status, reward signals,
 * episode tracking, and RL agent health.
 */

import React, { useState, useEffect } from 'react';
import { DuckCard } from './components/duck-card';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RLEpisode {
  id: string;
  task: string;
  reward: number;
  duration: number; // ms
  status: 'completed' | 'failed' | 'running' | 'queued';
  timestamp: Date;
  improvement?: number; // % vs previous
}

interface RLMetric {
  label: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  delta?: number;
}

interface RlPanelProps {
  addToast: (t: { type: string; message: string }) => void;
  gateway: { connected: boolean; url: string; latency: number };
  session: { active: boolean; agentCount: number; messageCount: number };
  setSession: React.Dispatch<React.SetStateAction<{ active: boolean; agentCount: number; messageCount: number }>>;
}

// ─── Component ───────────────────────────────────────────────────────────────

const RlPanel: React.FC<RlPanelProps> = ({ addToast, gateway }) => {
  const [episodes, setEpisodes] = useState<RLEpisode[]>([
    { id: 'ep-1', task: 'Self-Improvement', reward: 94.2, duration: 12400, status: 'completed', timestamp: new Date(Date.now() - 3600000), improvement: 3.1 },
    { id: 'ep-2', task: 'Kanban Cleanup', reward: 87.5, duration: 8900, status: 'completed', timestamp: new Date(Date.now() - 7200000), improvement: -1.2 },
    { id: 'ep-3', task: 'Code Refactor', reward: 91.8, duration: 15200, status: 'completed', timestamp: new Date(Date.now() - 10800000), improvement: 5.4 },
    { id: 'ep-4', task: 'Memory Consolidation', reward: 78.3, duration: 6800, status: 'running', timestamp: new Date() },
    { id: 'ep-5', task: 'DEFCON Analysis', reward: 0, duration: 0, status: 'queued', timestamp: new Date() },
  ]);

  const [metrics] = useState<RLMetric[]>([
    { label: 'Avg Reward', value: 88.4, unit: '%', trend: 'up', delta: 2.3 },
    { label: 'Success Rate', value: 92.0, unit: '%', trend: 'up', delta: 1.1 },
    { label: 'Episodes', value: 1247, unit: 'total', trend: 'stable' },
    { label: 'Learning Rate', value: 0.001, unit: 'η', trend: 'stable' },
  ]);

  const [selectedEpisode, setSelectedEpisode] = useState<string | null>(null);

  const trendIcon = (trend: RLMetric['trend']) => {
    switch (trend) {
      case 'up':   return '↑';
      case 'down': return '↓';
      default:     return '→';
    }
  };

  const trendColor = (trend: RLMetric['trend'], delta?: number) => {
    if (trend === 'stable') return 'text-slate-400';
    if (trend === 'up') return 'text-emerald-400';
    return 'text-red-400';
  };

  const statusMeta: Record<RLEpisode['status'], { color: string; bg: string; label: string }> = {
    completed: { color: 'text-emerald-400', bg: 'bg-emerald-400/10', label: '✓ Completed' },
    failed: { color: 'text-red-400', bg: 'bg-red-400/10', label: '✗ Failed' },
    running: { color: 'text-amber-400', bg: 'bg-amber-400/10', label: '⟳ Running' },
    queued: { color: 'text-slate-400', bg: 'bg-slate-400/10', label: '○ Queued' },
  };

  return (
    <div className="duck-rl p-4 space-y-4">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1c2333] border border-[#30363d] flex items-center justify-center text-2xl">
            🧠
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#e6edf3]" style={{ fontFamily: 'var(--font-display)' }}>
              OpenClaw-RL
            </h2>
            <p className="text-xs text-[#8b949e]">
              Reinforcement Learning status · Gateway {gateway.connected ? '🟢' : '🔴'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#484f58]">
            {gateway.latency > 0 ? `${gateway.latency}ms` : 'Local'}
          </span>
          <div className={`w-2 h-2 rounded-full ${gateway.connected ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`} />
        </div>
      </div>

      {/* ── Metrics Grid ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {metrics.map(metric => (
          <DuckCard key={metric.label} className="text-center">
            <div className={`text-xl font-bold font-mono ${
              metric.label === 'Avg Reward' ? 'text-[#fbbf24]' :
              metric.label === 'Success Rate' ? 'text-emerald-400' :
              'text-[#e6edf3]'
            }`}>
              {metric.value}
              <span className="text-xs text-[#8b949e] ml-1">{metric.unit}</span>
            </div>
            <div className="flex items-center justify-center gap-1 mt-1">
              <span className={`text-xs ${trendColor(metric.trend, metric.delta)}`}>
                {trendIcon(metric.trend)}
              </span>
              <span className="text-[10px] text-[#484f58]">{metric.label}</span>
            </div>
            {metric.delta !== undefined && (
              <div className={`text-[10px] font-mono mt-0.5 ${trendColor(metric.trend, metric.delta)}`}>
                {metric.trend === 'up' ? '+' : metric.trend === 'down' ? '' : ''}{metric.delta}
              </div>
            )}
          </DuckCard>
        ))}
      </div>

      {/* ── Reward Curve (ASCII-inspired bars) ─────────────────────────── */}
      <DuckCard>
        <h3 className="text-sm font-semibold text-[#e6edf3] mb-3">Reward Trend (Last 20 Episodes)</h3>
        <div className="flex items-end gap-1 h-16">
          {[72, 78, 75, 82, 79, 85, 88, 83, 90, 87, 92, 89, 94, 91, 88, 93, 95, 92, 96, 94].map((val, i) => {
            const isSelected = episodes[i]?.id === selectedEpisode;
            return (
              <div
                key={i}
                className={`
                  flex-1 rounded-t transition-all duration-200 cursor-pointer
                  ${isSelected ? 'bg-[#fbbf24]' : 'bg-[#1c2333] hover:bg-[#fbbf24]/50'}
                `}
                style={{ height: `${val}%` }}
                onClick={() => {
                  const ep = episodes[i];
                  if (ep) setSelectedEpisode(selectedEpisode === ep.id ? null : ep.id);
                }}
                title={`Episode ${i + 1}: ${val}%`}
              />
            );
          })}
        </div>
        <div className="flex justify-between mt-2 text-[9px] text-[#484f58] font-mono">
          <span>Ep 1</span>
          <span>Current: 94%</span>
          <span>Ep 20</span>
        </div>
      </DuckCard>

      {/* ── Episode List ───────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-[#e6edf3] mb-2">Recent Episodes</h3>
        <div className="space-y-2">
          {episodes.map(ep => {
            const meta = statusMeta[ep.status];
            const isSelected = selectedEpisode === ep.id;

            return (
              <div
                key={ep.id}
                className={`
                  bg-[#161b22] border border-[#30363d] rounded-xl px-4 py-3
                  cursor-pointer transition-all duration-150
                  hover:border-[#fbbf24]/30
                  ${isSelected ? 'border-[#fbbf24]/50' : ''}
                `}
                onClick={() => setSelectedEpisode(isSelected ? null : ep.id)}
              >
                <div className="flex items-center gap-3">
                  {/* Status */}
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    ep.status === 'completed' ? 'bg-emerald-400' :
                    ep.status === 'failed' ? 'bg-red-400' :
                    ep.status === 'running' ? 'bg-amber-400 animate-pulse' :
                    'bg-slate-600'
                  }`} />

                  {/* Task */}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-[#e6edf3] truncate">{ep.task}</span>
                  </div>

                  {/* Reward */}
                  {ep.status !== 'queued' && (
                    <div className="text-right">
                      <div className={`text-sm font-mono font-bold ${
                        ep.reward >= 90 ? 'text-emerald-400' :
                        ep.reward >= 70 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {ep.reward > 0 ? `${ep.reward}%` : '—'}
                      </div>
                      {ep.improvement !== undefined && (
                        <div className={`text-[10px] font-mono ${
                          ep.improvement >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {ep.improvement >= 0 ? '+' : ''}{ep.improvement}%
                        </div>
                      )}
                    </div>
                  )}

                  {/* Duration */}
                  {ep.status !== 'queued' && (
                    <div className="text-xs font-mono text-[#484f58] w-16 text-right">
                      {ep.duration > 0 ? `${(ep.duration / 1000).toFixed(1)}s` : '—'}
                    </div>
                  )}

                  {/* Status badge */}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${meta.bg} ${meta.color} shrink-0`}>
                    {meta.label}
                  </span>
                </div>

                {/* Expanded */}
                {isSelected && (
                  <div className="mt-3 pt-3 border-t border-[#30363d] grid grid-cols-3 gap-2 text-xs animate-panel-enter">
                    <div>
                      <span className="text-[#484f58]">Episode ID</span>
                      <div className="font-mono text-[#e6edf3]">{ep.id}</div>
                    </div>
                    <div>
                      <span className="text-[#484f58]">Timestamp</span>
                      <div className="font-mono text-[#e6edf3]">{ep.timestamp.toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="text-[#484f58]">Status</span>
                      <div className={meta.color}>{ep.status}</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default RlPanel;
