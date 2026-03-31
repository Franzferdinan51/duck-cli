/**
 * GradientMesh - Animated gradient mesh effect
 */

import React, { useEffect, useRef, useMemo } from 'react'

export interface GradientMeshProps {
  colors?: string[]
  speed?: number
  blendMode?: GlobalCompositeOperation
  opacity?: number
  width?: number | string
  height?: number | string
  className?: string
  style?: React.CSSProperties
}

/**
 * GradientMesh component
 */
export const GradientMesh: React.FC<GradientMeshProps> = ({
  colors = ['#8b5cf6', '#06b6d4', '#ec4899', '#f59e0b'],
  speed = 0.5,
  blendMode = 'screen',
  opacity = 0.6,
  width = '100%',
  height = 200,
  className,
  style
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timeRef = useRef(0)
  const animationRef = useRef<number | null>(null)
  
  // Memoize gradient positions
  const gradients = useMemo(() => [
    { x: 0.2, y: 0.3, vx: 0.001, vy: 0.001 },
    { x: 0.7, y: 0.6, vx: -0.001, vy: 0.0015 },
    { x: 0.5, y: 0.8, vx: 0.0012, vy: -0.001 },
    { x: 0.3, y: 0.5, vx: -0.001, vy: -0.0012 }
  ], [])
  
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    let width = canvas.width
    let height = canvas.height
    
    const animate = () => {
      ctx.clearRect(0, 0, width, height)
      
      // Update time
      timeRef.current += speed * 0.01
      
      // Draw each gradient blob
      gradients.forEach((grad, i) => {
        // Update position
        grad.x += grad.vx
        grad.y += grad.vy
        
        // Bounce off edges
        if (grad.x < 0 || grad.x > 1) grad.vx *= -1
        if (grad.y < 0 || grad.y > 1) grad.vy *= -1
        
        // Calculate animated position
        const x = grad.x + Math.sin(timeRef.current * (i + 1)) * 0.1
        const y = grad.y + Math.cos(timeRef.current * (i + 1)) * 0.1
        
        // Create radial gradient
        const centerX = x * width
        const centerY = y * height
        const radius = Math.min(width, height) * 0.4
        
        const gradient = ctx.createRadialGradient(
          centerX, centerY, 0,
          centerX, centerY, radius
        )
        
        gradient.addColorStop(0, colors[i % colors.length])
        gradient.addColorStop(1, 'transparent')
        
        ctx.globalCompositeOperation = blendMode
        ctx.globalAlpha = opacity * 0.5
        
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, width, height)
      })
      
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
      
      animationRef.current = requestAnimationFrame(animate)
    }
    
    animate()
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [colors, speed, blendMode, opacity, gradients])
  
  return (
    <canvas
      ref={canvasRef}
      width={typeof width === 'number' ? width : 800}
      height={typeof height === 'number' ? height : 200}
      className={className}
      style={{
        width: typeof width === 'string' ? width : undefined,
        height: typeof height === 'string' ? height : undefined,
        display: 'block',
        borderRadius: '12px',
        ...style
      }}
    />
  )
}

export default GradientMesh
