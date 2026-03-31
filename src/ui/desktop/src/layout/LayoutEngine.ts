/**
 * LayoutEngine — Textura-style DOM-free layout tree
 * Pretext (text measurement) + box/flex layout
 * Compute exact pixel geometry without touching the DOM
 *
 * Inspired by razroo/textura — Pretext x Yoga = full UI geometry
 */

import { prepareWithSegments, layoutWithLines, layoutNextLine } from '@chenglou/pretext'

// ─── LAYOUT NODE TYPES ────────────────────────────────────────────────────────

export type LayoutDirection = 'ltr' | 'rtl'
export type FlexDirection = 'row' | 'column' | 'row-reverse' | 'column-reverse'
export type FlexWrap = 'nowrap' | 'wrap' | 'wrap-reverse'
export type JustifyContent = 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly'
export type AlignItems = 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline'
export type Overflow = 'visible' | 'hidden' | 'scroll' | 'auto'

export type BoxNode = {
  /** Layout type */
  type: 'box'
  /** Flex container direction */
  flexDirection?: FlexDirection
  flexWrap?: FlexWrap
  justifyContent?: JustifyContent
  alignItems?: AlignItems
  flexGrow?: number
  flexShrink?: number
  flexBasis?: number
  gap?: number
  /** Sizing */
  width?: number
  height?: number
  minWidth?: number
  maxWidth?: number
  minHeight?: number
  maxHeight?: number
  /** Spacing */
  padding?: number
  paddingTop?: number
  paddingRight?: number
  paddingBottom?: number
  paddingLeft?: number
  margin?: number
  marginTop?: number
  marginRight?: number
  marginBottom?: number
  marginLeft?: number
  /** Positioning */
  position?: 'relative' | 'absolute'
  top?: number
  right?: number
  bottom?: number
  left?: number
  /** Visual */
  backgroundColor?: string
  borderWidth?: number
  borderColor?: string
  borderRadius?: number
  overflow?: Overflow
  display?: 'flex' | 'none'
  /** Children */
  children?: LayoutNode[]
}

export type TextNode = {
  type: 'text'
  /** Content */
  text: string
  /** Canvas font shorthand: "16px Inter", "bold 24px Inter", etc. */
  font?: string
  fontSize?: number
  fontWeight?: number
  fontFamily?: string
  /** Line height in px */
  lineHeight?: number
  /** White space handling */
  whiteSpace?: 'normal' | 'pre' | 'pre-wrap' | 'nowrap'
  /** Text styling */
  color?: string
  textAlign?: 'left' | 'center' | 'right' | 'justify'
  /** Flex child overrides */
  flexGrow?: number
  flexShrink?: number
  flexBasis?: number
  alignSelf?: 'auto' | 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline'
  margin?: number
  marginTop?: number
  marginRight?: number
  marginBottom?: number
  marginLeft?: number
}

export type LayoutNode = BoxNode | TextNode

export type LayoutInput = {
  root: LayoutNode
  width?: number
  height?: number
  direction?: LayoutDirection
}

// ─── COMPUTED RESULT ─────────────────────────────────────────────────────────

export type ComputedBox = {
  id: string
  type: 'box'
  x: number
  y: number
  width: number
  height: number
  children: ComputedNode[]
}

export type ComputedText = {
  id: string
  type: 'text'
  x: number
  y: number
  width: number
  height: number
  text: string
  lineCount: number
  lines: { text: string; x: number; y: number; width: number }[]
}

export type ComputedNode = ComputedBox | ComputedText

// ─── HELPERS ──────────────────────────────────────────────────────────────────

let _nodeId = 0
function genId() { return `ln-${++_nodeId}` }

function resolvePadding(node: BoxNode) {
  const p = node.padding ?? 0
  return {
    top: node.paddingTop ?? p,
    right: node.paddingRight ?? p,
    bottom: node.paddingBottom ?? p,
    left: node.paddingLeft ?? p,
  }
}

