# 🖥️ Duck Agent Desktop UI — Design Preview

> **v0.4.0** — Native desktop application preview
> Status: **DESIGNED — NOT YET BUILT**

---

## Overview

Duck Agent v0.4.0 introduces a **native desktop application** built from `src/ui/desktop/`. The Desktop UI brings all of Duck Agent's capabilities into a native window with system tray integration, real-time dashboards, mesh visualization, and council deliberation panels.

**Key Principle (from Duckets):** *"I can't scroll to see everything"* — Screen-fit first. All content must fit on ONE screen without scrolling.

---

## Design Philosophy

### 1. Screen-Fit First
- All content fits on one screen — no scrolling required
- Compact fonts (temp: 52-72px max for large text)
- Tight padding (14-20px)
- Short text — abbreviate where possible
- Mobile-responsive (test on phone screens)

### 2. Native Desktop Feel
- System tray icon with quick actions
- Native window controls (close, minimize, maximize)
- Desktop notifications
- Keyboard shortcuts
- Auto-start on login option

### 3. Real-Time Everything
- Live agent status dashboard
- Real-time mesh network visualization
- Live council vote tallies
- Streaming chat output

### 4. Dark Mode Default
- Deep navy backgrounds
- Glowing accent colors
- Particle effects for visual flair

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│ [≡]  Duck Agent v0.4.0                          [_] [□] [×]        │
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
│ │             │ │                                                │ │
│ │ ─────────── │ │  ┌──────────────────────────────────────────┐  │ │
│ │ 🦆 DuckBot  │ │  │  QUICK ACTIONS BAR (collapsible)         │  │ │
│ │ Online ●   │ │  │  [Shell] [Mesh] [RL] [Council] [Cron]    │  │ │
│ └─────────────┘ │  └──────────────────────────────────────────┘  │ │
├─────────────────┴───────────────────────────────────────────────────┤
│ ● Mesh: connected  │ RL: enabled  │ Tokens: 42K  │ RAM: 234MB    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component List

### 1. Window Manager (`window.ts`)

**Purpose:** Native window with custom title bar

**Features:**
- Custom title bar with app name and version
- Window controls: minimize, maximize/restore, close
- Draggable title bar area
- Resizable window (min: 1024x768)
- Always-on-top toggle

**Keyboard Shortcuts:**
| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl+Q` | Quit |
| `Cmd/Ctrl+W` | Close window |
| `Cmd/Ctrl+M` | Minimize to tray |
| `Cmd/Ctrl+,` | Open settings |
| `Cmd/Ctrl+1-6` | Switch sidebar tabs |

---

### 2. System Tray (`tray.ts`)

**Purpose:** Background running with quick access menu

**Tray Icon States:**
| State | Icon | Description |
|-------|------|-------------|
| Online | 🦆 | Agent running normally |
| Busy | 🦆💭 | Processing task |
| Mesh | 🦆🌐 | Mesh message received |
| RL | 🦆🧪 | RL training active |
| Council | 🦆🏛️ | Council deliberation |
| Offline | 🦆💤 | Agent stopped |

**Tray Menu:**
```
┌─────────────────────────┐
│ 🦆 Duck Agent v0.4.0    │
├─────────────────────────┤
│ 💬 Open Chat            │
│ 📊 Dashboard            │
│ 🌐 Mesh Network         │
│ 🏛️ Council              │
├─────────────────────────┤
│ 🔔 Notifications   [●]  │
│ ⏰ Auto-start     [✓]   │
│ 📌 Always on Top [ ]   │
├─────────────────────────┤
│ ⚙️ Settings             │
│ ❌ Quit                  │
└─────────────────────────┘
```

---

### 3. Dashboard (`dashboard.ts`)

**Purpose:** Real-time agent metrics and status

**Layout (Screen-Fit):**
```
┌─────────────────────────────────────────────────────────────┐
│  📊 DASHBOARD                            Last updated: now  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │   CPU    │ │   RAM    │ │  TOKENS  │ │   COST   │    │
│  │   12%    │ │  234MB   │ │   42K    │ │  $0.023  │    │
│  │ ▓▓▓░░░░  │ │ ▓▓▓░░░░░ │ │ ▓▓▓░░░░░ │ │ ▓▓░░░░░░ │    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  PROVIDERS                                          │   │
│  │  ● MiniMax M2.7    42 requests   12ms avg           │   │
│  │  ● Kimi k2.5       8 requests    89ms avg            │   │
│  │  ● ChatGPT gpt-5.4  2 requests   234ms avg          │   │
│  │  ○ LM Studio       idle                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  SYSTEM STATUS                                       │   │
│  │  ● MCP Server      ✅ Port 3850                      │   │
│  │  ● Gateway API     ✅ Port 18792                     │   │
│  │  ● ACP Server      ✅ Port 18794                     │   │
│  │  ○ Agent Mesh      ○ Port 4000 (not running)        │   │
│  │  ○ OpenClaw-RL     ○ Port 30000 (not running)       │   │
│  │  ● KAIROS          ✅ Active (balanced mode)         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  RECENT ACTIVITY                                     │   │
│  │  • 18:35 — Completed "check grow tent"              │   │
│  │  • 18:32 — Mesh message from Agent Smith            │   │
│  │  • 18:30 — RL training batch complete (42 turns)    │   │
│  │  • 18:28 — Council deliberation started              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Real-Time Updates:**
- Metrics refresh every 5 seconds
- Provider status updates on request completion
- Activity log streams new entries

