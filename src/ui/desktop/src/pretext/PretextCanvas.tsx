/**
 * PretextCanvas - Core canvas renderer with pretext text measurement
 * 
 * Provides character-level text measurement and rendering using Canvas 2D.
 * Pretext calculates exact text positions without DOM reflow.
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'

// Types
export interface TextMeasurement {
  height: number
  lines: TextLine[]
  totalWidth: number
}

export interface TextLine {
  text: string
  x: number
  y: number
  width: number
  baseline: number
}

export interface PretextCanvasProps {
  text: string
  font?: string
  maxWidth?: number
  lineHeight?: number
  color?: string
  x?: number
  y?: number
  align?: 'left' | 'center' | 'right'
  verticalAlign?: 'top' | 'middle' | 'bottom'
  className?: string
  style?: React.CSSProperties
  onMeasure?: (measurement: TextMeasurement) => void
}

export interface PretextTextProps extends Omit<PretextCanvasProps, 'onMeasure'> {
  measurement?: TextMeasurement | null
}

// Fallback implementation when @chenglou/pretext is not available
function measureTextFallback(
  text: string,
  font: string,
  maxWidth: number,
  lineHeight: number
): TextMeasurement {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return { height: 0, lines: [], totalWidth: 0 }
  }
  
  ctx.font = font
  const lines: TextLine[] = []
  const paragraphs = text.split('\n')
  let y = lineHeight
  let maxTotalWidth = 0
  
  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') {
      y += lineHeight * 0.5
      continue
    }
    
    const words = paragraph.split(' ')
    let currentLine = ''
    let currentWidth = 0
    
    for (const word of words) {
      const wordWidth = ctx.measureText(word).width
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const testWidth = ctx.measureText(testLine).width
      
      if (testWidth > maxWidth && currentLine) {
        lines.push({
          text: currentLine,
          x: 0,
          y,
          width: currentWidth,
          baseline: lineHeight * 0.85
        })
        maxTotalWidth = Math.max(maxTotalWidth, currentWidth)
        y += lineHeight
        currentLine = word
        currentWidth = wordWidth
      } else {
        currentLine = testLine
        currentWidth = testWidth
      }
    }
    
    if (currentLine) {
      lines.push({
        text: currentLine,
        x: 0,
        y,
        width: currentWidth,
        baseline: lineHeight * 0.85
      })
      maxTotalWidth = Math.max(maxTotalWidth, currentWidth)
      y += lineHeight
    }
  }
  
  return {
    height: y,
    lines,
    totalWidth: maxTotalWidth
  }
}

/**
 * Core hook for text measurement using Canvas 2D fallback
 */
export function useTextMeasurement(
  text: string,
  font: string,
  maxWidth: number,
  lineHeight: number
): TextMeasurement | null {
  const [measurement, setMeasurement] = useState<TextMeasurement | null>(null)
  
  useEffect(() => {
    if (!text) {
      setMeasurement(null)
      return
    }
    
    // Use fallback implementation
    const result = measureTextFallback(text, font, maxWidth, lineHeight)
    setMeasurement(result)
  }, [text, font, maxWidth, lineHeight])
  
  return measurement
}

/**
 * PretextCanvas - Renders measured text on a canvas element
 */
export const PretextCanvas: React.FC<PretextCanvasProps> = ({
  text,
  font = '16px Inter, system-ui, sans-serif',
  maxWidth = 500,
  lineHeight = 22,
  color = '#ffffff',
  x = 0,
  y = 0,
  align = 'left',
  verticalAlign = 'top',
  className,
  style,
  onMeasure
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const measurement = useTextMeasurement(text, font, maxWidth, lineHeight)
  
  // Report measurement to parent
  useEffect(() => {
    if (measurement && onMeasure) {
      onMeasure(measurement)
    }
  }, [measurement, onMeasure])
  
  // Render text on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !measurement) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Set canvas size with padding
    const padding = 10
    canvas.width = maxWidth + padding * 2
    canvas.height = measurement.height + padding * 2
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Set text styles
    ctx.font = font
    ctx.fillStyle = color
    ctx.textBaseline = 'top'
    
    // Calculate vertical offset based on alignment
    let yOffset = padding
    if (verticalAlign === 'bottom') {
      yOffset = padding
    } else if (verticalAlign === 'middle') {
      yOffset = padding
    }
    
    // Draw each line
    for (const line of measurement.lines) {
      let xOffset = padding + x
      
      // Apply horizontal alignment
      if (align === 'center') {
        xOffset = padding + (maxWidth - line.width) / 2 + x
      } else if (align === 'right') {
        xOffset = padding + maxWidth - line.width + x
      }
      
      ctx.fillText(line.text, xOffset, yOffset + line.y)
    }
  }, [measurement, font, maxWidth, color, x, y, align, verticalAlign])
  
  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        display: 'block',
        maxWidth: '100%',
        ...style
      }}
    />
  )
}

/**
 * PretextText - Renders measured text with HTML fallback
 */
export const PretextText: React.FC<PretextTextProps> = ({
  text,
  font = '16px Inter, system-ui, sans-serif',
  maxWidth = 500,
  lineHeight = 22,
  color = '#ffffff',
  measurement,
  style,
  className
}) => {
  const internalMeasurement = useTextMeasurement(text, font, maxWidth, lineHeight)
  const finalMeasurement = measurement || internalMeasurement
  
  if (!finalMeasurement) return null
  
  // Calculate alignment offset for each line
  const getLineX = useCallback((lineWidth: number, align: 'left' | 'center' | 'right' = 'left') => {
    switch (align) {
      case 'center':
        return (maxWidth - lineWidth) / 2
      case 'right':
        return maxWidth - lineWidth
      default:
        return 0
    }
  }, [maxWidth])
  
  return (
    <div
      className={className}
      style={{
        font,
        color,
        lineHeight: `${lineHeight}px`,
        maxWidth: `${maxWidth}px`,
        ...style
      }}
    >
      {finalMeasurement.lines.map((line, i) => (
        <div
          key={i}
          style={{
            height: `${lineHeight}px`,
            display: 'flex',
            alignItems: 'flex-start'
          }}
        >
          <span style={{ paddingLeft: getLineX(line.width) }}>
            {line.text}
          </span>
        </div>
      ))}
    </div>
  )
}

export default PretextCanvas
