/**
 * PretextLayout - Advanced layout engine with text measurement
 * 
 * Provides layout primitives for building generative UI interfaces.
 */

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { TextMeasurement, useTextMeasurement } from './PretextCanvas'

// Types
export interface LayoutBox {
  x: number
  y: number
  width: number
  height: number
  content?: string | React.ReactNode
}

export interface LayoutOptions {
  direction?: 'row' | 'column'
  gap?: number
  padding?: number
  align?: 'start' | 'center' | 'end' | 'stretch'
  justify?: 'start' | 'center' | 'end' | 'space-between' | 'space-around'
  wrap?: boolean
  maxWidth?: number
  maxHeight?: number
}

export interface PretextLayoutProps {
  children?: React.ReactNode
  options?: LayoutOptions
  className?: string
  style?: React.CSSProperties
}

/**
 * Calculate layout boxes for children
 */
export function calculateLayout(
  children: React.ReactNode[],
  options: LayoutOptions
): LayoutBox[] {
  const {
    direction = 'row',
    gap = 0,
    padding = 0,
    align = 'stretch',
    justify = 'start',
    wrap = false,
    maxWidth = Infinity,
    maxHeight = Infinity
  } = options
  
  const boxes: LayoutBox[] = []
  let currentX = padding
  let currentY = padding
  let rowHeight = 0
  let maxRowWidth = 0
  
  // Get child dimensions
  const childElements = React.Children.toArray(children)
  
  childElements.forEach((child, index) => {
    // In a real implementation, you'd measure actual DOM elements
    // For now, we estimate based on content
    const estimatedWidth = 100
    const estimatedHeight = 50
    
    if (direction === 'row') {
      if (!wrap && currentX + estimatedWidth > maxWidth) {
        // Move to next row
        currentX = padding
        currentY += rowHeight + gap
        rowHeight = 0
      }
      
      boxes.push({
        x: currentX,
        y: currentY,
        width: estimatedWidth,
        height: estimatedHeight
      })
      
      currentX += estimatedWidth + gap
      rowHeight = Math.max(rowHeight, estimatedHeight)
      maxRowWidth = Math.max(maxRowWidth, currentX - gap)
    } else {
      boxes.push({
        x: padding,
        y: currentY,
        width: estimatedWidth,
        height: estimatedHeight
      })
      
      currentY += estimatedHeight + gap
      maxRowWidth = Math.max(maxRowWidth, estimatedWidth)
    }
  })
  
  return boxes
}

/**
 * FlexLayout - Flexbox-like layout component
 */
export const PretextLayout: React.FC<PretextLayoutProps> = ({
  children,
  options = {},
  className,
  style
}) => {
  const {
    direction = 'row',
    gap = 0,
    padding = 0,
    align = 'stretch',
    justify = 'start',
    wrap = false,
    maxWidth = Infinity,
    maxHeight = Infinity
  } = options
  
  const containerStyle: React.CSSProperties = useMemo(() => ({
    display: 'flex',
    flexDirection: direction,
    gap: `${gap}px`,
    padding: `${padding}px`,
    flexWrap: wrap ? 'wrap' : 'nowrap',
    alignItems: align,
    justifyContent: justify,
    maxWidth: maxWidth === Infinity ? undefined : maxWidth,
    maxHeight: maxHeight === Infinity ? undefined : maxHeight,
    ...style
  }), [direction, gap, padding, align, justify, wrap, maxWidth, maxHeight, style])
  
  return (
    <div className={className} style={containerStyle}>
      {children}
    </div>
  )
}

/**
 * StackLayout - Vertical or horizontal stack
 */
export interface StackLayoutProps {
  children?: React.ReactNode
  direction?: 'row' | 'column'
  gap?: number
  align?: 'start' | 'center' | 'end' | 'stretch'
  justify?: 'start' | 'center' | 'end' | 'space-between' | 'space-around'
  className?: string
  style?: React.CSSProperties
}

export const StackLayout: React.FC<StackLayoutProps> = ({
  children,
  direction = 'column',
  gap = 8,
  align = 'stretch',
  justify = 'start',
  className,
  style
}) => {
  const stackStyle: React.CSSProperties = useMemo(() => ({
    display: 'flex',
    flexDirection: direction,
    gap: `${gap}px`,
    alignItems: align,
    justifyContent: justify
  }), [direction, gap, align, justify])
  
  return (
    <div className={className} style={{ ...stackStyle, ...style }}>
      {children}
    </div>
  )
}

/**
 * GridLayout - CSS Grid-based layout
 */
