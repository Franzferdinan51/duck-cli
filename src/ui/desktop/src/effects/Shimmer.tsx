/**
 * Shimmer - Shimmer loading effect
 */

import React, { useMemo } from 'react'

export interface ShimmerProps {
  width?: number | string
  height?: number | string
  speed?: number
  color?: string
  gradientWidth?: number
  borderRadius?: number
  className?: string
  style?: React.CSSProperties
}

/**
 * Shimmer component
 */
export const Shimmer: React.FC<ShimmerProps> = ({
  width = '100%',
  height = 20,
  speed = 1.5,
  color = '#3b82f6',
  gradientWidth = 200,
  borderRadius = 4,
  className,
  style
}) => {
  const shimmerStyle = useMemo(() => ({
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    borderRadius: `${borderRadius}px`,
    background: `linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.03) 0%,
      rgba(255, 255, 255, 0.1) ${gradientWidth / 2}px,
      rgba(255, 255, 255, 0.2) ${gradientWidth}px,
      rgba(255, 255, 255, 0.1) ${gradientWidth + gradientWidth / 2}px,
      rgba(255, 255, 255, 0.03) ${gradientWidth * 2}px
    )`,
    backgroundSize: `${gradientWidth * 2}px 100%`,
    animation: `shimmer ${speed}s ease-in-out infinite`,
    ...style
  }), [width, height, speed, gradientWidth, borderRadius, style])
  
  return (
    <>
      <div className={className} style={shimmerStyle} />
      <style>{`
        @keyframes shimmer {
          0% { background-position: ${-gradientWidth * 2}px 0; }
          100% { background-position: ${gradientWidth * 2}px 0; }
        }
      `}</style>
    </>
  )
}

/**
 * Skeleton - Loading skeleton component
 */
export interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular'
  lines?: number
  lastLineWidth?: number | string
  spacing?: number
  children?: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  lines = 3,
  lastLineWidth = '60%',
  spacing = 8,
  children,
  className,
  style
}) => {
  if (variant === 'circular') {
    return (
      <Shimmer
        width={style?.width || 40}
        height={style?.height || 40}
        borderRadius="50%"
        className={className}
        style={style}
      />
    )
  }
  
  if (variant === 'rectangular') {
    return (
      <Shimmer
        width="100%"
        height={style?.height || 100}
        borderRadius={8}
        className={className}
        style={style}
      />
    )
  }
  
  // Text variant
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: `${spacing}px`,
        ...style
      }}
    >
      {Array.from({ length: lines }).map((_, i) => (
        <Shimmer
          key={i}
          width={i === lines - 1 ? lastLineWidth : '100%'}
          height={16}
          borderRadius={4}
        />
      ))}
    </div>
  )
}

export default Shimmer