function resolveMargin(node: TextNode | BoxNode) {
  const m = (node as any).margin ?? 0
  return {
    top: (node as any).marginTop ?? m,
    right: (node as any).marginRight ?? m,
    bottom: (node as any).marginBottom ?? m,
    left: (node as any).marginLeft ?? m,
  }
}

function parseFont(node: TextNode): string {
  if (node.font) return node.font
  const weight = node.fontWeight ?? 400
  const size = node.fontSize ?? 16
  const family = node.fontFamily ?? 'Inter'
  return `${weight === 400 ? '' : 'bold '}${size}px ${family}`
}

function measureText(text: string, font: string, maxWidth: number, lineHeight: number) {
  const prepared = prepareWithSegments(text, font)
  const { lines } = layoutWithLines(prepared, maxWidth, lineHeight)
  return {
    lines: lines.map((l: any) => ({ text: l.text, width: l.width })),
    height: lines.length * lineHeight,
    lineCount: lines.length,
  }
}

function resolveWidth(node: BoxNode, containerWidth: number): number {
  if (node.width !== undefined) return node.width
  if (node.flexGrow !== undefined && node.flexBasis !== undefined) return node.flexBasis
  if (node.flexGrow !== undefined) return 0 // grows to fill
  return containerWidth
}

function resolveHeight(node: BoxNode): number | undefined {
  return node.height
}

// ─── MAIN LAYOUT ALGORITHM ───────────────────────────────────────────────────

interface FlexItem {
  node: LayoutNode
  id: string
  grow: number
  shrink: number
  basis: number
  outerMin: number
  outerMax: number
  resolvedSize: number
  marginLeft: number
  marginRight: number
  marginTop: number
  marginBottom: number
}

interface ContentSize {
  min: number
  max: number
}

function isRow(dir: FlexDirection) {
  return dir === 'row' || dir === 'row-reverse'
}

function resolveAxis(node: BoxNode): [mainAxis: FlexDirection, crossAxis: FlexDirection] {
  const dir = node.flexDirection ?? 'row'
  if (dir === 'row' || dir === 'row-reverse') return ['row', 'column']
  return ['column', 'row']
}

function computeContentSize(node: LayoutNode, maxWidth: number): ContentSize {
  if (node.type === 'text') {
    const font = parseFont(node)
    const lh = node.lineHeight ?? 22
    const { height, lineCount } = measureText(node.text, font, maxWidth, lh)
    const lineWidths = node.text.split('\n').map(l => {
      // estimate — real width requires measure
      return l.length * (node.fontSize ?? 14) * 0.6
    })
    return {
      min: Math.min(...lineWidths, 0),
      max: Math.max(...lineWidths, height),
    }
  }

  // Box: sum children + padding
  const p = resolvePadding(node)
  const children = (node.children ?? []) as LayoutNode[]
  const dir = node.flexDirection ?? 'row'
  const isMainRow = isRow(dir)

  let min = p.left + p.right
  let max = p.left + p.right

  for (const child of children) {
    const childSize = computeContentSize(child, isMainRow ? maxWidth - min : maxWidth)
    if (isMainRow) {
      min += childSize.min
      max += childSize.max
    } else {
      min = Math.max(min, childSize.min)
      max = Math.max(max, childSize.max)
    }
  }

  return { min: min + (node.marginLeft ?? 0) + (node.marginRight ?? 0),
           max: max + (node.marginLeft ?? 0) + (node.marginRight ?? 0) }
}

