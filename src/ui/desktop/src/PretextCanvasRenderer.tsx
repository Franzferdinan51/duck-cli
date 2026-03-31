// PretextCanvasRenderer.tsx
// AI-powered generative UI - character-level canvas rendering with pretext
// Built for AI Council Chamber WebUI

import { prepareWithSegments, layoutWithLines, type PreparedText } from '@chenglou/pretext'
import { useEffect, useRef, useState, useCallback } from 'react'

// ============================================
// TYPES
// ============================================

export interface CouncilorMessage {
  id: string
  councilor: string
  emoji: string
  color: string
  role: string
  text: string
  timestamp: number
  isStreaming?: boolean
  vote?: {
    choice: string
    confidence: number
    reason: string
  }
}

export interface Vote {
  voter: string
  color: string
  choice: 'PASS' | 'REJECT' | 'ABSTAIN'
  confidence: number
  reason: string
}

export interface LayoutInstruction {
  id: string
  type: 'message' | 'vote_panel' | 'consensus_meter' | 'separator'
  y: number
  height: number
}

// ============================================
// CONSTANTS
// ============================================

const MESSAGE_WIDTH = 600
const VOTE_PANEL_WIDTH = 200
const LINE_HEIGHT = 22
const FONT = '15px Inter, system-ui'
const AVATAR_SIZE = 48
const PADDING = 16
const SPACER = 12
const BORDER_RADIUS = 12

// ============================================
// UTILITIES
// ============================================

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  blur: number
) {
  ctx.save()
  ctx.shadowColor = color
  ctx.shadowBlur = blur
  roundRect(ctx, x, y, w, h, BORDER_RADIUS)
  ctx.fillStyle = color
  ctx.fill()
  ctx.restore()
}

// ============================================
// MESSAGE RENDERER
// ============================================

function renderMessage(
  ctx: CanvasRenderingContext2D,
  msg: CouncilorMessage,
  y: number,
  prepared: PreparedText,
  showVote: boolean
): number {
  const { lines } = layoutWithLines(prepared, MESSAGE_WIDTH - AVATAR_SIZE - PADDING * 2, LINE_HEIGHT)
  const messageHeight = lines.length * LINE_HEIGHT
  const totalHeight = Math.max(messageHeight + AVATAR_SIZE + PADDING * 2, AVATAR_SIZE + PADDING * 2)
  
  // Glow effect for streaming
  if (msg.isStreaming) {
    drawGlow(ctx, 0, y, MESSAGE_WIDTH, totalHeight, msg.color, 20)
  }
  
  // Bubble background
  ctx.fillStyle = 'rgba(20, 20, 30, 0.95)'
  roundRect(ctx, 0, y, MESSAGE_WIDTH, totalHeight, BORDER_RADIUS)
  ctx.fill()
  
  // Border glow
  ctx.strokeStyle = msg.color + '40'
  ctx.lineWidth = 1
  roundRect(ctx, 0, y, MESSAGE_WIDTH, totalHeight, BORDER_RADIUS)
  ctx.stroke()
  
  // Avatar circle
  ctx.fillStyle = msg.color
  ctx.beginPath()
  ctx.arc(AVATAR_SIZE / 2 + 8, y + AVATAR_SIZE / 2 + 8, AVATAR_SIZE / 2, 0, Math.PI * 2)
  ctx.fill()
  
  // Avatar border
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'
  ctx.lineWidth = 2
  ctx.stroke()
  
  // Emoji
  ctx.font = '24px sans-serif'
  ctx.fillText(msg.emoji, 8, y + AVATAR_SIZE / 2 + 14)
  
  // Name
  ctx.font = 'bold 14px Inter'
  ctx.fillStyle = msg.color
  ctx.fillText(msg.councilor, AVATAR_SIZE + 20, y + 28)
  
  // Role
  ctx.font = '11px Inter'
  ctx.fillStyle = '#888'
  ctx.fillText(msg.role, AVATAR_SIZE + 20, y + 44)
  
  // Timestamp
  const time = new Date(msg.timestamp).toLocaleTimeString()
  ctx.font = '10px Inter'
  ctx.fillStyle = '#666'
  ctx.fillText(time, AVATAR_SIZE + 20, y + 58)
  
  // Message text (pretext-measured, exact positions)
  ctx.font = FONT
  ctx.fillStyle = '#fff'
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i].text, AVATAR_SIZE + 20, y + AVATAR_SIZE + 24 + i * LINE_HEIGHT)
  }
  
  // Streaming cursor
  if (msg.isStreaming) {
    const cursorX = AVATAR_SIZE + 20 + (lines.length > 0 ? ctx.measureText(lines[lines.length - 1].text).width : 0)
    const cursorY = y + AVATAR_SIZE + 24 + (lines.length - 1) * LINE_HEIGHT
    ctx.fillStyle = msg.color
    ctx.fillRect(cursorX + 2, cursorY - 14, 2, 18)
  }
  
  // Vote badge
  if (msg.vote && showVote) {
    const badgeX = MESSAGE_WIDTH - 80
    const badgeY = y + 10
    const badgeColor = msg.vote.choice === 'PASS' ? '#22c55e' : msg.vote.choice === 'REJECT' ? '#ef4444' : '#888'
    
    ctx.fillStyle = badgeColor
    roundRect(ctx, badgeX, badgeY, 70, 24, 6)
    ctx.fill()
    
    ctx.font = 'bold 11px Inter'
    ctx.fillStyle = '#fff'
    ctx.fillText(msg.vote.choice, badgeX + 8, badgeY + 16)
  }
  
  return totalHeight
}

