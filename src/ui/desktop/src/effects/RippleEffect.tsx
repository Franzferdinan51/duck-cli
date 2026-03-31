import React, { useEffect, useRef } from 'react'

// ============================================
// TYPES
// ============================================

export interface RippleEffectProps {
  children?: React.ReactNode
  className?: string
  color?: string
  duration?: number
}

// ============================================
// RIPPLE EFFECT COMPONENT
// ============================================

export function RippleEffect({
  children,
  className = '',
  color = '#8b5cf6',
  duration = 600,
}: RippleEffectProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    
    const handleClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      
      // Create ripple element
      const ripple = document.createElement('div')
      ripple.style.cssText = `
        position: absolute;
        border-radius: 50%;
        background: ${color};
        transform: scale(0);
        animation: ripple ${duration}ms ease-out forwards;
        pointer-events: none;
        left: ${x}px;
        top: ${y}px;
        width: 10px;
        height: 10px;
        margin-left: -5px;
        margin-top: -5px;
      `
      
      container.appendChild(ripple)
      
      // Remove after animation
      setTimeout(() => {
        ripple.remove()
      }, duration)
    }
    
    container.addEventListener('click', handleClick)
    
    // Add keyframes if not exists
    if (!document.getElementById('ripple-keyframes')) {
      const style = document.createElement('style')
      style.id = 'ripple-keyframes'
      style.textContent = `
        @keyframes ripple {
          to {
            transform: scale(40);
            opacity: 0;
          }
        }
      `
      document.head.appendChild(style)
    }
    
    return () => {
      container.removeEventListener('click', handleClick)
    }
  }, [color, duration])
  
  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
      }}
    >
      {children}
    </div>
  )
}

// Wrapper to use with children
export function withRipple<P extends object>(
  Component: React.ComponentType<P>
) {
  return function RippleWrapper(props: P & RippleEffectProps) {
    return (
      <RippleEffect color={props.color} duration={props.duration}>
        <Component {...props} />
      </RippleEffect>
    )
  }
}

export default RippleEffect