function layoutNode(
  node: LayoutNode,
  x: number, y: number,
  availWidth: number, availHeight: number,
  parentDir: FlexDirection = 'row',
  parentWrap: FlexWrap = 'nowrap',
  parentAlign: AlignItems = 'stretch'
): ComputedNode {
  const id = genId()

  if (node.type === 'text') {
    const font = parseFont(node)
    const lh = node.lineHeight ?? 22
    const ma = resolveMargin(node)
    const effWidth = Math.max(0, availWidth - ma.left - ma.right)
    const { lines, height, lineCount } = measureText(node.text, font, effWidth, lh)

    const ta = node.textAlign ?? 'left'
    const laidLines = lines.map((l: any, i: number) => {
      let lx = ma.left
      if (ta === 'center') lx += effWidth / 2 - l.width / 2
      else if (ta === 'right') lx += effWidth - l.width
      return { text: l.text, x: x + lx, y: y + ma.top + i * lh, width: l.width }
    })

    const totalH = Math.max(0, height + ma.top + ma.bottom)
    const totalW = Math.max(0, effWidth + ma.left + ma.right)

    return {
      id,
      type: 'text',
      x, y,
      width: totalW,
      height: totalH,
      text: node.text,
      lineCount,
      lines: laidLines,
    } as ComputedText
  }

  // BOX NODE
  const box = node as BoxNode
  const p = resolvePadding(box)
  const dir = box.flexDirection ?? 'row'
  const wrap = box.flexWrap ?? 'nowrap'
  const justify = box.justifyContent ?? 'flex-start'
  const align = box.alignItems ?? 'stretch'
  const gap = box.gap ?? 0
  const isMainRow = isRow(dir)

  const children = (box.children ?? []) as LayoutNode[]
  const childCount = children.length

  // flex container sizing
  const containerW = box.width ?? availWidth
  const containerH = box.height ?? availHeight
  const innerW = Math.max(0, containerW - p.left - p.right)
  const innerH = Math.max(0, containerH - p.top - p.bottom)

  if (childCount === 0) {
    return {
      id,
      type: 'box',
      x, y,
      width: containerW,
      height: containerH,
      children: [],
    } as ComputedBox
  }

  // build flex items
  const items: FlexItem[] = children.map(child => {
    const mg = resolveMargin(child as any)
    const isTextChild = child.type === 'text'
    const childBox = child as BoxNode
    const grow = child.flexGrow ?? (isTextChild ? 0 : 0)
    const shrink = child.flexShrink ?? (isTextChild ? 1 : 1)
    const basis = child.flexBasis ?? (isTextChild ? auto : 0)
    return {
      node: child,
      id: genId(),
      grow, shrink, basis,
      outerMin: 0,
      outerMax: Infinity,
      marginLeft: mg.left,
      marginRight: mg.right,
      marginTop: mg.top,
      marginBottom: mg.bottom,
      resolvedSize: 0,
    }
  })

  // remove "auto" basis placeholder
  const auto = 0 // simplify

  // STEP 1: resolve flex-basis vs main-size
  for (const item of items) {
    item.resolvedSize = item.basis
  }

  // STEP 2: determine available space
  let consumed = gap * (childCount - 1)
  for (const item of items) {
    consumed += item.marginLeft + item.marginRight + item.resolvedSize
  }
  const availSpace = innerW - consumed
  const flexShrinkUsed = availSpace < 0

  // STEP 3: resolve flexible items
  if (flexShrinkUsed) {
    const scaleFactor = availSpace < 0
      ? availSpace / children.reduce((s, c) => {
          const i = items[children.indexOf(c)]
          return s + i.shrink * i.resolvedSize
        }, 0)
      : 1
    for (const item of items) {
      item.resolvedSize = Math.max(0, item.resolvedSize + scaleFactor * item.shrink * item.resolvedSize)
    }
  } else if (availSpace > 0) {
    const growTotal = items.reduce((s, i) => s + i.grow, 0)
    if (growTotal > 0) {
      const growUnit = availSpace / growTotal
      for (const item of items) {
        item.resolvedSize += growUnit * item.grow
      }
    } else {
      // distribute extra space per justify
      const extra = availSpace
      const itemSpace = extra / childCount
      if (justify === 'center') {
        for (const item of items) {
          item.resolvedSize += itemSpace
        }
      } else if (justify === 'flex-end') {
        // all items stay at resolvedSize, first item gets no extra
      } else if (justify === 'space-between') {
        // handled in positioning
      } else if (justify === 'space-around') {
        for (const item of items) {
          item.resolvedSize += itemSpace
        }
      } else if (justify === 'space-evenly') {
        for (const item of items) {
          item.resolvedSize += itemSpace
        }
      }
    }
  }

  // STEP 4: layout children
  const computedChildren: ComputedNode[] = []
  let cursor = isMainRow ? p.left : p.top
  const crossStart = isMainRow ? p.top : p.left

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const child = item.node
    const isRowChild = isRow(dir)

    const childX = isRowChild
      ? x + cursor + item.marginLeft
      : x + crossStart + item.marginLeft
    const childY = isRowChild
      ? y + crossStart + item.marginTop
      : y + cursor + item.marginTop

    const childAvailW = isRowChild ? item.resolvedSize : innerW
    const childAvailH = isRowChild ? innerH : item.resolvedSize

    const laid = layoutNode(
      child, childX, childY,
      childAvailW, childAvailH,
      dir, wrap, align
    )
    computedChildren.push(laid)

    const childSize = isRowChild ? laid.width : laid.height
    const advance = isRowChild
      ? childSize + gap + item.marginRight
      : childSize + gap + item.marginBottom

    if (isRowChild) {
      cursor += childSize + gap + item.marginLeft + item.marginRight
    } else {
      cursor += childSize + gap + item.marginTop + item.marginBottom
    }
  }

  // cross-axis alignment
  const maxChildCross = Math.max(...computedChildren.map(c =>
    isMainRow ? c.height : c.width
  ))

  for (const child of computedChildren) {
    if (isMainRow) {
      // center/stretch vertically
      if (align === 'center') {
        child.y = y + p.top + (innerH - child.height) / 2
      } else if (align === 'flex-end') {
        child.y = y + p.top + innerH - child.height
      } else {
        child.y = y + p.top
      }
    } else {
      // center/stretch horizontally
      if (align === 'center') {
        child.x = x + p.left + (innerW - child.width) / 2
      } else if (align === 'flex-end') {
        child.x = x + p.left + innerW - child.width
      }
    }
  }

  const totalW = box.width ?? (isMainRow ? cursor + p.right : innerW + p.left + p.right)
  const totalH = box.height ?? (!isMainRow ? cursor + p.bottom : innerH + p.top + p.bottom)

  return {
    id,
    type: 'box',
    x, y,
    width: totalW,
    height: totalH,
    children: computedChildren,
  } as ComputedBox
}