// ============================================
// VOTE PANEL RENDERER
// ============================================

function renderVotePanel(
  ctx: CanvasRenderingContext2D,
  votes: Vote[],
  y: number,
  canvasHeight: number
) {
  const x = MESSAGE_WIDTH + 20
  const width = VOTE_PANEL_WIDTH
  const panelHeight = Math.min(canvasHeight - y, 400)
  
  // Panel background
  ctx.fillStyle = 'rgba(15, 15, 25, 0.95)'
  roundRect(ctx, x, y, width, panelHeight, 8)
  ctx.fill()
  
  ctx.strokeStyle = 'rgba(139, 92, 246, 0.3)'
  ctx.lineWidth = 1
  roundRect(ctx, x, y, width, panelHeight, 8)
  ctx.stroke()
  
  // Title
  ctx.font = 'bold 13px Inter'
  ctx.fillStyle = '#fff'
  ctx.fillText('VOTE RESULTS', x + 12, y + 28)
  
  // Vote bars
  let barY = y + 50
  const passCount = votes.filter(v => v.choice === 'PASS').length
  const rejectCount = votes.filter(v => v.choice === 'REJECT').length
  
  votes.forEach((vote) => {
    // Voter name
    ctx.font = '11px Inter'
    ctx.fillStyle = vote.color
    ctx.fillText(vote.voter.substring(0, 12), x + 12, barY + 10)
    
    // Vote bar background
    const barWidth = width - 24
    ctx.fillStyle = '#333'
    roundRect(ctx, x + 12, barY + 14, barWidth, 8, 4)
    ctx.fill()
    
    // Vote bar fill
    const fillWidth = barWidth * (vote.confidence / 100)
    const barColor = vote.choice === 'PASS' ? '#22c55e' : vote.choice === 'REJECT' ? '#ef4444' : '#888'
    ctx.fillStyle = barColor
    roundRect(ctx, x + 12, barY + 14, fillWidth, 8, 4)
    ctx.fill()
    
    // Choice label
    ctx.font = 'bold 10px Inter'
    ctx.fillStyle = barColor
    ctx.fillText(vote.choice, x + 12, barY + 36)
    
    // Confidence
    ctx.font = '10px Inter'
    ctx.fillStyle = '#888'
    ctx.fillText(`${vote.confidence}%`, x + width - 35, barY + 36)
    
    barY += 50
  })
  
  // Summary
  const resultY = y + panelHeight - 60
  ctx.font = 'bold 24px Inter'
  const result = passCount > rejectCount ? 'PASSED' : 'REJECTED'
  const resultColor = passCount > rejectCount ? '#22c55e' : '#ef4444'
  ctx.fillStyle = resultColor
  ctx.fillText(result, x + 12, resultY)
  
  // Count
  ctx.font = '14px Inter'
  ctx.fillStyle = '#888'
  ctx.fillText(`${passCount} YEA / ${rejectCount} NAY`, x + 12, resultY + 25)
}

// ============================================
// CONSENSUS METER RENDERER
// ============================================

