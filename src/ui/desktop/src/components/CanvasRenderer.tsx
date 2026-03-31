/**
 * CanvasRenderer - Pretext-powered generative UI components
 *
 * Wraps PretextCanvasRenderer with animated metric cards.
 * Provides character-level canvas rendering with pretext text measurement.
 */

import React, { useRef, useEffect, useState } from 'react'
import PretextCanvasRenderer, {
  type CouncilorMessage,
  type Vote,
} from '../PretextCanvasRenderer'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CanvasRendererProps {
  messages: CouncilorMessage[]
  votes: Vote[]
  consensus: number
  showVotes?: boolean
  width?: number
  className?: string
}

export interface MetricCard {
  id: string
  label: string
  value: string | number
  unit?: string
  trend?: 'up' | 'down' | 'stable'
  color?: string
}

// ─── Animated Metric Canvas ───────────────────────────────────────────────────

function drawMetricCard(
  ctx: CanvasRenderingContext2D,
  metric: MetricCard,
  x: number,
  y: number,
  width: number,
  height: number,
  time: number
) {
  const r = 12

  // Glow pulse
  const pulse = Math.sin(time * 0.003 + x * 0.01) * 0.3 + 0.7

  // Background
  ctx.fillStyle = `rgba(20, 20, 35, ${0.95 * pulse})`
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
  ctx.fill()

  // Border glow
  const borderColor = metric.color || '#a78bfa'
  ctx.strokeStyle = `${borderColor}${Math.round(pulse * 80).toString(16).padStart(2, '0')}`
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Label
  ctx.font = '11px Inter'
  ctx.fillStyle = '#8b949e'
  ctx.fillText(metric.label.toUpperCase(), x + 16, y + 24)

  // Value
  const fontSize = metric.value.toString().length > 6 ? 28 : 36
  ctx.font = `bold ${fontSize}px Inter`
  ctx.fillStyle = borderColor
  ctx.fillText(metric.value.toString(), x + 16, y + 60)

  // Unit
  if (metric.unit) {
    ctx.font = '14px Inter'
    ctx.fillStyle = '#6b7280'
    ctx.fillText(metric.unit, x + 16 + ctx.measureText(metric.value.toString()).width + 4, y + 60)
  }

  // Trend arrow
  if (metric.trend) {
    const arrowX = x + width - 30
    const arrowY = y + 40
    const trendColor = metric.trend === 'up' ? '#22c55e' : metric.trend === 'down' ? '#ef4444' : '#888'

    ctx.font = '16px Inter'
    ctx.fillStyle = trendColor
    ctx.fillText(metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '→', arrowX, arrowY)
  }
}

// ─── Animated Metrics Canvas Component ───────────────────────────────────────

export interface AnimatedMetricsCanvasProps {
  metrics: MetricCard[]
  width?: number
}

export const AnimatedMetricsCanvas: React.FC<AnimatedMetricsCanvasProps> = ({
  metrics,
  width = 700,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const startTimeRef = useRef(Date.now())

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || metrics.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const cardWidth = 160
    const cardHeight = 90
    const gap = 12
    const cols = Math.max(1, Math.floor((width - 24) / (cardWidth + gap)))
    const rows = Math.ceil(metrics.length / cols)
    const totalHeight = rows * (cardHeight + gap) + 24

    canvas.width = width
    canvas.height = totalHeight

    const render = () => {
      const time = Date.now() - startTimeRef.current

      ctx.clearRect(0, 0, width, totalHeight)

      // Background
      ctx.fillStyle = 'rgba(13, 17, 23, 1)'
      ctx.fillRect(0, 0, width, totalHeight)

      metrics.forEach((metric, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        const cx = 12 + col * (cardWidth + gap)
        const cy = 12 + row * (cardHeight + gap)
        drawMetricCard(ctx, metric, cx, cy, cardWidth, cardHeight, time)
      })

      rafRef.current = requestAnimationFrame(render)
    }

    render()
    return () => cancelAnimationFrame(rafRef.current)
  }, [metrics, width])

  return (
    <canvas
      ref={canvasRef}
      className="rounded-xl"
      style={{ width: '100%', maxWidth: width, display: 'block' }}
    />
  )
}

// ─── Main Canvas Renderer Component ───────────────────────────────────────────

const CanvasRenderer: React.FC<CanvasRendererProps> = ({
  messages,
  votes,
  consensus,
  showVotes = true,
  width = 860,
  className,
}) => {
  return (
    <div className={className}>
      <PretextCanvasRenderer
        messages={messages}
        votes={votes}
        consensus={consensus}
        showVotes={showVotes}
        width={width}
      />
    </div>
  )
}

export default CanvasRenderer
