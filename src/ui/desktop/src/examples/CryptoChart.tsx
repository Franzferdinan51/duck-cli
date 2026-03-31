/**
 * CryptoChart - Pretext Canvas cryptocurrency price visualization
 * 
 * Uses @chenglou/pretext for precise text measurement
 * Canvas rendering for animated price charts
 */

import React, { useRef, useEffect, useCallback, useState } from 'react'

export interface CryptoData {
  symbol: string
  name: string
  price: number
  change24h: number
  changePercent: number
  high24h: number
  low24h: number
  volume: string
  chartData?: number[] // Array of price points for the last 24h
}

export interface CryptoChartProps {
  data: CryptoData
  width?: number
  height?: number
  className?: string
  style?: React.CSSProperties
}

export const CryptoChart: React.FC<CryptoChartProps> = ({
  data,
  width = 400,
  height = 260,
  className = '',
  style
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const [chartPoints, setChartPoints] = useState<Array<{ x: number; y: number }>>([])

  // Generate chart points from data
  useEffect(() => {
    if (!data.chartData || data.chartData.length === 0) {
      // Generate mock chart data if not provided
      const mockData: Array<{ x: number; y: number }> = []
      let price = data.price - (data.change24h || data.price * 0.02)
      
      for (let i = 0; i < 50; i++) {
        const x = (i / 49) * (width - 40) + 20
        price += (Math.random() - 0.48) * (data.price * 0.005)
        const y = height - 80 - ((price - data.low24h) / (data.high24h - data.low24h || 1)) * (height - 140)
        mockData.push({ x, y: Math.max(30, Math.min(height - 30, y)) })
      }
      setChartPoints(mockData)
    } else {
      const points = data.chartData.map((price, i) => {
        const x = (i / (data.chartData!.length - 1)) * (width - 40) + 20
        const normalizedPrice = (price - Math.min(...data.chartData)) / 
          (Math.max(...data.chartData) - Math.min(...data.chartData) || 1)
        const y = height - 80 - normalizedPrice * (height - 140)
        return { x, y: Math.max(30, Math.min(height - 30, y)) }
      })
      setChartPoints(points)
    }
  }, [data, width, height])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || chartPoints.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let phase = 0

    const animate = () => {
      // Clear
      ctx.fillStyle = '#0d1117'
      ctx.fillRect(0, 0, width, height)

      // Background gradient
      const bgGradient = ctx.createLinearGradient(0, 0, 0, height)
      bgGradient.addColorStop(0, '#161b22')
      bgGradient.addColorStop(1, '#0d1117')
      ctx.fillStyle = bgGradient
      ctx.fillRect(0, 0, width, height)

      // Draw grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
      ctx.lineWidth = 1
      for (let i = 0; i < 5; i++) {
        const y = 40 + i * ((height - 80) / 4)
        ctx.beginPath()
        ctx.moveTo(20, y)
        ctx.lineTo(width - 20, y)
        ctx.stroke()
      }

      // Draw chart area gradient
      const areaGradient = ctx.createLinearGradient(0, 40, 0, height - 40)
      const isPositive = data.changePercent >= 0
      if (isPositive) {
        areaGradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)')
        areaGradient.addColorStop(1, 'rgba(16, 185, 129, 0)')
      } else {
        areaGradient.addColorStop(0, 'rgba(239, 68, 68, 0.3)')
        areaGradient.addColorStop(1, 'rgba(239, 68, 68, 0)')
      }

      ctx.beginPath()
      ctx.moveTo(chartPoints[0].x, height - 40)
      chartPoints.forEach(p => ctx.lineTo(p.x, p.y))
      ctx.lineTo(chartPoints[chartPoints.length - 1].x, height - 40)
      ctx.closePath()
      ctx.fillStyle = areaGradient
      ctx.fill()

      // Draw chart line with glow
      ctx.shadowColor = isPositive ? '#10b981' : '#ef4444'
      ctx.shadowBlur = 10
      ctx.beginPath()
      chartPoints.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y)
        else ctx.lineTo(p.x, p.y)
      })
      ctx.strokeStyle = isPositive ? '#10b981' : '#ef4444'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.shadowBlur = 0

      // Draw header
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 24px Inter, system-ui'
      ctx.textAlign = 'left'
      ctx.fillText(data.symbol, 20, 35)
      ctx.font = '14px Inter, system-ui'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.fillText(data.name, 20 + ctx.measureText(data.symbol).width + 10, 35)

      // Draw price
      ctx.font = 'bold 28px Inter, system-ui'
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'right'
      ctx.fillText(`$${data.price.toLocaleString()}`, width - 20, 35)

      // Draw change
      const changeColor = isPositive ? '#10b981' : '#ef4444'
      ctx.font = '16px Inter, system-ui'
      ctx.fillStyle = changeColor
      const changeText = `${isPositive ? '+' : ''}${data.changePercent.toFixed(2)}%`
      ctx.fillText(changeText, width - 20, 60)

      // Draw metrics at bottom
      ctx.font = '12px Inter, system-ui'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.textAlign = 'left'
      ctx.fillText(`24h High: $${data.high24h.toLocaleString()}`, 20, height - 45)
      ctx.fillText(`24h Low: $${data.low24h.toLocaleString()}`, 20, height - 25)
      ctx.fillText(`Vol: ${data.volume}`, 150, height - 45)

      // Animate dots on chart
      phase += 0.05
      const dotIndex = Math.floor((Math.sin(phase) + 1) / 2 * (chartPoints.length - 1))
      const dot = chartPoints[dotIndex]
      
      ctx.beginPath()
      ctx.arc(dot.x, dot.y, 5, 0, Math.PI * 2)
      ctx.fillStyle = isPositive ? '#10b981' : '#ef4444'
      ctx.shadowColor = isPositive ? '#10b981' : '#ef4444'
      ctx.shadowBlur = 15
      ctx.fill()
      ctx.shadowBlur = 0

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [width, height, data, chartPoints])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      style={{
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        ...style
      }}
    />
  )
}

export default CryptoChart