// ─── PUBLIC API ──────────────────────────────────────────────────────────────

export function computeLayout(input: LayoutInput): ComputedNode {
  _nodeId = 0 // reset ID counter per computation
  return layoutNode(
    input.root,
    0, 0,
    input.width ?? 400,
    input.height ?? Infinity,
    'row', 'nowrap', 'stretch'
  )
}

/**
 * Flatten computed layout into a list of all nodes (for rendering)
 */
export function flattenLayout(node: ComputedNode): ComputedNode[] {
  const result: ComputedNode[] = [node]
  if (node.type === 'box' && node.children.length > 0) {
    for (const child of node.children) {
      result.push(...flattenLayout(child))
    }
  }
  return result
}

/**
 * Render computed layout to a Canvas 2D context
 */
export function renderLayout(
  ctx: CanvasRenderingContext2D,
  node: ComputedNode,
  time: number = 0
) {
  const flat = flattenLayout(node)
  for (const n of flat) {
    if (n.type === 'box') {
      const b = n as ComputedBox
      if (b.children.length === 0) continue
      // draw box background if set
      // children drawn recursively
    } else {
      const t = n as ComputedText
      const font = parseFont({ font: t.text.includes('bold') ? `bold ${14}px Inter` : `${14}px Inter` } as TextNode)
      ctx.fillStyle = '#ffffff'
      ctx.font = font
      for (const line of t.lines) {
        ctx.fillText(line.text, line.x, line.y)
      }
    }
  }
}
