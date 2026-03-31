import React, { useEffect, useRef, useState } from 'react'

// ============================================
// TYPES
// ============================================

export interface MasonryItem {
  id: string
  content: React.ReactNode
  height?: number
}

export interface MasonryLayoutProps {
  items: MasonryItem[]
  columns?: number
  gap?: number
  className?: string
}

// ============================================
// MASONRY LAYOUT COMPONENT
// ============================================

export function MasonryLayout({
  items,
  columns = 3,
  gap = 16,
  className = '',
}: MasonryLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [columnHeights, setColumnHeights] = useState<number[]>(Array(columns).fill(0))
  
  useEffect(() => {
    const heights = Array(columns).fill(0)
    
    items.forEach((item, index) => {
      const shortestColumn = heights.indexOf(Math.min(...heights))
      heights[shortestColumn] += (item.height || 200) + gap
    })
    
    setColumnHeights(heights)
  }, [items, columns, gap])
  
  const assignToColumn = (index: number): number => {
    const columnIndex = index % columns
    return columnIndex
  }
  
  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        display: 'flex',
        gap,
        width: '100%',
      }}
    >
      {Array.from({ length: columns }).map((_, columnIndex) => (
        <div
          key={columnIndex}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap,
          }}
        >
          {items
            .filter((_, itemIndex) => assignToColumn(itemIndex) === columnIndex)
            .map((item) => (
              <div key={item.id} style={{ minHeight: item.height || 200 }}>
                {item.content}
              </div>
            ))}
        </div>
      ))}
    </div>
  )
}

export default MasonryLayout
