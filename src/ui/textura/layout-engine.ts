/**
 * 🦆 Duck Agent - Textura Layout Engine
 * DOM-free layout engine combining Yoga (flexbox) + Pretext (text)
 * Based on https://github.com/razroo/textura
 */

// Pretext types - these will be provided at runtime
declare function prepareWithSegments(text: string, font: string): any;
declare function layoutWithLines(prepared: any, width: number, lineHeight: number): any;

export interface TexturaNode {
  width?: number;
  height?: number;
  flexDirection?: 'row' | 'column';
  flexWrap?: 'wrap' | 'nowrap';
  flexGrow?: number;
  flexShrink?: number;
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline';
  gap?: number;
  padding?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  margin?: number;
  marginTop?: number;
  marginLeft?: number;
  text?: string;
  font?: string;
  fontSize?: number;
  lineHeight?: number;
  textAlign?: 'left' | 'center' | 'right';
  color?: string;
  children?: TexturaNode[];
  type?: 'box' | 'text';
}

export interface Line {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ComputedLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  lineCount?: number;
  lines?: Line[];
  children?: ComputedLayout[];
}

const DEFAULT_FONT = '16px system-ui, sans-serif';
const DEFAULT_LINE_HEIGHT = 1.4;

export class TexturaLayout {
  private width: number;
  private direction: 'ltr' | 'rtl' = 'ltr';
  
  constructor(width: number = 400) {
    this.width = width;
  }
  
  computeLayout(node: TexturaNode): ComputedLayout {
    if (node.type === 'text' || node.text) {
      return this.computeTextLayout(node);
    }
    return this.computeBoxLayout(node);
  }
  
  private computeTextLayout(node: TexturaNode): ComputedLayout {
    const font = node.font || DEFAULT_FONT;
    const lineHeight = (node.lineHeight || DEFAULT_LINE_HEIGHT) * (node.fontSize || 16);
    
    const prepared = prepareWithSegments(node.text || '', font);
    const result = layoutWithLines(prepared, node.width || this.width, lineHeight);
    const lines: Line[] = result.lines.map((l: any) => ({
      text: l.text,
      x: 0,
      y: l.y,
      width: l.width,
      height: lineHeight,
    }));
    
    const textHeight = lines.length * lineHeight;
    
    return {
      x: node.marginLeft || 0,
      y: node.marginTop || 0,
      width: node.width || this.width,
      height: Math.max(node.height || 0, textHeight),
      text: node.text,
      lineCount: lines.length,
      lines,
    };
  }
  
  private computeBoxLayout(node: TexturaNode): ComputedLayout {
    const x = node.marginLeft || 0;
    const y = node.marginTop || 0;
    const width = node.width || this.width;
    const isRow = (node.flexDirection || 'column') === 'row';
    const gap = node.gap || 0;
    
    if (!node.children || node.children.length === 0) {
      return { x, y, width, height: node.height || 0 };
    }
    
    const childLayouts: ComputedLayout[] = [];
    let totalMainSize = 0;
    let totalCrossSize = 0;
    
    for (const child of node.children) {
      const layout = this.computeLayout({
        ...child,
        width: isRow ? undefined : width - (node.padding || 0) * 2,
      });
      childLayouts.push(layout);
      
      if (isRow) {
        totalMainSize += layout.width + gap;
        totalCrossSize = Math.max(totalCrossSize, layout.height);
      } else {
        totalMainSize += layout.height + gap;
        totalCrossSize = Math.max(totalCrossSize, layout.width);
      }
    }
    
    if (totalMainSize > 0) totalMainSize -= gap;
    
    let currentMain = node.padding || 0;
    
    if (node.justifyContent && node.justifyContent === 'center') {
      const available = width - totalMainSize - (node.padding || 0) * 2;
      if (available > 0) currentMain += available / 2;
    } else if (node.justifyContent === 'flex-end') {
      const available = width - totalMainSize - (node.padding || 0) * 2;
      if (available > 0) currentMain += available;
    }
    
    for (let i = 0; i < childLayouts.length; i++) {
      const child = childLayouts[i];
      
      if (isRow) {
        let crossOffset = 0;
        if (node.alignItems === 'center') {
          crossOffset = (totalCrossSize - child.height) / 2;
        } else if (node.alignItems === 'flex-end') {
          crossOffset = totalCrossSize - child.height;
        }
        child.x = currentMain;
        child.y = (node.padding || 0) + crossOffset;
        currentMain += child.width + gap;
      } else {
        let crossOffset = 0;
        if (node.alignItems === 'center') {
          crossOffset = ((node.width || width) - child.width) / 2;
        } else if (node.alignItems === 'flex-end') {
          crossOffset = (node.width || width) - child.width;
        }
        child.x = crossOffset;
        child.y = currentMain;
        currentMain += child.height + gap;
      }
    }
    
    const totalWidth = isRow ? totalMainSize : Math.max(...childLayouts.map(c => c.width));
    const totalHeight = isRow ? Math.max(...childLayouts.map(c => c.height)) : totalMainSize;
    
    return {
      x,
      y,
      width: Math.max(width, totalWidth + (node.padding || 0) * 2),
      height: Math.max(node.height || 0, totalHeight + (node.padding || 0) * 2),
      children: childLayouts,
    };
  }
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderToCanvas(ctx: any, node: TexturaNode, computed?: ComputedLayout): void {
    const layout = computed || this.computeLayout(node);
    
    ctx.save();
    
    if (layout.lines) {
      const font = node.font || DEFAULT_FONT;
      ctx.font = font;
      ctx.fillStyle = node.color || '#fff';
      ctx.textBaseline = 'top';
      
      for (const line of layout.lines) {
        let x = layout.x + line.x;
        if (node.textAlign === 'center') {
          x = layout.x + (layout.width - line.width) / 2;
        } else if (node.textAlign === 'right') {
          x = layout.x + layout.width - line.width;
        }
        ctx.fillText(line.text, x, layout.y + line.y);
      }
    }
    
    if (layout.children) {
      for (const child of layout.children) {
        const childNode = node.children?.[layout.children!.indexOf(child)];
        if (childNode) {
          this.renderToCanvas(ctx, childNode, child);
        }
      }
    }
    
    ctx.restore();
  }
}

export default TexturaLayout;