---

### 4. Chat Panel (`chat.ts`)

**Purpose:** Live chat interface with streaming output

**Layout (Screen-Fit):**
```
┌─────────────────────────────────────────────────────────────┐
│  💬 CHAT                               [Model: MiniMax M2.7] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🦆 DuckBot                          18:35            │   │
│  │ │                                                        │   │
│  │ │  How can I help you today?                            │   │
│  │ │                                                        │   │
│  │ └──────────────────────────────────────────────────────│   │
│  │                                                        │   │
│  │                          You            18:35          │   │
│  │                          │  Check the grow tent        │   │
│  │                          │                            │   │
│  │                          └─────────────────────────────│   │
│  │                                                        │   │
│  │ 🦆 DuckBot                          18:35            │   │
│  │ │  🌱 Grow Tent Status — 2026-03-31                  │   │
│  │ │                                                        │   │
│  │ │  Temp: 74.8°F  ✅ OK                                 │   │
│  │ │  Humidity: 39.4%  ✅ OK                              │   │
│  │ │  VPD: 1.78 kPa  ⚠️ Slightly high                    │   │
│  │ │  Camera: 📷 Last photo 5 min ago                    │   │
│  │ │                                                        │   │
│  │ │  💡 Tip: Lower VPD by increasing airflow            │   │
│  │ │                                                        │   │
│  │ └──────────────────────────────────────────────────────│   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ 💭 Thinking... ░░░░░░░░░░░░░░░░  18:35                │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Type your message...                            [Send] │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                             │
│  [KAIROS: balanced]  [Mesh: 3 agents]  [RL: enabled]       │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- Streaming output with typing indicator
- Markdown rendering (code blocks, bold, etc.)
- Copy message button
- Regenerate response
- Token count per message

---

### 5. Mesh Visualizer (`mesh-view.ts`)

**Purpose:** Visual representation of the agent mesh network

**Layout (Screen-Fit):**
```
┌─────────────────────────────────────────────────────────────┐
│  🌐 AGENT MESH                            [+ Register] [⟳]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│         ┌───────────────────────────────────────┐          │
│         │                                       │          │
│         │          🦆 Duck Agent                │          │
│         │          ● Online                    │          │
│         │          [coding, reasoning]         │          │
│         │                                       │          │
│         │        ┌─────────────┐                │          │
│         │        │     │       │                │          │
│         │        │  ───┼───    │                │          │
│         │        │     │       │                │          │
│         │        ▼         ▼    │                │          │
│         │   🤖 Smith    🔮 OpenClaw              │          │
│         │   ● Online   ● Online                 │          │
│         │   [coding,   [gateway,                │          │
│         │    windows]  skills]                 │          │
│         │                                       │          │
│         └───────────────────────────────────────┘          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  INBOX (2 new)                    [View All]        │   │
│  │  ───────────────────────────────────────────────────│   │
│  │  🤖 Smith: "Grow check done — all normal"     18:35  │   │
│  │  🔮 OpenClaw: "Sync request: 42 tasks"        18:30  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  CAPABILITIES MAP                                   │   │
│  │  ───────────────────────────────────────────────────│   │
│  │  coding      → Duck Agent, Agent Smith              │   │
│  │  reasoning   → Duck Agent, OpenClaw                 │   │
│  │  windows     → Agent Smith                          │   │
│  │  gateway     → OpenClaw                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- Interactive node graph (agents as nodes)
- Real-time status indicators
- Click node to see agent details
- Capability colors (coding=blue, reasoning=purple, etc.)
- Pulsing animation for active messages

