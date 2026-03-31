import { prepareWithSegments, layoutWithLines, layoutNextLine } from '@chenglou/pretext'

export type SceneTextNode = {
  id: string
  text: string
  font?: string
  color?: string
  x?: number
  y?: number
  maxWidth?: number
  lineHeight?: number
  align?: 'left' | 'center' | 'right'
  opacity?: number
}

export type SceneObstacle = {
  id: string
  x: number
  y: number
  width: number
  height: number
  radius?: number
  fill?: string
  stroke?: string
  strokeWidth?: number
  imageSrc?: string
}

export type SceneMotion = {
  kind: 'float' | 'orbit' | 'pulse' | 'drift'
  amplitude?: number
  speed?: number
  phase?: number
  originX?: number
  originY?: number
  radius?: number
}

export type SceneNode = {
  id: string
  kind: 'text' | 'obstacle'
  text?: SceneTextNode
  obstacle?: SceneObstacle
  motion?: SceneMotion
}

export type SceneDefinition = {
  width: number
  height: number
  background?: { top: string; bottom: string }
  nodes: SceneNode[]
}

export type LaidOutTextLine = {
  text: string
  x: number
  y: number
  width: number
}

export function measureSceneText(node: SceneTextNode): LaidOutTextLine[] {
  const font = node.font || '16px Inter'
  const maxWidth = node.maxWidth || 300
  const lineHeight = node.lineHeight || 24
  const prepared = prepareWithSegments(node.text, font)
  const { lines } = layoutWithLines(prepared, maxWidth, lineHeight)
  const baseX = node.x || 0
  const baseY = node.y || 0
  const align = node.align || 'left'

  return lines.map((line) => ({
    text: line.text,
    width: line.width,
    x: align === 'center' ? baseX - line.width / 2 : align === 'right' ? baseX - line.width : baseX,
    y: baseY + line.y,
  }))
}

export function layoutTextAroundObstacle(text: string, font = '16px Inter', maxWidth = 320, lineHeight = 24, obstacle = { x: 0, y: 0, width: 120, height: 120 }) {
  const prepared = prepareWithSegments(text, font)
  const lines = []
  let cursor = { segmentIndex: 0, graphemeIndex: 0 }
  let y = 0

  while (true) {
    const inObstacle = y >= obstacle.y && y < obstacle.y + obstacle.height
    const usableWidth = inObstacle ? maxWidth - obstacle.width - 10 : maxWidth
    const line = layoutNextLine(prepared, cursor, usableWidth)
    if (!line) break
    lines.push({
      text: line.text,
      x: inObstacle ? obstacle.width + 10 : 0,
      y,
      width: line.width,
    })
    cursor = line.end
    y += lineHeight
  }

  return { lines, height: y, obstacle }
}

export function resolveMotion(node: SceneNode, time: number): { dx: number; dy: number; scale: number; opacity: number } {
  const motion = node.motion
  if (!motion) return { dx: 0, dy: 0, scale: 1, opacity: 1 }

  const speed = motion.speed ?? 1
  const phase = motion.phase ?? 0
  const amp = motion.amplitude ?? 8
  const t = time * speed + phase

  switch (motion.kind) {
    case 'float':
      return { dx: 0, dy: Math.sin(t) * amp, scale: 1, opacity: 1 }
    case 'drift':
      return { dx: Math.sin(t * 0.7) * amp, dy: Math.cos(t) * amp * 0.5, scale: 1, opacity: 1 }
    case 'pulse':
      return { dx: 0, dy: 0, scale: 1 + Math.sin(t) * 0.04, opacity: 0.82 + Math.sin(t) * 0.18 }
    case 'orbit': {
      const radius = motion.radius ?? 30
      return { dx: Math.cos(t) * radius, dy: Math.sin(t) * radius, scale: 1, opacity: 1 }
    }
    default:
      return { dx: 0, dy: 0, scale: 1, opacity: 1 }
  }
}

