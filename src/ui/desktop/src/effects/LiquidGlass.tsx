/**
 * LiquidGlass Effect — Apple-inspired glassmorphism for Canvas/HTML
 * Subtle translucency, specular highlights, refraction shimmer
 * Works with Pretext scene engine output
 */

export type LiquidGlassConfig = {
  x: number
  y: number
  width: number
  height: number
  radius?: number
  blur?: number
  opacity?: number
  borderWidth?: number
  borderOpacity?: number
  highlightTop?: boolean
  shimmerPhase?: number
  tint?: { r: number; g: number; b: number }
}

const DEFAULT_TINT = { r: 200, g: 210, b: 255 }

/**
 * Draw a liquid-glass rectangle on a Canvas 2D context
 * Apple-style: translucent fill + top specular highlight + subtle border + optional shimmer
 */
export function drawLiquidGlass(
  ctx: CanvasRenderingContext2D,
  cfg: LiquidGlassConfig
) {
  const {
    x, y, width, height,
    radius = 16,
    blur = 20,
    opacity = 0.12,
    borderWidth = 1,
    borderOpacity = 0.25,
    highlightTop = true,
    shimmerPhase = 0,
    tint = DEFAULT_TINT,
  } = cfg

  const innerX = x + borderWidth
  const innerY = y + borderWidth
  const innerW = width - borderWidth * 2
  const innerH = height - borderWidth * 2
  const innerR = radius - borderWidth

  ctx.save()

  // --- clip to rounded rect ---
  ctx.beginPath()
  ctx.moveTo(innerX + innerR, innerY)
  ctx.lineTo(innerX + innerW - innerR, innerY)
  ctx.quadraticCurveTo(innerX + innerW, innerY, innerX + innerW, innerY + innerR)
  ctx.lineTo(innerX + innerW, innerY + innerH - innerR)
  ctx.quadraticCurveTo(innerX + innerW, innerY + innerH, innerX + innerW - innerR, innerY + innerH)
  ctx.lineTo(innerX + innerR, innerY + innerH)
  ctx.quadraticCurveTo(innerX, innerY + innerH, innerX, innerY + innerH - innerR)
  ctx.lineTo(innerX, innerY + innerR)
  ctx.quadraticCurveTo(innerX, innerY, innerX + innerR, innerY)
  ctx.closePath()
  ctx.clip()

  // --- blurred translucent fill ---
  ctx.filter = `blur(${blur}px)`
  ctx.fillStyle = `rgba(${tint.r}, ${tint.g}, ${tint.b}, ${opacity})`
  ctx.fillRect(innerX, innerY, innerW, innerH)
  ctx.filter = 'none'

  // --- top specular highlight (bright streak) ---
  if (highlightTop) {
    const grad = ctx.createLinearGradient(innerX, innerY, innerX, innerY + innerH * 0.4)
    grad.addColorStop(0, `rgba(255, 255, 255, ${opacity * 1.8})`)
    grad.addColorStop(0.4, `rgba(255, 255, 255, ${opacity * 0.4})`)
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = grad
    ctx.fillRect(innerX, innerY, innerW, innerH * 0.4)
  }

  // --- animated shimmer streak ---
  if (shimmerPhase !== undefined) {
    const shimmerW = innerW * 0.3
    const shimmerX = innerX + ((shimmerPhase % 1) * (innerW + shimmerW)) - shimmerW
    const shimmerGrad = ctx.createLinearGradient(shimmerX, innerY, shimmerX + shimmerW, innerY + innerH * 0.3)
    shimmerGrad.addColorStop(0, 'rgba(255, 255, 255, 0)')
    shimmerGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.35)')
    shimmerGrad.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = shimmerGrad
    ctx.fillRect(shimmerX, innerY, shimmerW, innerH * 0.3)
  }

  ctx.restore()

  // --- outer border ---
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
  ctx.strokeStyle = `rgba(${tint.r + 30}, ${tint.g + 30}, ${tint.b + 30}, ${borderOpacity})`
  ctx.lineWidth = borderWidth
  ctx.stroke()
  ctx.restore()
}

/**
 * HTML/CSS liquid glass — use as overlay div or via backdrop-filter
 */
export const liquidGlassCSS = (cfg: {
  blur?: number
  opacity?: number
  bg?: string
  border?: string
  radius?: number
} = {}) => `
  background: ${cfg.bg ?? `rgba(200, 210, 255, 0.08)`};
  backdrop-filter: blur(${cfg.blur ?? 20}px);
  -webkit-backdrop-filter: blur(${cfg.blur ?? 20}px);
  border: 1px solid rgba(200, 210, 255, ${cfg.opacity ?? 0.2});
  border-radius: ${cfg.radius ?? 16}px;
`

/**
 * Animated shimmer canvas overlay — call each frame with a time value
 */
export function drawShimmerOverlay(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  width: number, height: number,
  time: number
) {
  const shimmerW = width * 0.25
  const shimmerX = x + ((time * 0.3 % 1) * (width + shimmerW)) - shimmerW
  const grad = ctx.createLinearGradient(shimmerX, y, shimmerX + shimmerW, y + height * 0.35)
  grad.addColorStop(0, 'rgba(255, 255, 255, 0)')
  grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.28)')
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = grad
  ctx.fillRect(shimmerX, y, shimmerW, height * 0.35)
}