---

### 6. Council Panel (`council-panel.ts`)

**Purpose:** Visual deliberation with 45 councilors

**Layout (Screen-Fit):**
```
┌─────────────────────────────────────────────────────────────┐
│  🏛️ AI COUNCIL                     Mode: [Legislative ▼]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  PROPOSAL                                           │   │
│  │  ───────────────────────────────────────────────────│   │
│  │  "Should we refactor the authentication module?"   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ACTIVE COUNCILORS (6 of 45)                        │   │
│  │  ───────────────────────────────────────────────────│   │
│  │  🎤 Speaker     Facilitator    Active    ●          │   │
│  │  🔬 Technocrat  Technical      Active    ●          │   │
│  │  ⚖️ Ethicist    Moral          Active    ●          │   │
│  │  🤔 Skeptic     Critical       Active    ●          │   │
│  │  🛡️ Sentinel   Risk           Active    ●          │   │
│  │  🎯 Pragmatist  Practical      Speaking  ●          │   │
│  │  [Show all 45 councilors ▼]                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  DELIBERATION                                       │   │
│  │  ───────────────────────────────────────────────────│   │
│  │  🔬 Technocrat: "Refactoring benefits: [1] cleaner │   │
│  │  code... [2] better security... [3] easier testing" │   │
│  │                                                       │   │
│  │  🤔 Skeptic: "Risks: [1] breaking changes... [2]   │   │
│  │  time investment... [3] potential regressions"      │   │
│  │                                                       │   │
│  │  ⚖️ Ethicist: "Consider: [1] user data handling...  │   │
│  │  [2] privacy implications... [3] consent flows"     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  VOTE TALLY                        [Approve] [Reject]│   │
│  │  ───────────────────────────────────────────────────│   │
│  │  Approve:  ████████░░  3  (Technocrat, Pragmatist,  │   │
│  │                           Historian)                  │   │
│  │  Reject:   ███░░░░░░░  1  (Skeptic)                  │   │
│  │  Abstain:  ██░░░░░░░░  2  (Ethicist, Sentinel)     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- Active councilor list (scrollable if needed)
- Real-time deliberation stream
- Live vote tallies with bar charts
- Councilor avatars (emoji-based)
- Mode selector dropdown
- "Summon more councilors" button

---

### 7. Quick Actions Bar

**Purpose:** Collapsible bar for common actions

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  [🦆 Shell] [🌐 Mesh] [🧪 RL] [🏛️ Council] [⏰ Cron] [📸 Cam] │
└─────────────────────────────────────────────────────────────┘
```

**Actions:**
| Button | Action |
|--------|--------|
| 🦆 Shell | Open new shell session |
| 🌐 Mesh | Open mesh inbox |
| 🧪 RL | Toggle RL training |
| 🏛️ Council | Start new deliberation |
| ⏰ Cron | Open cron manager |
| 📸 Cam | Take grow tent photo |

---

### 8. Notification Center

**Purpose:** System notifications and alerts

**Types:**
| Type | Icon | Color |
|------|------|-------|
| Info | ℹ️ | Blue |
| Success | ✅ | Green |
| Warning | ⚠️ | Yellow |
| Error | ❌ | Red |
| Mesh | 🌐 | Purple |
| RL | 🧪 | Orange |
| Council | 🏛️ | Gold |

**Notification Examples:**
```
┌─────────────────────────────────────────────────────────────┐
│  🌐 Mesh message from Agent Smith                     18:35 │
│  "Grow check complete — all systems normal"                 │
├─────────────────────────────────────────────────────────────┤
│  🧪 RL Training batch complete                        18:30 │
│  "42 turns trained • Avg reward: +0.73 • Loss: 0.12"       │
├─────────────────────────────────────────────────────────────┤
│  ⚠️ Token quota warning                               18:25 │
│  "MiniMax quota at 80% • 8,400 chars remaining today"      │
└─────────────────────────────────────────────────────────────┘
```

---

## Screenshot Placeholders

### Screenshot 1: Dashboard View
```
┌─────────────────────────────────────────────────────────────┐
│ [SCREENSHOT: Duck Agent Desktop UI - Dashboard View]        │
│                                                             │
│  Expected: Full dashboard with CPU/RAM/Tokens/Cost meters,  │
│  provider status list, system status, and activity feed     │
│                                                             │
│  Location after build: docs/screens/dashboard.png           │
└─────────────────────────────────────────────────────────────┘
```

