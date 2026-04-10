# 🖥️ Duck Agent Desktop UI — v2.0.0

> **Duck Agent v2.0.0** — Native desktop application — NOW RUNNABLE
> Status: **✅ RUNNABLE** — Vite + React + CopilotKit + Pretext Canvas

---

## Overview

**v2.0.0 keeps the Desktop UI fully runnable.** Built from `src/ui/desktop/`, this is a Vite + React 19 + TypeScript application with CopilotKit chat and Pretext Canvas generative UI.

```bash
cd src/ui/desktop
npm install
npm run dev
# Serves on http://localhost:5173
```

**Key Principle (from Duckets):** *"I can't scroll to see everything"* — Screen-fit first. All content must fit on ONE screen without scrolling.

---

## Running the Desktop UI

### Quick Start

```bash
cd src/ui/desktop
npm install     # Only needed once
npm run dev     # Development server (port 5173)
npm run build  # Production build
npm run preview # Preview production build
```

### Port Notes

- Desktop UI: **5173** — won't conflict with Web UI (3001) or Gateway (18792)
- If port 5173 is busy, Vite auto-selects next available

---

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Build Tool** | Vite | 6.3.5 |
| **UI Framework** | React | 19.2.4 |
| **Language** | TypeScript | 5.8.3 |
| **Styling** | Tailwind CSS | 3.4.17 |
| **Chat** | CopilotKit | 1.54.1 |
| **Text Measurement** | Pretext (@chenglou/pretext) | 0.0.3 |
| **Canvas** | Native Canvas API | — |

---

## What's Built

### ✅ Chat Interface (CopilotKit)
- Streaming AI responses via `@copilotkit/react-core`
- Chat sidebar with `@copilotkit/react-ui`
- Markdown rendering (code blocks, bold, etc.)
- Typing indicators

### ✅ Pretext Canvas Toolkit
- Character-level text measurement via `@chenglou/pretext`
- Canvas-rendered generative UI components
- GPU-accelerated animations

### ✅ Tailwind CSS Layout
- Dark theme (deep navy backgrounds)
- Glowing accent colors
- Responsive grid layout
- Screen-fit design (no scroll on single view)

### ✅ Component Structure

```
src/ui/desktop/
├── main.tsx              # React entry point
├── App.tsx               # Root component
├── index.html            # Entry HTML
├── vite.config.ts        # Vite configuration
├── tailwind.config.js    # Tailwind theme
├── postcss.config.js     # PostCSS config
├── tsconfig.json         # TypeScript config
├── package.json          # Dependencies
├── SPEC.md               # Design specification
└── assets/               # Static assets
```

---

## Pretext Canvas — How It Works

### Text Measurement Pattern

```js
import { prepare, layout, prepareWithSegments, layoutWithLines } from '@chenglou/pretext'

// Prepare text at specific font
const prepared = prepare('Hello World', 'bold 48px Inter')

// Layout with line wrapping
const { height, lines } = layout(prepared, 400, 32)

// Render on canvas at exact positions
lines.forEach(line => {
  ctx.fillText(line.text, x, y + line.y)
})
```

### Canvas Generative UI

| Component | Description |
|-----------|-------------|
| **Metrics Cards** | CPU, RAM, Tokens, Cost — bar gauges on canvas |
| **Streaming Text** | Pre-measured text blocks flow into view |
| **Vote Bars** | Approval/rejection bars with animated fill |
| **Particle Effects** | Background particles, stars, aurora waves |
| **Weather Cards** | Animated weather with bouncing icons |

---

## CopilotKit Integration

### Provider Setup

```tsx
import { CopilotKit } from '@copilotkit/react-core'
import { CopilotSidebar } from '@copilotkit/react-ui'

function App() {
  return (
    <CopilotKit
      runtimeUrl="/api/copilot"
      chatApiUrl="/api/copilot/chat"
    >
      <YourLayout>
        <CopilotSidebar
          instructions="You are DuckBot — helpful, casual, never corporate."
          showPoweredBy={false}
        />
      </YourLayout>
    </CopilotKit>
  )
}
```

### Shared State

```tsx
const [context, setContext] = useState({
  kairosMode: 'balanced',
  meshStatus: 'offline',
  tokenCount: 0
})

// Agent updates context
agent.updateContext({ meshStatus: 'connected', agents: 3 })

// UI reactively updates
{context.meshStatus === 'connected' && <MeshIndicator agents={context.agents} />}
```

### Human-in-the-Loop

```tsx
// Surface interactive controls during conversation
<KAIROSModes
  modes={['aggressive', 'balanced', 'conservative']}
  active={context.kairosMode}
  onSelect={(mode) => agent.updateContext({ kairosMode: mode })}
/>
```

---

## Design Philosophy

### Screen-Fit First
- All content fits on one screen — no scrolling
- Compact fonts (temp: 52-72px max for large text)
- Tight padding (14-20px)
- Short text — abbreviate where possible

### Native Desktop Feel
- System tray integration (planned)
- Desktop notifications (planned)
- Keyboard shortcuts (planned)

### Real-Time Everything
- Live agent status dashboard
- Streaming chat output
- Canvas-rendered metrics

### Dark Mode Default
- Deep navy backgrounds
- Glowing accent colors
- Particle effects

---

## Planned Components

| Component | Status | Notes |
|-----------|--------|-------|
| Chat Interface | ✅ Built | CopilotKit streaming |
| Dashboard | ✅ Built | Canvas metrics |
| Sidebar Nav | ✅ Built | Tailwind layout |
| Pretext Canvas | ✅ Built | Text measurement |
| System Tray | ⏳ Planned | |
| Mesh Visualizer | ⏳ Planned | |
| Council Panel | ⏳ Planned | Vote tally canvas |
| Notifications | ⏳ Planned | |

---

## Build Verification

```bash
cd src/ui/desktop
npm run build
# Output: dist/ with production build
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│ [≡]  Duck Agent v2.0.0                          [_] [□] [×]        │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌───────────────────────────────────────────────┐ │
│ │   SIDEBAR   │ │              MAIN CONTENT AREA                   │ │
│ │             │ │                                                │ │
│ │  🏠 Home    │ │  ┌──────────────────────────────────────────┐  │ │
│ │  💬 Chat    │ │  │  DASHBOARD / CHAT / MESH / COUNCIL      │  │ │
│ │  📊 Stats   │ │  │                                           │  │ │
│ │  🌐 Mesh    │ │  │  Content changes based on sidebar        │  │ │
│ │  🏛️ Council │ │  │  selection. All content SCREEN-FIT.       │  │ │
│ │  ⏰ Cron    │ │  │                                           │  │ │
│ │  ⚙️ Settings│ │  │                                           │  │ │
│ │             │ │  └──────────────────────────────────────────┘  │ │
│ │ ─────────── │ │                                                │ │
│ │ 🦆 DuckBot  │ │  ┌──────────────────────────────────────────┐  │ │
│ │ Online ●   │ │  │  QUICK ACTIONS BAR                       │  │ │
│ └─────────────┘ │  └──────────────────────────────────────────┘  │ │
├─────────────────┴───────────────────────────────────────────────────┤
│ ● Mesh: connected  │ RL: enabled  │ Tokens: 42K  │ RAM: 234MB    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Related Documentation

- [README.md](../README.md) — Main project readme
- [ARCHITECTURE.md](../ARCHITECTURE.md) — System architecture
- [COMMANDS.md](../COMMANDS.md) — CLI reference
- [UPDATES.md](../UPDATES.md) — Version history and roadmap

---

**Last Updated:** 2026-03-31
**Version:** v2.0.0 — **RUNNABLE**