function renderConsensusMeter(
  ctx: CanvasRenderingContext2D,
  consensus: number,
  x: number,
  y: number,
  width: number
) {
  const height = 50
  
  // Background
  ctx.fillStyle = 'rgba(15, 15, 25, 0.95)'
  ctx.fillRect(x, y, width, height)
  
  // Label
  ctx.font = 'bold 12px Inter'
  ctx.fillStyle = '#888'
  ctx.fillText('CONSENSUS', x + 16, y + 30)
  
  // Progress bar
  const barX = x + 120
  const barY = y + 15
  const barWidth = width - 200
  const barHeight = 20
  
  // Bar background
  ctx.fillStyle = '#333'
  roundRect(ctx, barX, barY, barWidth, barHeight, 10)
  ctx.fill()
  
  // Gradient fill
  const gradient = ctx.createLinearGradient(barX, 0, barX + barWidth, 0)
  gradient.addColorStop(0, '#ef4444')
  gradient.addColorStop(0.5, '#eab308')
  gradient.addColorStop(1, '#22c55e')
  ctx.fillStyle = gradient
  roundRect(ctx, barX, barY, barWidth * (consensus / 100), barHeight, 10)
  ctx.fill()
  
  // Glow
  ctx.save()
  ctx.shadowColor = consensus > 70 ? '#22c55e' : consensus > 40 ? '#eab308' : '#ef4444'
  ctx.shadowBlur = 15
  roundRect(ctx, barX, barY, barWidth * (consensus / 100), barHeight, 10)
  ctx.fillStyle = 'transparent'
  ctx.fill()
  ctx.restore()
  
  // Percentage
  ctx.font = 'bold 14px Inter'
  ctx.fillStyle = '#fff'
  ctx.fillText(`${Math.round(consensus)}%`, x + width - 70, y + 30)
}

// ============================================
// MAIN COMPONENT
// ============================================

export interface PretextCanvasRendererProps {
  messages: CouncilorMessage[]
  votes: Vote[]
  consensus: number
  showVotes?: boolean
  width?: number
  height?: number
}

export default function PretextCanvasRenderer({
  messages,
  votes,
  consensus,
  showVotes = true,
  width = MESSAGE_WIDTH + VOTE_PANEL_WIDTH + 40,
}: PretextCanvasRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [preparedTexts, setPreparedTexts] = useState<Map<string, PreparedText>>(new Map())
  
  // Pre-measure all messages
  useEffect(() => {
    const prepared = new Map<string, PreparedText>()
    for (const msg of messages) {
      prepared.set(msg.id, prepareWithSegments(msg.text, FONT))
    }
    setPreparedTexts(prepared)
  }, [messages])
  
  // Render to canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Calculate total height
    let totalHeight = 0
    const measurements: Array<{ msg: CouncilorMessage; y: number; height: number; prepared: PreparedText }> = []
    
    for (const msg of messages) {
      const p = preparedTexts.get(msg.id)
      if (!p) continue
      const { lines } = layoutWithLines(p, MESSAGE_WIDTH - AVATAR_SIZE - PADDING * 2, LINE_HEIGHT)
      const messageHeight = lines.length * LINE_HEIGHT
      const h = Math.max(messageHeight + AVATAR_SIZE + PADDING * 2, AVATAR_SIZE + PADDING * 2)
      measurements.push({ msg, y: totalHeight, height: h, prepared: p })
      totalHeight += h + SPACER
    }
    
    // Add space for consensus meter
    totalHeight += 70
    
    canvas.width = width
    canvas.height = totalHeight
    
    // Clear
    ctx.clearRect(0, 0, width, totalHeight)
    
    // Background
    ctx.fillStyle = 'rgba(10, 10, 15, 1)'
    ctx.fillRect(0, 0, width, totalHeight)
    
    // Render messages
    for (const { msg, y, height, prepared } of measurements) {
      renderMessage(ctx, msg, y, prepared, showVotes)
    }
    
    // Render vote panel
    if (votes.length > 0 && showVotes) {
      renderVotePanel(ctx, votes, 0, totalHeight)
    }
    
    // Render consensus meter
    renderConsensusMeter(ctx, consensus, 0, totalHeight - 60, width)
    
  }, [messages, votes, consensus, showVotes, preparedTexts, width])
  
  return (
    <canvas
      ref={canvasRef}
      className="pretext-canvas"
      style={{
        width: '100%',
        maxWidth: width,
        borderRadius: '12px',
        display: 'block'
      }}
    />
  )
}
