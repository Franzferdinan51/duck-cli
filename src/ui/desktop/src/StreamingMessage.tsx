// StreamingMessage.tsx
// Pretext-powered streaming message with pre-measured height

import { useEffect, useRef, useState, useCallback } from 'react'
import { prepare, layout, prepareWithSegments, layoutWithLines } from '@chenglou/pretext'

interface StreamingMessageProps {
  content: string
  font?: string
  maxWidth?: number
  lineHeight?: number
  color?: string
  onHeightChange?: (height: number) => void
}

export default function StreamingMessage({
  content,
  font = '15px Inter, system-ui',
  maxWidth = 500,
  lineHeight = 22,
  color = '#8b5cf6',
  onHeightChange,
}: StreamingMessageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [height, setHeight] = useState(100)
  const [lines, setLines] = useState<Array<{ text: string; y: number }>>([])

  // Pre-measure BEFORE content appears
  useEffect(() => {
    if (!content) return

    const prepared = prepare(content, font)
    const { height: h } = layout(prepared, maxWidth, lineHeight)
    const measuredHeight = Math.ceil(h) + 40 // +40 for avatar padding

    setHeight(measuredHeight)
    onHeightChange?.(measuredHeight)

    // Also get lines for rendering
    const preparedSeg = prepareWithSegments(content, font)
    const { lines: l } = layoutWithLines(preparedSeg, maxWidth, lineHeight)
    setLines(l)
  }, [content, font, maxWidth, lineHeight])

  // Render to canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !content) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = maxWidth
    canvas.height = height

    ctx.clearRect(0, 0, maxWidth, height)

    // Bubble background
    ctx.fillStyle = 'rgba(20, 20, 30, 0.95)'
    roundRect(ctx, 0, 0, maxWidth, height, 12)
    ctx.fill()

    // Streaming glow
    ctx.save()
    ctx.shadowColor = color
    ctx.shadowBlur = 15
    ctx.strokeStyle = color + '60'
    ctx.lineWidth = 1
    roundRect(ctx, 0, 0, maxWidth, height, 12)
    ctx.stroke()
    ctx.restore()

    // Text
    ctx.font = font
    ctx.fillStyle = '#fff'
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i].text, 16, 30 + i * lineHeight)
    }

    // Streaming cursor
    if (lines.length > 0) {
      const lastLine = lines[lines.length - 1]
      const lastLineWidth = ctx.measureText(lastLine.text).width

      // Blinking cursor
      const blink = Math.floor(Date.now() / 500) % 2 === 0
      if (blink) {
        ctx.fillStyle = color
        ctx.fillRect(16 + lastLineWidth + 2, 20 + (lines.length - 1) * lineHeight, 2, 18)
      }
    }
  }, [content, height, lines, font, maxWidth, color])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        maxWidth,
        minHeight: height,
        borderRadius: 12,
        display: 'block',
      }}
    />
  )
}

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
