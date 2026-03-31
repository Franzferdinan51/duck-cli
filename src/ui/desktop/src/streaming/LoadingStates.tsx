/**
 * LoadingStates - Beautiful loading indicators
 */

import React, { useEffect, useRef, useState } from 'react'

export interface LoadingDotsProps {
  count?: number
  size?: number
  color?: string
  speed?: number
  className?: string
  style?: React.CSSProperties
}

export const LoadingDots: React.FC<LoadingDotsProps> = ({
  count = 3,
  size = 8,
  color = '#8b5cf6',
  speed = 0.15,
  className,
  style
}) => {
  const [activeIndex, setActiveIndex] = useState(0)
  
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex(i => (i + 1) % count)
    }, speed * 1000)
    
    return () => clearInterval(interval)
  }, [count, speed])
  
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        gap: `${size / 2}px`,
        alignItems: 'center',
        ...style
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: '50%',
            background: color,
            opacity: activeIndex === i ? 1 : 0.3,
            transform: activeIndex === i ? 'scale(1.2)' : 'scale(1)',
            transition: `all ${speed}s ease`,
            animation: activeIndex === i ? `pulse ${speed}s ease infinite` : 'none'
          }}
        />
      ))}
    </div>
  )
}

export interface LoadingSpinnerProps {
  size?: number
  color?: string
  strokeWidth?: number
  className?: string
  style?: React.CSSProperties
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 40,
  color = '#8b5cf6',
  strokeWidth = 3,
  className,
  style
}) => {
  return (
    <div
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        border: `${strokeWidth}px solid ${color}20`,
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        ...style
      }}
    >
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1.2); }
          50% { opacity: 0.5; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

export interface LoadingBarsProps {
  count?: number
  width?: number
  height?: number
  gap?: number
  color?: string
  speed?: number
  className?: string
  style?: React.CSSProperties
}

export const LoadingBars: React.FC<LoadingBarsProps> = ({
  count = 5,
  width = 4,
  height = 24,
  gap = 4,
  color = '#8b5cf6',
  speed = 0.1,
  className,
  style
}) => {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: `${gap}px`,
        ...style
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            width: `${width}px`,
            height: `${height}px`,
            background: color,
            borderRadius: '2px',
            animation: `bounce ${speed}s ease-in-out infinite`,
            animationDelay: `${i * speed}s`
          }}
        />
      ))}
      <style>{`
        @keyframes bounce {
          0%, 100% { height: ${height * 0.4}px; }
          50% { height: ${height}px; }
        }
      `}</style>
    </div>
  )
}

export interface LoadingPulseProps {
  width?: number | string
  height?: number
  color?: string
  className?: string
  style?: React.CSSProperties
}

export const LoadingPulse: React.FC<LoadingPulseProps> = ({
  width = '100%',
  height = 20,
  color = '#8b5cf6',
  className,
  style
}) => {
  return (
    <div
      className={className}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: `${height}px`,
        background: `linear-gradient(90deg, ${color}40 0%, ${color} 50%, ${color}40 100%)`,
        backgroundSize: '200% 100%',
        borderRadius: '4px',
        animation: 'shimmer 1.5s ease-in-out infinite',
        ...style
      }}
    >
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}

export interface LoadingOrbProps {
  size?: number
  color?: string
  className?: string
  style?: React.CSSProperties
}

export const LoadingOrb: React.FC<LoadingOrbProps> = ({
  size = 60,
  color = '#8b5cf6',
  className,
  style
}) => {
  return (
    <div
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: `radial-gradient(circle at 30% 30%, ${color}, transparent)`,
        boxShadow: `0 0 ${size / 2}px ${color}40`,
        animation: 'orb 2s ease-in-out infinite',
        ...style
      }}
    >
      <style>{`
        @keyframes orb {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

export default LoadingDots
