/**
 * CouncilVoteDisplay - Pretext Canvas AI Council voting visualization
 * 
 * Shows council member votes in real-time
 * Uses @chenglou/pretext for precise text measurement
 * Canvas rendering with animated vote indicators
 */

import React, { useRef, useEffect, useCallback, useState } from 'react'

export interface CouncilMember {
  id: string
  name: string
  role: string
  vote?: 'approve' | 'reject' | 'abstain' | 'pending'
  reasoning?: string
  color?: string
}

export interface CouncilVoteDisplayProps {
  members: CouncilMember[]
  topic: string
  consensusThreshold?: number
  width?: number
  height?: number
  className?: string
  style?: React.CSSProperties
}

export const CouncilVoteDisplay: React.FC<CouncilVoteDisplayProps> = ({
  members,
  topic,
  consensusThreshold = 0.6,
  width = 450,
  height = 320,
  className = '',
  style
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const [votes, setVotes] = useState<Map<string, number>>(new Map())

  // Animate vote indicators
  useEffect(() => {
    const interval = setInterval(() => {
      const newVotes = new Map<string, number>()
      members.forEach(m => {
        if (m.vote === 'pending') {
          newVotes.set(m.id, Math.random() * 0.3) // Pulsing effect for pending
        } else {
          newVotes.set(m.id, 1)
        }
      })
      setVotes(newVotes)
    }, 100)
    return () => clearInterval(interval)
  }, [members])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let phase = 0

    const calculateConsensus = () => {
      const votes_array = members.map(m => m.vote)
      const approve = votes_array.filter(v => v === 'approve').length
      const reject = votes_array.filter(v => v === 'reject').length
      return approve / (approve + reject || 1)
    }

    const animate = () => {
      phase += 0.05

      // Clear
      ctx.fillStyle = '#0a0a0f'
      ctx.fillRect(0, 0, width, height)

      // Background glow
      const consensus = calculateConsensus()
      const glowColor = consensus >= consensusThreshold ? 
        `rgba(16, 185, 129, ${0.1 + Math.sin(phase) * 0.05})` :
        consensus >= 0.4 ?
        `rgba(255, 193, 7, ${0.1 + Math.sin(phase) * 0.05})` :
        `rgba(239, 68, 68, ${0.1 + Math.sin(phase) * 0.05})`
      
      const glowGradient = ctx.createRadialGradient(
        width / 2, height / 2, 0,
        width / 2, height / 2, width / 2
      )
      glowGradient.addColorStop(0, glowColor)
      glowGradient.addColorStop(1, 'transparent')
      ctx.fillStyle = glowGradient
      ctx.fillRect(0, 0, width, height)

      // Draw header
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 14px Inter, system-ui'
      ctx.textAlign = 'center'
      ctx.fillText('🏛️ AI COUNCIL', width / 2, 30)

      ctx.font = '12px Inter, system-ui'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
      const truncatedTopic = topic.length > 40 ? topic.slice(0, 40) + '...' : topic
      ctx.fillText(truncatedTopic, width / 2, 50)

      // Draw consensus meter
      const meterX = width / 2 - 100
      const meterY = 65
      const meterWidth = 200
      const meterHeight = 8

      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
      ctx.fillRect(meterX, meterY, meterWidth, meterHeight)

      const fillWidth = consensus * meterWidth
      const meterGradient = ctx.createLinearGradient(meterX, 0, meterX + meterWidth, 0)
      meterGradient.addColorStop(0, '#ef4444')
      meterGradient.addColorStop(0.5, '#ffc107')
      meterGradient.addColorStop(1, '#10b981')
      ctx.fillStyle = meterGradient
      ctx.fillRect(meterX, meterY, fillWidth, meterHeight)

      ctx.font = '10px Inter, system-ui'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.textAlign = 'left'
      ctx.fillText('Reject', meterX, meterY + 20)
      ctx.textAlign = 'right'
      ctx.fillText('Approve', meterX + meterWidth, meterY + 20)
      ctx.textAlign = 'center'
      ctx.fillStyle = '#ffffff'
      ctx.fillText(`${(consensus * 100).toFixed(0)}% Consensus`, width / 2, meterY + 20)

      // Draw council members
      const startY = 100
      const rowHeight = 45
      const cols = 3
      const cellWidth = width / cols

      members.forEach((member, idx) => {
        const col = idx % cols
        const row = Math.floor(idx / cols)
        const x = col * cellWidth + cellWidth / 2
        const y = startY + row * rowHeight

        const voteProgress = votes.get(member.id) || 0
        const pulseScale = 1 + voteProgress * 0.1 * Math.sin(phase + idx)

        // Member card background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)'
        roundRect(ctx, x - 65, y, 130, 38, 8)
        ctx.fill()

        // Vote indicator
        let indicatorColor = 'rgba(255, 255, 255, 0.2)'
        let indicatorEmoji = '⏳'
        
        if (member.vote === 'approve') {
          indicatorColor = 'rgba(16, 185, 129, 0.8)'
          indicatorEmoji = '✅'
        } else if (member.vote === 'reject') {
          indicatorColor = 'rgba(239, 68, 68, 0.8)'
          indicatorEmoji = '❌'
        } else if (member.vote === 'abstain') {
          indicatorColor = 'rgba(255, 193, 7, 0.8)'
          indicatorEmoji = '🚫'
        }

        // Draw vote circle
        ctx.beginPath()
        ctx.arc(x - 45, y + 19, 12 * pulseScale, 0, Math.PI * 2)
        ctx.fillStyle = indicatorColor
        ctx.fill()
        ctx.font = '12px system-ui'
        ctx.textAlign = 'center'
        ctx.fillText(indicatorEmoji, x - 45, y + 23)

        // Member name
        ctx.font = '11px Inter, system-ui'
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'left'
        ctx.fillText(member.name.slice(0, 12), x - 25, y + 16)

        // Role
        ctx.font = '9px Inter, system-ui'
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
        ctx.fillText(member.role.slice(0, 15), x - 25, y + 28)
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    // Helper for rounded rectangles
    const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
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

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [width, height, members, topic, consensusThreshold, votes])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      style={{
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        ...style
      }}
    />
  )
}

export default CouncilVoteDisplay