### Screenshot 2: Chat Panel
```
┌─────────────────────────────────────────────────────────────┐
│ [SCREENSHOT: Duck Agent Desktop UI - Chat Panel]            │
│                                                             │
│  Expected: Chat window with streaming AI response,         │
│  message bubbles, input field, and status bar               │
│                                                             │
│  Location after build: docs/screens/chat.png                │
└─────────────────────────────────────────────────────────────┘
```

### Screenshot 3: Mesh Visualizer
```
┌─────────────────────────────────────────────────────────────┐
│ [SCREENSHOT: Duck Agent Desktop UI - Mesh Visualizer]      │
│                                                             │
│  Expected: Interactive node graph showing connected        │
│  agents with status indicators and capability labels        │
│                                                             │
│  Location after build: docs/screens/mesh.png                │
└─────────────────────────────────────────────────────────────┘
```

### Screenshot 4: Council Deliberation
```
┌─────────────────────────────────────────────────────────────┐
│ [SCREENSHOT: Duck Agent Desktop UI - Council Panel]         │
│                                                             │
│  Expected: Council deliberation with active councilors,     │
│  streaming deliberation text, and live vote tally           │
│                                                             │
│  Location after build: docs/screens/council.png             │
└─────────────────────────────────────────────────────────────┘
```

---

## Technical Implementation

### Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| **Framework** | Electron or Tauri | TBD — prefer Tauri for smaller binary |
| **UI** | Pretext + Canvas | Generative UI, no DOM overhead |
| **State** | Zustand | Lightweight state management |
| **IPC** | Native IPC | Main ↔ Renderer communication |
| **Tray** | Electron Tray / Tauri System Tray | Native system tray |
| **Notifications** | Native notifications API | Desktop notifications |

### Directory Structure

```
src/ui/desktop/
├── main.ts                 # Electron/Tauri main process
├── window.ts               # Window management
├── tray.ts                 # System tray
├── preload.ts              # Preload script (IPC bridge)
├── renderer/
│   ├── index.html          # Entry HTML
│   ├── index.ts            # Entry point
│   ├── styles/
│   │   └── main.css         # Global styles
│   ├── components/
│   │   ├── sidebar.ts       # Sidebar navigation
│   │   ├── dashboard.ts     # Stats dashboard
│   │   ├── chat.ts          # Chat panel
│   │   ├── mesh-view.ts     # Mesh visualizer
│   │   ├── council-panel.ts  # Council deliberation
│   │   ├── cron-manager.ts  # Cron job manager
│   │   ├── settings.ts      # Settings panel
│   │   └── notifications.ts # Notification center
│   ├── canvas/
│   │   ├── render.ts        # Canvas renderer
│   │   └── particles.ts      # Particle effects
│   └── stores/
│       ├── agent.ts         # Agent state
│       ├── mesh.ts          # Mesh state
│       ├── rl.ts            # RL state
│       └── council.ts       # Council state
└── assets/
    ├── icons/               # App icons
    └── fonts/              # Custom fonts
```

### Build Commands

```bash
# Development
npm run desktop:dev

# Build for current platform
npm run desktop:build

# Build for all platforms
npm run desktop:build:all
```

---

## Status

| Component | Status | Notes |
|-----------|--------|-------|
| **Design** | ✅ Complete | This document |
| **Implementation** | ⏳ Not Started | Coming in v0.4.0 |
| **Window Manager** | ⏳ Not Started | |
| **System Tray** | ⏳ Not Started | |
| **Dashboard** | ⏳ Not Started | |
| **Chat Panel** | ⏳ Not Started | |
| **Mesh Visualizer** | ⏳ Not Started | |
| **Council Panel** | ⏳ Not Started | |
| **Notifications** | ⏳ Not Started | |
| **Build System** | ⏳ Not Started | |

---

## Related Documentation

- [README.md](../README.md) — Main project readme
- [ARCHITECTURE.md](../ARCHITECTURE.md) — System architecture
- [COMMANDS.md](../COMMANDS.md) — CLI reference
- [UPDATES.md](../UPDATES.md) — Version history and roadmap

---

**Last Updated:** 2026-03-31  
**Version:** v0.3.2 (design), v0.4.0 (implementation target)
