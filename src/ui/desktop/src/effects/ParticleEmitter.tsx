/**
 * ParticleEmitter - Canvas-based particle system
 */

import React, { useEffect, useRef, useCallback } from 'react'

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
}

export interface ParticleEmitterProps {
  count?: number
  colors?: string[]
  minSize?: number
  maxSize?: number
  minLife?: number
  maxLife?: number
  minSpeed?: number
  maxSpeed?: number
  gravity?: number
  friction?: number
  decay?: number
  emitX?: number
  emitY?: number
  emitRadius?: number
  width?: number
  height?: number
  className?: string
  style?: React.CSSProperties
}

function createParticle(
  options: Omit<ParticleEmitterProps, 'width' | 'height' | 'className' | 'style'>,
  canvasWidth: number,
  canvasHeight: number
): Particle {
  const {
    colors = ['#8b5cf6', '#a78bfa', '#c4b5fd'],
    minSize = 2,
    maxSize = 6,
    minLife = 50,
    maxLife = 150,
    minSpeed = 0.5,
    maxSpeed = 3,
    gravity = 0.1,
    friction = 0.99,
    decay = 0.98,
    emitX,
    emitY,
    emitRadius = 50
  } = options
  
  const angle = Math.random() * Math.PI * 2
  const speed = minSpeed + Math.random() * (maxSpeed - minSpeed)
  
  // Emit from specific point or random
  const x = emitX !== undefined
    ? emitX + (Math.random() - 0.5) * emitRadius * 2
    : Math.random() * canvasWidth
  
  const y = emitY !== undefined
    ? emitY + (Math.random() - 0.5) * emitRadius * 2
    : Math.random() * canvasHeight
  
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: minLife + Math.random() * (maxLife - minLife),
    maxLife: minLife + Math.random() * (maxLife - minLife),
    size: minSize + Math.random() * (maxSize - minSize),
    color: colors[Math.floor(Math.random() * colors.length)]
  }
}

/**
 * ParticleEmitter component
 */
export const ParticleEmitter: React.FC<ParticleEmitterProps> = ({
  count = 50,
  colors = ['#8b5cf6', '#a78bfa', '#c4b5fd'],
  minSize = 2,
  maxSize = 6,
  minLife = 50,
  maxLife = 150,
  minSpeed = 0.5,
  maxSpeed = 3,
  gravity = 0.1,
  friction = 0.99,
  decay = 0.98,
  emitX,
  emitY,
  emitRadius = 50,
  width = 300,
  height = 200,
  className,
  style
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const animationRef = useRef<number | null>(null)
  
  // Initialize particles
  useEffect(() => {
    particlesRef.current = Array.from({ length: count }, () =>
      createParticle(
        { colors, minSize, maxSize, minLife, maxLife, minSpeed, maxSpeed, gravity, friction, decay, emitX, emitY, emitRadius },
        width,
        height
      )
    )
  }, [count, colors, minSize, maxSize, minLife, maxLife, minSpeed, maxSpeed, gravity, friction, decay, emitX, emitY, emitRadius, width, height])
  
  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const animate = () => {
      ctx.clearRect(0, 0, width, height)
      
      particlesRef.current.forEach((particle, index) => {
        // Update physics
        particle.vy += gravity
        particle.vx *= friction
        particle.vy *= friction
        particle.x += particle.vx
        particle.y += particle.vy
        particle.life--
        
        // Check if particle is dead
        if (particle.life <= 0) {
          particlesRef.current[index] = createParticle(
            { colors, minSize, maxSize, minLife, maxLife, minSpeed, maxSpeed, gravity, friction, decay, emitX, emitY, emitRadius },
            width,
            height
          )
          return
        }
        
        // Draw particle
        const alpha = Math.min((particle.life / particle.maxLife) * decay, 1)
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        ctx.fillStyle = particle.color
        ctx.globalAlpha = alpha
        ctx.fill()
        ctx.globalAlpha = 1
      })
      
      animationRef.current = requestAnimationFrame(animate)
    }
    
    animate()
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [width, height, colors, minSize, maxSize, minLife, maxLife, minSpeed, maxSpeed, gravity, friction, decay, emitX, emitY, emitRadius])
  
  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      style={{
        display: 'block',
        borderRadius: '8px',
        ...style
      }}
    />
  )
}

export default ParticleEmitter