export interface GridLayoutProps {
  children?: React.ReactNode
  columns?: number | string
  rows?: number | string
  gap?: number
  columnGap?: number
  rowGap?: number
  alignItems?: string
  justifyItems?: string
  className?: string
  style?: React.CSSProperties
}

export const GridLayout: React.FC<GridLayoutProps> = ({
  children,
  columns = 3,
  rows,
  gap = 16,
  columnGap,
  rowGap,
  alignItems = 'stretch',
  justifyItems = 'stretch',
  className,
  style
}) => {
  const gridStyle: React.CSSProperties = useMemo(() => ({
    display: 'grid',
    gridTemplateColumns: typeof columns === 'number' ? `repeat(${columns}, 1fr)` : columns,
    gridTemplateRows: rows ? (typeof rows === 'number' ? `repeat(${rows}, 1fr)` : rows) : undefined,
    gap: `${gap}px`,
    columnGap: columnGap !== undefined ? `${columnGap}px` : undefined,
    rowGap: rowGap !== undefined ? `${rowGap}px` : undefined,
    alignItems,
    justifyItems
  }), [columns, rows, gap, columnGap, rowGap, alignItems, justifyItems])
  
  return (
    <div className={className} style={{ ...gridStyle, ...style }}>
      {children}
    </div>
  )
}

/**
 * MasonryLayout - Pinterest-style masonry layout
 */
export interface MasonryLayoutProps {
  children?: React.ReactNode
  columns?: number
  gap?: number
  className?: string
  style?: React.CSSProperties
}

export const MasonryLayout: React.FC<MasonryLayoutProps> = ({
  children,
  columns = 3,
  gap = 16,
  className,
  style
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [columnHeights, setColumnHeights] = useState<number[]>(Array(columns).fill(0))
  
  // Distribute children into columns based on current height
  const childArray = useMemo(() => React.Children.toArray(children), [children])
  
  const getShortestColumn = useCallback(() => {
    let minHeight = Infinity
    let minIndex = 0
    columnHeights.forEach((height, index) => {
      if (height < minHeight) {
        minHeight = height
        minIndex = index
      }
    })
    return minIndex
  }, [columnHeights])
  
  // Calculate positions for each child
  const positions = useMemo(() => {
    const newHeights = Array(columns).fill(0)
    const result: Array<{ x: number; y: number; width: number }> = []
    
    childArray.forEach((_, index) => {
      const colIndex = index % columns
      const x = colIndex * (100 / columns)
      const y = newHeights[colIndex]
      
      // Estimate height (in real impl, measure actual elements)
      const estimatedHeight = 150 + (index % 3) * 50
      result.push({
        x,
        y,
        width: 100 / columns
      })
      
      newHeights[colIndex] += estimatedHeight + gap
    })
    
    setColumnHeights(newHeights)
    return result
  }, [childArray, columns, gap])
  
  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: `${Math.max(...columnHeights)}px`,
        ...style
      }}
    >
      {childArray.map((child, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: `${positions[index].x}%`,
            top: `${positions[index].y}px`,
            width: `calc(${positions[index].width}% - ${gap}px)`,
            marginLeft: gap / 2,
            marginRight: gap / 2
          }}
        >
          {child}
        </div>
      ))}
    </div>
  )
}

/**
 * AdaptiveLayout - Automatically adjusts based on container size
 */
export interface AdaptiveLayoutProps {
  children?: React.ReactNode
  breakpoints?: Array<{ minWidth: number; columns: number }>
  gap?: number
  className?: string
  style?: React.CSSProperties
}

export const AdaptiveLayout: React.FC<AdaptiveLayoutProps> = ({
  children,
  breakpoints = [
    { minWidth: 1200, columns: 4 },
    { minWidth: 900, columns: 3 },
    { minWidth: 600, columns: 2 },
    { minWidth: 0, columns: 1 }
  ],
  gap = 16,
  className,
  style
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [columns, setColumns] = useState(3)
  
  useEffect(() => {
    const updateColumns = () => {
      const width = containerRef.current?.clientWidth || 1000
      const matchingBreakpoint = breakpoints
        .filter(bp => width >= bp.minWidth)
        .sort((a, b) => b.minWidth - a.minWidth)[0]
      setColumns(matchingBreakpoint?.columns || 1)
    }
    
    updateColumns()
    window.addEventListener('resize', updateColumns)
    return () => window.removeEventListener('resize', updateColumns)
  }, [breakpoints])
  
  return (
    <div
      ref={containerRef}
      className={className}
      style={{ ...style }}
    >
      <GridLayout columns={columns} gap={gap}>
        {children}
      </GridLayout>
    </div>
  )
}

export default PretextLayout
