/**
 * GlowBorder - Animated glow border effect
 */

import React, { useEffect, useState, useMemo } from 'react'

export interface GlowBorderProps {
  children?: React.ReactNode
  color?: string
  intensity?: number
  blurRadius?: number
  borderRadius?: number
  animate?: boolean
  speed?: number
  className?: string
  style?: React.CSSProperties
}

/**
 * GlowBorder component
 */
export const GlowBorder: React.FC<GlowBorderProps> = ({
  children,
  color = '#8b5cf6',
  intensity = 0.8,
  blurRadius = 20,
  borderRadius = 12,
  animate = true,
  speed = 2,
  className,
  style
}) => {
  const [pulse, setPulse] = useState(0)
  
  useEffect(() => {
    if (!animate) return
    
    const interval = setInterval(() => {
      setPulse(p => (p + speed) % 360)
    }, 50)
    
    return () => clearInterval(interval)
  }, [animate, speed])
  
  // Calculate animated hue shift
  const animatedColor = useMemo(() => {
    if (!animate) return color
    
    // Simple hue rotation for supported colors
    const hslMatch = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)
    if (hslMatch) {
      const h = (parseInt(hslMatch[1]) + pulse) % 360
      return `hsl(${h}, ${hslMatch[2]}%, ${hslMatch[3]}%)`
    }
    
    return color
  }, [color, animate, pulse])
  
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        borderRadius: `${borderRadius}px`,
        padding: '2px',
        background: `linear-gradient(135deg, ${animatedColor}80, ${animatedColor}40)`,
        boxShadow: `
          0 0 ${blurRadius}px ${animatedColor}${Math.round(intensity * 255).toString(16).padStart(2, '0')},
          inset 0 0 ${blurRadius / 2}px ${animatedColor}40
        `,
        ...style
      }}
    >
      <div style={{
        borderRadius: `${borderRadius - 2}px`,
        background: 'rgba(15, 15, 25, 0.95)',
        height: '100%',
        width: '100%'
      }}>
        {children}
      </div>
      
      {/* Animated glow overlay */}
      {animate && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: `${borderRadius}px`,
            background: `conic-gradient(from ${pulse}deg, transparent, ${animatedColor}40, transparent)`,
            opacity: 0.3,
            animation: `spin ${10 / speed}s linear infinite`,
            pointerEvents: 'none'
          }}
        />
      )}
      
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default GlowBorder
