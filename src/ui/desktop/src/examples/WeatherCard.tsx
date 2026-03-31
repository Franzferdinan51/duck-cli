/**
 * WeatherCard - Pretext Canvas weather visualization
 * 
 * Uses @chenglou/pretext for precise text measurement
 * Canvas rendering with animated elements
 */

import React, { useRef, useEffect, useCallback } from 'react'

export interface WeatherData {
  temp: number
  condition: string
  location: string
  humidity: number
  wind: number
  forecast?: Array<{ day: string; high: number; low: number; condition: string }>
}

export interface WeatherCardProps {
  data: WeatherData
  width?: number
  height?: number
  className?: string
  style?: React.CSSProperties
}

export const WeatherCard: React.FC<WeatherCardProps> = ({
  data,
  width = 380,
  height = 280,
  className = '',
  style
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const particlesRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; size: number; alpha: number }>>([])

  const initParticles = useCallback(() => {
    const particles = []
    const count = data.condition.toLowerCase().includes('rain') ? 40 : 
                  data.condition.toLowerCase().includes('cloud') ? 20 : 30
    
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.8,
        vy: data.condition.toLowerCase().includes('rain') ? 3 : (Math.random() - 0.5) * 0.5,
        size: Math.random() * 3 + 1,
        alpha: Math.random() * 0.5 + 0.3
      })
    }
    particlesRef.current = particles
  }, [width, height, data.condition])

  useEffect(() => {
    initParticles()
  }, [initParticles])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const animate = () => {
      // Clear
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(0, 0, width, height)

      // Draw gradient background
      const gradient = ctx.createLinearGradient(0, 0, 0, height)
      gradient.addColorStop(0, '#16213e')
      gradient.addColorStop(1, '#0f3460')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, width, height)

      // Draw particles
      const particles = particlesRef.current
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy

        if (p.y > height) p.y = -10
        if (p.x < 0) p.x = width
        if (p.x > width) p.x = 0

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        
        if (data.condition.toLowerCase().includes('rain')) {
          ctx.fillStyle = `rgba(100, 149, 237, ${p.alpha})`
        } else if (data.condition.toLowerCase().includes('cloud')) {
          ctx.fillStyle = `rgba(200, 200, 200, ${p.alpha})`
        } else {
          ctx.fillStyle = `rgba(255, 215, 0, ${p.alpha})`
        }
        ctx.fill()
      }

      // Draw weather info
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 64px Inter, system-ui'
      ctx.textAlign = 'center'
      ctx.fillText(`${data.temp}°`, width / 2, 100)

      ctx.font = '18px Inter, system-ui'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
      ctx.fillText(data.condition, width / 2, 130)
      ctx.fillText(data.location, width / 2, 155)

      // Draw metrics
      ctx.font = '14px Inter, system-ui'
      ctx.textAlign = 'left'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
      ctx.fillText(`💧 ${data.humidity}%`, 20, height - 60)
      ctx.fillText(`💨 ${data.wind} mph`, 20, height - 40)

      // Draw forecast
      if (data.forecast && data.forecast.length > 0) {
        const startX = width - 120
        data.forecast.slice(0, 3).forEach((day, idx) => {
          const x = startX + idx * 40
          ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
          ctx.font = '10px Inter'
          ctx.textAlign = 'center'
          ctx.fillText(day.day.slice(0, 3), x, height - 60)
          ctx.fillStyle = '#fff'
          ctx.font = '12px Inter'
          ctx.fillText(`${day.high}°`, x, height - 40)
        })
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [width, height, data])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      style={{
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        ...style
      }}
    />
  )
}

export default WeatherCard
