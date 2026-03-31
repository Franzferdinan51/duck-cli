import React, { useState, useEffect } from 'react'

// ============================================
// TYPES
// ============================================

export type Breakpoint = 'base' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

export interface AdaptiveLayoutProps {
  children: React.ReactNode
  layouts: {
    base?: React.ReactNode
    sm?: React.ReactNode
    md?: React.ReactNode
    lg?: React.ReactNode
    xl?: React.ReactNode
    '2xl'?: React.ReactNode
  }
  className?: string
}

// ============================================
// BREAKPOINT HOOK
// ============================================

export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('base')
  
  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth
      if (width >= 1536) setBreakpoint('2xl')
      else if (width >= 1280) setBreakpoint('xl')
      else if (width >= 1024) setBreakpoint('lg')
      else if (width >= 768) setBreakpoint('md')
      else if (width >= 640) setBreakpoint('sm')
      else setBreakpoint('base')
    }
    
    updateBreakpoint()
    window.addEventListener('resize', updateBreakpoint)
    return () => window.removeEventListener('resize', updateBreakpoint)
  }, [])
  
  return breakpoint
}

// ============================================
// ADAPTIVE LAYOUT COMPONENT
// ============================================

export function AdaptiveLayout({
  children,
  layouts,
  className = '',
}: AdaptiveLayoutProps) {
  const breakpoint = useBreakpoint()
  
  const getLayout = () => {
    if (breakpoint === '2xl' && layouts['2xl']) return layouts['2xl']
    if (breakpoint === 'xl' && layouts.xl) return layouts.xl
    if (breakpoint === 'lg' && layouts.lg) return layouts.lg
    if (breakpoint === 'md' && layouts.md) return layouts.md
    if (breakpoint === 'sm' && layouts.sm) return layouts.sm
    return layouts.base || children
  }
  
  return (
    <div className={className}>
      {getLayout()}
    </div>
  )
}

export default AdaptiveLayout
