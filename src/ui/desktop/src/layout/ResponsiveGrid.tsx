import React, { useMemo } from 'react'

// ============================================
// TYPES
// ============================================

export interface ResponsiveGridProps {
  children: React.ReactNode[]
  columns?: number | { base: number; md?: number; lg?: number; xl?: number }
  gap?: number
  className?: string
}

// ============================================
// RESPONSIVE GRID COMPONENT
// ============================================

export function ResponsiveGrid({
  children,
  columns = { base: 1, md: 2, lg: 3, xl: 4 },
  gap = 16,
  className = '',
}: ResponsiveGridProps) {
  const columnValue = useMemo(() => {
    if (typeof columns === 'number') {
      return `repeat(${columns}, 1fr)`
    }
    
    const base = `repeat(${columns.base}, 1fr)`
    const md = columns.md ? `@media (min-width: 768px) { grid-template-columns: repeat(${columns.md}, 1fr); }` : ''
    const lg = columns.lg ? `@media (min-width: 1024px) { grid-template-columns: repeat(${columns.lg}, 1fr); }` : ''
    const xl = columns.xl ? `@media (min-width: 1280px) { grid-template-columns: repeat(${columns.xl}, 1fr); }` : ''
    
    return base
  }, [columns])
  
  return (
    <div
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: typeof columns === 'number' ? `repeat(${columns}, 1fr)` : `repeat(${columns.base}, 1fr)`,
        gap,
      }}
    >
      {children.map((child, i) => (
        <div key={i}>{child}</div>
      ))}
    </div>
  )
}

export default ResponsiveGrid
