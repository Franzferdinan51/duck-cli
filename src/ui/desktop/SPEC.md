# Duck Agent Desktop UI — Design Specification
## ✅ Status: RUNNABLE (2026-03-31)

**Run with:**
```bash
cd src/ui/desktop
npm install
npm run dev
```

**Build verified:** `npm run build` ✅ (271KB JS bundle, 1.9KB CSS)

---


## 🎨 Design Vision

Duck Agent Desktop is the flagship desktop shell for DuckBot — blending ClawX's clean desktop architecture, Open-WebUI Lobster Edition's generative UI smarts, and AI Council's multi-agent deliberation patterns into a single duck-themed command center.

**Feel:** Professional AI cockpit meets cozy duck pond. Dark, focused, powerful — with splashes of warm amber that feel like lantern light on water at dusk.

---

## 🎨 Color Palette

### Core Dark Theme

| Token | Hex | Use |
|-------|-----|-----|
| `--duck-bg-void` | `#07090f` | Deepest background (canvas, overlays) |
| `--duck-bg-deep` | `#0d1117` | Primary background |
| `--duck-bg-surface` | `#161b22` | Cards, panels, sidebar |
| `--duck-bg-elevated` | `#1c2333` | Modals, dropdowns, hover states |
| `--duck-bg-overlay` | `#21262d` | Toast, tooltips, popovers |
| `--duck-border` | `#30363d` | Borders, dividers |
| `--duck-border-muted` | `#21262d` | Subtle separators |

### Duck Brand Colors

| Token | Hex | Use |
|-------|-----|-----|
| `--duck-yellow` | `#fbbf24` | Primary accent (buttons, active states, DuckBot) |
| `--duck-yellow-dim` | `#d97706` | Secondary accent (hover, pressed) |
| `--duck-orange` | `#f97316` | Tertiary accent (warnings, heat indicators) |
| `--duck-red` | `#ef4444` | Errors, danger, stop actions |
| `--duck-green` | `#22c55e` | Success, online, connected |
| `--duck-cyan` | `#06b6d4` | Info, links, cool accents |
| `--duck-purple` | `#a855f7` | Special modes, specialist agents |

### Text

| Token | Hex | Use |
|-------|-----|-----|
| `--duck-text-primary` | `#e6edf3` | Primary text |
| `--duck-text-secondary` | `#8b949e` | Secondary text, labels |
| `--duck-text-muted` | `#484f58` | Placeholders, disabled |
| `--duck-text-inverse` | `#0d1117` | Text on yellow |

### Semantic

| Token | Hex | Use |
|-------|-----|-----|
| `--duck-vote-yea` | `#22c55e` | Council YEA votes |
| `--duck-vote-nay` | `#ef4444` | Council NAY votes |
| `--duck-heat-warm` | `#f97316` | High debate heat |
| `--duck-heat-cool` | `#06b6d4` | Low debate heat / peace |
| `--duck-online` | `#22c55e` | Agent online |
| `--duck-busy` | `#fbbf24` | Agent thinking |
| `--duck-offline` | `#484f58` | Agent offline |

---

## � Typing

### Font Stack

```
--font-display: 'Crimson Pro', Georgia, serif;   // Headings, council labels
--font-ui: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;  // UI chrome
--font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;          // Code, logs, metrics
```

### Scale

| Token | Size | Use |
|-------|------|-----|
| `--text-xs` | 11px | Micro labels, timestamps |
| `--text-sm` | 13px | Secondary text, metadata |
| `--text-base` | 15px | Body text |
| `--text-lg` | 17px | Subheadings |
| `--text-xl` | 20px | Panel titles |
| `--text-2xl` | 24px | Section headings |
| `--text-3xl` | 32px | Hero numbers (temperatures, scores) |

### Weights

- 400: Regular (body)
- 500: Medium (labels, UI)
- 600: Semibold (buttons, headings)
- 700: Bold (emphasis, DuckBot name)
- 800: Black (logo, splash)

---

## 📐 Spacing System

Base unit: **4px**

| Token | Value |
|-------|-------|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 20px |
| `--space-6` | 24px |
| `--space-8` | 32px |
| `--space-10` | 40px |
| `--space-12` | 48px |

### Border Radius

| Token | Value | Use |
|-------|-------|-----|
| `--radius-sm` | 4px | Tags, badges |
| `--radius-md` | 8px | Buttons, inputs |
| `--radius-lg` | 12px | Cards, panels |
| `--radius-xl` | 16px | Modals |
| `--radius-full` | 9999px | Pills, avatars |

---

## 🏗 Layout

