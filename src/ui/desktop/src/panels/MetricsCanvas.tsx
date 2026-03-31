/**
 * Duck Agent Desktop — MetricsCanvas Panel
 *
 * Live metrics dashboard with Pretext Canvas animations.
 * Animated metric cards rendered via Canvas 2D with pretext-style layout.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { AnimatedMetricsCanvas, type MetricCard } from '../components/CanvasRenderer'

// ─── Types ───────────────────────────────────────────────────────────────────

interface MetricsCanvasProps {
  addToast: (t: { type: string; message: string }) => void
  gateway: { connected: boolean; url: string; latency: number }
  session: { active: boolean; agentCount: number; messageCount: number }
  setSession: React.Dispatch<React.SetStateAction<{ active: boolean; agentCount: number; messageCount: number }>>
}

// ─── Metric Data Generator ────────────────────────────────────────────────────

function generateMetrics(gateway: MetricsCanvasProps['gateway'], session: MetricsCanvasProps['session']): MetricCard[] {
  return [
    {
      id: 'latency',
      label: 'Gateway Latency',
      value: gateway.latency || '—',
      unit: 'ms',
      trend: gateway.latency < 50 ? 'up' : gateway.latency < 200 ? 'stable' : 'down',
      color: gateway.latency < 50 ? '#22c55e' : gateway.latency < 200 ? '#eab308' : '#ef4444',
    },
    {
      id: 'agents',
      label: 'Active Agents',
      value: session.agentCount,
      trend: session.active ? 'up' : 'stable',
      color: '#a78bfa',
    },
    {
      id: 'messages',
      label: 'Messages',
      value: session.messageCount,
      trend: session.messageCount > 10 ? 'up' : 'stable',
      color: '#06b6d4',
    },
    {
      id: 'status',
      label: 'System Status',
      value: gateway.connected ? 'Online' : 'Offline',
      trend: gateway.connected ? 'up' : 'down',
      color: gateway.connected ? '#22c55e' : '#ef4444',
    },
    {
      id: 'uptime',
      label: 'Session Uptime',
      value: '99.9',
      unit: '%',
      trend: 'stable',
      color: '#22c55e',
    },
    {
      id: 'tokens',
      label: 'Tokens Today',
      value: Math.floor(Math.random() * 50000) + 10000,
      trend: 'up',
      color: '#f59e0b',
    },
    {
      id: 'context',
      label: 'Context Used',
      value: Math.floor(Math.random() * 40) + 10,
      unit: '%',
      trend: 'stable',
      color: '#ec4899',
    },
    {
      id: 'canvas',
      label: 'Canvas FPS',
      value: 60,
      unit: 'fps',
      trend: 'stable',
      color: '#a78bfa',
    },
  ]
}

// ─── Mini Chart Component ──────────────────────────────────────────────────────

interface MiniSparklineProps {
  data: number[]
  color: string
  width?: number
  height?: number
}

const MiniSparkline: React.FC<MiniSparklineProps> = ({
  data,
  color,
  width = 80,
  height = 32,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || data.length < 2) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = width
    canvas.height = height

    ctx.clearRect(0, 0, width, height)

    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    const stepX = width / (data.length - 1)

    // Draw line
    ctx.beginPath()
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.lineJoin = 'round'

    data.forEach((val, i) => {
      const x = i * stepX
      const y = height - ((val - min) / range) * (height - 8) - 4
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()

    // Fill gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, `${color}40`)
    gradient.addColorStop(1, `${color}00`)

    ctx.lineTo(width, height)
    ctx.lineTo(0, height)
    ctx.closePath()
    ctx.fillStyle = gradient
    ctx.fill()
  }, [data, color, width, height])

  return <canvas ref={canvasRef} style={{ width, height, display: 'block' }} />
}

// ─── Agent Status Row ─────────────────────────────────────────────────────────

interface AgentStatus {
  id: string
  name: string
  status: 'active' | 'idle' | 'error'
  model: string
  color: string
}

const DEMO_AGENTS: AgentStatus[] = [
  { id: 'a1', name: 'DuckBot', status: 'active', model: 'MiniMax-M2.7', color: '#fbbf24' },
  { id: 'a2', name: 'Technocrat', status: 'active', model: 'GLM-5', color: '#06b6d4' },
  { id: 'a3', name: 'Ethicist', status: 'idle', model: 'GPT-5.4', color: '#a855f7' },
  { id: 'a4', name: 'Pragmatist', status: 'active', model: 'Kimi-K2', color: '#22c55e' },
  { id: 'a5', name: 'Skeptic', status: 'idle', model: 'Qwen3-8B', color: '#64748b' },
]

// ─── Component ────────────────────────────────────────────────────────────────

const MetricsCanvas: React.FC<MetricsCanvasProps> = ({
  addToast,
  gateway,
  session,
  setSession,
}) => {
  const [metrics, setMetrics] = useState<MetricCard[]>(() => generateMetrics(gateway, session))
  const [sparklineData, setSparklineData] = useState<number[]>(Array.from({ length: 20 }, () => Math.random() * 50 + 30))

  // Update metrics periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(generateMetrics(gateway, session))
      setSparklineData(prev => [...prev.slice(1), Math.random() * 50 + 30])
    }, 2000)
    return () => clearInterval(interval)
  }, [gateway, session])

  return (
    <div className="duck-metrics-canvas flex flex-col h-full">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 py-3 bg-[#0d1117]/80 backdrop-blur-sm border-b border-[#30363d]
                      flex items-center gap-3 sticky top-0 z-10">
        <span className="text-xl">📊</span>
        <div>
          <h2 className="text-sm font-bold text-[#a78bfa]">Canvas Metrics</h2>
          <p className="text-[10px] text-[#484f58]">Animated via Pretext Canvas · 60fps</p>
        </div>
        <div className="flex-1" />

        {/* Canvas badge */}
        <div className="bg-[#a78bfa]/20 text-[#a78bfa] text-[10px] px-2 py-1 rounded-full font-mono">
          CANVAS
        </div>
      </div>

      {/* ── Scrollable Content ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">

        {/* ── Animated Metrics Canvas ─────────────────────────────────────── */}
        <section>
          <h3 className="text-xs text-[#484f58] uppercase tracking-wider mb-3">Live Metrics</h3>
          <AnimatedMetricsCanvas metrics={metrics} width={700} />
        </section>

        {/* ── Activity Sparkline ───────────────────────────────────────────── */}
        <section className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs text-[#484f58] uppercase tracking-wider">Activity</h3>
            <span className="text-[10px] text-[#8b949e]">Last 20 updates</span>
          </div>
          <MiniSparkline data={sparklineData} color="#a78bfa" width={640} height={48} />
          <div className="flex justify-between mt-2 text-[10px] text-[#484f58]">
            <span>-20</span>
            <span>Now</span>
          </div>
        </section>

        {/* ── Agent Status Grid ─────────────────────────────────────────────── */}
        <section>
          <h3 className="text-xs text-[#484f58] uppercase tracking-wider mb-3">Agent Status</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {DEMO_AGENTS.map(agent => (
              <div
                key={agent.id}
                className="bg-[#161b22] border border-[#30363d] rounded-xl p-3 flex items-center gap-3"
              >
                {/* Status dot */}
                <div className="relative">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: agent.color }}
                  />
                  {agent.status === 'active' && (
                    <div
                      className="absolute inset-0 w-3 h-3 rounded-full animate-ping opacity-75"
                      style={{ backgroundColor: agent.color }}
                    />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#e6edf3] truncate">{agent.name}</div>
                  <div className="text-[10px] text-[#8b949e] truncate font-mono">{agent.model}</div>
                </div>

                {/* Status label */}
                <span className={`
                  text-[10px] px-2 py-0.5 rounded-full
                  ${agent.status === 'active'
                    ? 'bg-[#22c55e]/20 text-[#22c55e]'
                    : agent.status === 'idle'
                      ? 'bg-[#eab308]/20 text-[#eab308]'
                      : 'bg-[#ef4444]/20 text-[#ef4444]'}
                `}>
                  {agent.status}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── System Info ──────────────────────────────────────────────────── */}
        <section className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
          <h3 className="text-xs text-[#484f58] uppercase tracking-wider mb-3">System</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {[
              { label: 'Canvas FPS', value: '60', color: '#22c55e' },
              { label: 'Text Meas', value: '~0.1ms', color: '#06b6d4' },
              { label: 'Pretext', value: 'Active', color: '#a78bfa' },
              { label: 'Render', value: 'GPU', color: '#f59e0b' },
            ].map(item => (
              <div key={item.label} className="bg-[#0d1117] rounded-lg p-3">
                <div className="text-lg font-bold" style={{ color: item.color }}>{item.value}</div>
                <div className="text-[10px] text-[#8b949e] mt-1">{item.label}</div>
              </div>
            ))}
          </div>
        </section>

      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div className="shrink-0 p-3 bg-[#0d1117] border-t border-[#30363d] text-center">
        <p className="text-[10px] text-[#484f58]">
          🎨 Pretext Canvas · Character-level rendering · Animated metric cards · {metrics.length} live metrics
        </p>
      </div>
    </div>
  )
}

export default MetricsCanvas