export function sceneTemplates() {
  return {
    weather: {
      width: 500,
      height: 900,
      background: { top: '#1a0a2e', bottom: '#0a0a0f' },
      nodes: [
        { id: 'title', kind: 'text', text: { id: 'title', text: 'Huber Heights, Ohio', font: '24px Inter', x: 250, y: 70, color: '#a78bfa', align: 'center' } },
        { id: 'temp', kind: 'text', text: { id: 'temp', text: '62°', font: 'bold 120px Inter', x: 250, y: 220, color: '#ffffff', align: 'center' }, motion: { kind: 'pulse', speed: 1.8 } },
        { id: 'desc', kind: 'text', text: { id: 'desc', text: 'Overcast', font: 'bold 48px Inter', x: 250, y: 365, color: '#e5e5e5', align: 'center' } },
      ],
    } as SceneDefinition,
    crypto: {
      width: 500,
      height: 900,
      background: { top: '#0a1428', bottom: '#0a0a0f' },
      nodes: [
        { id: 'symbol', kind: 'text', text: { id: 'symbol', text: '₿', font: 'bold 48px Inter', x: 250, y: 60, color: '#f7931a', align: 'center' }, motion: { kind: 'pulse', speed: 2.2 } },
        { id: 'name', kind: 'text', text: { id: 'name', text: 'Bitcoin', font: 'bold 28px Inter', x: 250, y: 100, color: '#ffffff', align: 'center' } },
        { id: 'price', kind: 'text', text: { id: 'price', text: '$67,842', font: 'bold 64px Inter', x: 250, y: 200, color: '#22c55e', align: 'center' } },
      ],
    } as SceneDefinition,
    orbit: {
      width: 500,
      height: 500,
      background: { top: '#0a0a14', bottom: '#05050a' },
      nodes: [
        { id: 'core', kind: 'text', text: { id: 'core', text: 'PRETEXT', font: 'bold 42px Inter', x: 250, y: 250, color: '#ffffff', align: 'center' } },
        { id: 'ring1', kind: 'text', text: { id: 'ring1', text: 'MEASURE', font: '14px Inter', x: 250, y: 250, color: '#a78bfa', align: 'center' }, motion: { kind: 'orbit', speed: 1.1, radius: 90 } },
        { id: 'ring2', kind: 'text', text: { id: 'ring2', text: 'LAYOUT', font: '14px Inter', x: 250, y: 250, color: '#f472b6', align: 'center' }, motion: { kind: 'orbit', speed: -0.8, radius: 120, phase: 1.2 } },
        { id: 'ring3', kind: 'text', text: { id: 'ring3', text: 'CANVAS', font: '14px Inter', x: 250, y: 250, color: '#22c55e', align: 'center' }, motion: { kind: 'orbit', speed: 1.4, radius: 150, phase: 2.4 } },
      ],
    } as SceneDefinition,
    plant: {
      width: 500,
      height: 900,
      background: { top: '#0a1a0a', bottom: '#0a0a0f' },
      nodes: [
        { id: 'plant-title', kind: 'text', text: { id: 'plant-title', text: 'Plant Health Check', font: 'bold 28px Inter', x: 250, y: 60, color: '#22c55e', align: 'center' } },
        { id: 'plant-score', kind: 'text', text: { id: 'plant-score', text: '85', font: 'bold 72px Inter', x: 250, y: 180, color: '#22c55e', align: 'center' }, motion: { kind: 'pulse', speed: 1.7 } },
        { id: 'plant-vpd', kind: 'text', text: { id: 'plant-vpd', text: 'VPD 0.89 kPa', font: '18px Inter', x: 250, y: 300, color: '#facc15', align: 'center' } },
      ],
    } as SceneDefinition,
    osrs: {
      width: 500,
      height: 900,
      background: { top: '#1a0a0a', bottom: '#0a0a0f' },
      nodes: [
        { id: 'osrs-title', kind: 'text', text: { id: 'osrs-title', text: 'Dragon Whip', font: 'bold 32px Inter', x: 250, y: 70, color: '#f97316', align: 'center' } },
        { id: 'osrs-price', kind: 'text', text: { id: 'osrs-price', text: '18.2M', font: 'bold 64px Inter', x: 250, y: 170, color: '#ffffff', align: 'center' } },
        { id: 'osrs-change', kind: 'text', text: { id: 'osrs-change', text: '▼ -2.1%', font: 'bold 18px Inter', x: 250, y: 240, color: '#ef4444', align: 'center' } },
      ],
    } as SceneDefinition,
    council: {
      width: 500,
      height: 700,
      background: { top: '#111827', bottom: '#030712' },
      nodes: [
        { id: 'council-title', kind: 'text', text: { id: 'council-title', text: 'AI Council', font: 'bold 32px Inter', x: 250, y: 70, color: '#a78bfa', align: 'center' } },
        { id: 'council-consensus', kind: 'text', text: { id: 'council-consensus', text: 'Consensus: 84%', font: 'bold 48px Inter', x: 250, y: 170, color: '#22c55e', align: 'center' }, motion: { kind: 'pulse', speed: 1.5 } },
        { id: 'council-status', kind: 'text', text: { id: 'council-status', text: '5 agents aligned • 1 dissenting note', font: '16px Inter', x: 250, y: 250, color: '#cbd5e1', align: 'center' } },
      ],
    } as SceneDefinition,
    ascii: {
      width: 500,
      height: 700,
      background: { top: '#07130a', bottom: '#020704' },
      nodes: [
        { id: 'ascii-title', kind: 'text', text: { id: 'ascii-title', text: 'ASCII SIGNAL', font: 'bold 28px monospace', x: 250, y: 60, color: '#22c55e', align: 'center' } },
        { id: 'ascii-core', kind: 'text', text: { id: 'ascii-core', text: '< PRETEXT >', font: 'bold 42px monospace', x: 250, y: 180, color: '#86efac', align: 'center' } },
        { id: 'ascii-noise', kind: 'text', text: { id: 'ascii-noise', text: '||||| //// \\\\ ---- +++++', font: '18px monospace', x: 250, y: 280, color: '#4ade80', align: 'center' }, motion: { kind: 'drift', amplitude: 10, speed: 1.2 } },
      ],
    } as SceneDefinition,
    glass: {
      width: 500,
      height: 800,
      background: { top: '#1e1040', bottom: '#0a0620' },
      nodes: [
        { id: 'glass-title', kind: 'text', text: { id: 'glass-title', text: 'LIQUID GLASS', font: 'bold 32px Inter', x: 250, y: 60, color: '#a78bfa', align: 'center' } },
        { id: 'glass-sub', kind: 'text', text: { id: 'glass-sub', text: 'Pretext × Canvas', font: '18px Inter', x: 250, y: 100, color: '#c4b5fd', align: 'center' } },
        { id: 'glass-panel1', kind: 'text', text: { id: 'glass-panel1', text: '◈  GENERATIVE UI', font: 'bold 20px Inter', x: 250, y: 250, color: '#ffffff', align: 'center' }, motion: { kind: 'pulse', speed: 1.6, amplitude: 5 } },
        { id: 'glass-panel2', kind: 'text', text: { id: 'glass-panel2', text: '◈  LAYOUT ENGINE', font: 'bold 20px Inter', x: 250, y: 400, color: '#ffffff', align: 'center' }, motion: { kind: 'pulse', speed: 1.3, amplitude: 5 } },
        { id: 'glass-panel3', kind: 'text', text: { id: 'glass-panel3', text: '◈  LIQUID GLASS', font: 'bold 20px Inter', x: 250, y: 550, color: '#ffffff', align: 'center' }, motion: { kind: 'pulse', speed: 2.0, amplitude: 5 } },
        { id: 'glass-badge', kind: 'text', text: { id: 'glass-badge', text: 'APPLE INSPIRED', font: 'bold 14px Inter', x: 250, y: 700, color: '#818cf8', align: 'center' } },
      ],
    } as SceneDefinition,
  }
}