### Shell Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ HEADER BAR (56px fixed)                                       │
│ [🦆 DuckBot] [Panel Tabs] ─────────────── [Status] [Settings] │
├────────────┬─────────────────────────────────────────────────┤
│            │                                                   │
│  SIDEBAR   │           MAIN PANEL                            │
│  (240px)   │           (flex-1)                              │
│            │                                                   │
│  • Chat    │  [Active panel content]                         │
│  • KAIROS  │                                                   │
│  • Council │                                                   │
│  • Mesh    │                                                   │
│  • RL      │                                                   │
│  • Settings│                                                   │
│            │                                                   │
├────────────┴─────────────────────────────────────────────────┤
│ STATUS BAR (32px fixed) — Gateway, model, session info         │
└──────────────────────────────────────────────────────────────┘
```

### Panel Navigation

Sidebar tabs (icon + label) with active indicator (left yellow bar + bg tint).

### Responsive Breakpoints

| Breakpoint | Behavior |
|------------|----------|
| `< 768px` | Sidebar collapses to bottom nav bar |
| `768px – 1024px` | Sidebar 200px, compact labels |
| `> 1024px` | Full sidebar 240px |

---

## 🧩 Component Library

### DuckButton

**Variants:** `primary` | `secondary` | `ghost` | `danger`
**Sizes:** `sm` | `md` | `lg`

```tsx
// Primary: Yellow bg, dark text, hover darken
// Secondary: Border only, yellow text, hover fill
// Ghost: No border, text only, hover bg tint
// Danger: Red bg, white text
```

**States:** default, hover (scale 1.02, brightness), active (scale 0.98), disabled (opacity 0.4), loading (spinner replaces icon)

### DuckCard

Dark surface (`--duck-bg-surface`) with `--duck-border` border, `12px` radius. Hover: subtle glow with `--duck-yellow` at 5% opacity.

### DuckInput

Dark bg (`--duck-bg-deep`), `--duck-border` border, yellow focus ring. Placeholder in `--duck-text-muted`.

### DuckModal

Backdrop blur overlay, centered card with `--radius-xl`, slide-up entrance animation (200ms ease-out).

### CouncilorBadge

Pill with gradient border matching bot color. Shows: color dot (online/think), name, role label. Click → private counsel.

### VotePanel

Shows YEA/NAY bars with animated fill, consensus score as large number, result badge (PASSED/REJECTED).

### MeshNodeCard

Avatar circle with agent color, name, status indicator, latency badge. Connected by animated SVG lines in mesh visualization.

### StatusIndicator

Dot + label: 🟢 Online | 🟡 Thinking | 🔴 Error | ⚫ Offline

### Toast

Bottom-right stack, auto-dismiss 4s, slide-in from right. Variants: info, success, warning, error.

---

## 🎬 Animations & Transitions

### Entrance

- Panels: fade-in + translateY(8px) → 0, 200ms ease-out
- Cards: staggered 50ms delay between items
- Modals: scale(0.95) → scale(1) + fade, 200ms

### Micro-interactions

- Button hover: `transform: scale(1.02)`, 100ms
- Button active: `transform: scale(0.98)`, 50ms
- Card hover: box-shadow glow yellow 10%, 150ms
- Sidebar tab active: left border slide-in 150ms

### Continuous

- Thinking indicator: pulsing amber ring, 1.5s infinite
- Debate heat: animated gradient bar shift
- Mesh lines: SVG stroke-dashoffset animation
- Live badge: ping animation (scale + fade)

### Easing

```
--ease-out: cubic-bezier(0.16, 1, 0.3, 1)
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1)
--spring: cubic-bezier(0.34, 1.56, 0.64, 1)
```

---

## 🔄 State Patterns

### Loading

- Skeleton shimmer (dark wave animation) replacing content
- Spinner for buttons/actions
- Amber pulsing dots for councilor thinking

### Error

- Red border + icon on failed elements
- Inline error message below input
- Toast for transient errors
- Retry button where applicable

### Empty

- Centered illustration (duck silhouette)
- Contextual empty state message
- Primary CTA button

### Success

- Brief green flash on affected element
- Toast notification
- Auto-dismiss 3s

### Streaming

- Amber typing cursor blink in message
- Message content appears character-by-character
- Councilor avatar pulses while thinking

---

## 🎨 Design Principles

1. **Duck first**: Every panel should feel like it belongs to DuckBot — warm, intelligent, approachable
2. **Dark is primary**: Like ClawX, dark is the default and only mode — optimized for long sessions
3. **Depth through layering**: Multiple surface levels (bg → surface → elevated) create spatial hierarchy
4. **Yellow is signal**: Use `--duck-yellow` only for actionable/active elements — not decoration
5. **Generative when smart**: AI-generated content cards, charts, and forms via the Generative UI layer
6. **Motion with meaning**: Every animation communicates state — not just aesthetics
7. **Mobile-aware**: Touch targets 44px minimum, collapsible sidebar, bottom nav on small screens
8. **Real-time everywhere**: WebSocket indicators, live status, streaming messages, mesh pulse

---

## 🔌 API Integration Points

| Panel | Data Source |
|-------|-------------|
| Chat | OpenClaw Gateway WS `/v1/chat` |
| KAIROS | OpenClaw Gateway `/openclaw/api/kairos/*` |
| Council | AI Council service `/council/api/*` |
| Mesh | Agent Mesh API `/agent-mesh/api/mesh/*` |
| RL | OpenClaw-RL `/rl/api/*` |
| Settings | OpenClaw config sync |

---

## 📁 File Structure

```
src/ui/desktop/
├── SPEC.md
├── main-view.ts          # App shell, routing, global state
├── chat-panel.ts          # Chat interface
├── kairos-panel.ts        # KAIROS control panel
├── council-panel.ts        # AI Council deliberation
├── settings-panel.ts       # Configuration
├── mesh-panel.ts          # Agent Mesh visualization
├── rl-panel.ts            # OpenClaw-RL status
└── components/
    ├── duck-button.ts
    ├── duck-card.ts
    ├── duck-input.ts
    ├── duck-modal.ts
    ├── status-indicator.ts
    ├── toast.ts
    ├── councilor-badge.ts
    ├── vote-panel.ts
    └── mesh-node-card.ts
```
