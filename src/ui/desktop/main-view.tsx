/**
 * Duck Agent Desktop — Main Application Shell
 *
 * Top-level component: renders the full desktop layout with sidebar navigation,
 * active panel content, header bar, and status bar.
 *
 * Design basis: ClawX dark desktop shell + AI Council panel routing + Lobster Edition generative UI
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import ChatPanel from './chat-panel';
import KairosPanel from './kairos-panel';
import CouncilPanel from './council-panel';
import SettingsPanel from './settings-panel';
import MeshPanel from './mesh-panel';
import RlPanel from './rl-panel';
import { DuckButton } from './components/duck-button';
import { DuckModal } from './components/duck-modal';
import { ToastContainer, useToast } from './components/toast';

// ─── Types ───────────────────────────────────────────────────────────────────

type PanelId = 'chat' | 'kairos' | 'council' | 'mesh' | 'rl' | 'settings';

interface NavItem {
  id: PanelId;
  label: string;
  icon: string; // emoji or SVG path
  badge?: number | string;
}

interface GatewayStatus {
  connected: boolean;
  url: string;
  latency: number; // ms
  version: string;
}

interface SessionInfo {
  active: boolean;
  agentCount: number;
  messageCount: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'kairos', label: 'KAIROS', icon: '⏱️' },
  { id: 'council', label: 'Council', icon: '⚖️', badge: 0 },
  { id: 'mesh', label: 'Agent Mesh', icon: '🕸️' },
  { id: 'rl', label: 'RL Status', icon: '🧠' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

const HEADER_LINKS = [
  { label: 'Docs', href: 'http://localhost:18789/docs' },
  { label: 'Gateway', href: 'http://localhost:18789' },
  { label: 'Agent Monitor', href: 'http://localhost:3001' },
];

// ─── Default Props ───────────────────────────────────────────────────────────

const DEFAULT_GATEWAY: GatewayStatus = {
  connected: false,
  url: 'ws://localhost:18789',
  latency: 0,
  version: '—',
};

const DEFAULT_SESSION: SessionInfo = {
  active: false,
  agentCount: 0,
  messageCount: 0,
};

// ─── Component ───────────────────────────────────────────────────────────────

const DuckDesktop: React.FC = () => {
  // ── Navigation State ──────────────────────────────────────────────────────
  const [activePanel, setActivePanel] = useState<PanelId>('chat');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // ── Gateway State ─────────────────────────────────────────────────────────
  const [gateway, setGateway] = useState<GatewayStatus>(DEFAULT_GATEWAY);
  const [session, setSession] = useState<SessionInfo>(DEFAULT_SESSION);

  // ── Modals ────────────────────────────────────────────────────────────────
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);

  // ── Toast ────────────────────────────────────────────────────────────────
  const { toasts, addToast, removeToast } = useToast();

  // ── Refs ────────────────────────────────────────────────────────────────
  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Gateway Connection ───────────────────────────────────────────────────
  const connectGateway = useCallback(() => {
    try {
      const ws = new WebSocket('ws://localhost:18789');

      ws.onopen = () => {
        setGateway(prev => ({ ...prev, connected: true }));
        addToast({ type: 'success', message: '🦆 Gateway connected' });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'pong') {
            setGateway(prev => ({ ...prev, latency: Date.now() - (data.timestamp ?? Date.now()) }));
          }
          if (data.type === 'session_update') {
            setSession(data.session);
          }
        } catch { /* ignore non-JSON */ }
      };

      ws.onerror = () => {
        addToast({ type: 'error', message: 'Gateway connection error' });
      };

      ws.onclose = () => {
        setGateway(prev => ({ ...prev, connected: false }));
        wsRef.current = null;
        // Reconnect after 3s
        setTimeout(connectGateway, 3000);
      };

      wsRef.current = ws;
    } catch {
      setGateway(prev => ({ ...prev, connected: false }));
    }
  }, [addToast]);

  useEffect(() => {
    connectGateway();

    // Ping every 10s to measure latency
    pingIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    }, 10000);

    return () => {
      wsRef.current?.close();
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };
  }, [connectGateway]);

  // ── Keyboard Shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShortcutsModalOpen(false);
        setAboutModalOpen(false);
        setMobileNavOpen(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setActivePanel('chat');
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        setShortcutsModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // ── Render Panel ─────────────────────────────────────────────────────────
  const renderPanel = () => {
    const props = { addToast, gateway, session, setSession };

    switch (activePanel) {
      case 'chat':     return <ChatPanel {...props} />;
      case 'kairos':   return <KairosPanel {...props} />;
      case 'council':  return <CouncilPanel {...props} />;
      case 'mesh':     return <MeshPanel {...props} />;
      case 'rl':       return <RlPanel {...props} />;
      case 'settings':  return <SettingsPanel {...props} />;
      default:         return <ChatPanel {...props} />;
    }
  };

  // ── Gateway Status Dot ───────────────────────────────────────────────────
  const statusDot = gateway.connected
    ? { color: 'bg-[#22c55e]', label: `Online ${gateway.latency}ms`, pulse: false }
    : { color: 'bg-[#ef4444]', label: 'Disconnected', pulse: true };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="duck-desktop root-0 w-full h-full bg-[#0d1117] text-[#e6edf3] font-ui overflow-hidden"
         style={{ fontFamily: 'var(--font-ui, Inter, sans-serif)' }}>

      {/* ── Header Bar ───────────────────────────────────────────────────── */}
      <header className="duck-header fixed top-0 left-0 right-0 z-30 h-14 bg-[#161b22] border-b border-[#30363d]
                        flex items-center px-4 gap-4 shrink-0">

        {/* Duck Logo */}
        <button
          onClick={() => { setActivePanel('chat'); setAboutModalOpen(true); }}
          className="flex items-center gap-2 group select-none"
        >
          <div className="w-8 h-8 rounded-lg bg-[#fbbf24] flex items-center justify-center text-lg font-black text-[#0d1117] group-hover:scale-105 transition-transform">
            🦆
          </div>
          <span className="text-[#fbbf24] font-bold text-sm tracking-wide hidden md:block group-hover:text-[#fbbf24] transition-colors"
                style={{ fontFamily: 'var(--font-display, Crimson Pro, serif)' }}>
            DuckBot
          </span>
        </button>

        {/* Separator */}
        <div className="w-px h-6 bg-[#30363d] hidden md:block" />

        {/* Quick Links */}
        <div className="hidden lg:flex items-center gap-3">
          {HEADER_LINKS.map(link => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#8b949e] hover:text-[#e6edf3] text-xs font-medium transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Gateway Status */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${statusDot.color} ${statusDot.pulse ? 'animate-ping' : ''}`} />
            <span className="text-xs text-[#8b949e] hidden sm:block">{statusDot.label}</span>
            <span className="text-xs text-[#8b949e] sm:hidden">{gateway.connected ? '🟢' : '🔴'}</span>
          </div>
        </div>

        {/* Keyboard Shortcuts Button */}
        <button
          onClick={() => setShortcutsModalOpen(true)}
          className="p-2 rounded-md hover:bg-[#21262d] text-[#8b949e] hover:text-[#e6edf3] transition-colors"
          title="Keyboard Shortcuts (Ctrl+Shift+S)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h.001M12 12h.001M16 12h.001M7 16h10" />
          </svg>
        </button>

        {/* Settings shortcut */}
        <button
          onClick={() => setActivePanel('settings')}
          className="p-2 rounded-md hover:bg-[#21262d] text-[#8b949e] hover:text-[#e6edf3] transition-colors"
          title="Settings"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
          </svg>
        </button>
      </header>

      {/* ── Body (Sidebar + Panel) ─────────────────────────────────────────── */}
      <div className="duck-body flex h-full pt-14">

        {/* Desktop Sidebar */}
        <aside className={`
          hidden md:flex flex-col shrink-0 bg-[#161b22] border-r border-[#30363d]
          transition-all duration-200 ease-out
          ${sidebarCollapsed ? 'w-16' : 'w-60'}
        `}>

          {/* Nav Items */}
          <nav className="flex-1 py-3 space-y-0.5 px-2">
            {NAV_ITEMS.map(item => {
              const isActive = activePanel === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActivePanel(item.id)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150
                    relative group
                    ${isActive
                      ? 'bg-[#1c2333] text-[#fbbf24]'
                      : 'text-[#8b949e] hover:bg-[#1c2333] hover:text-[#e6edf3]'
                    }
                  `}
                >
                  {/* Active left bar */}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#fbbf24] rounded-r" />
                  )}

                  <span className="text-base">{item.icon}</span>

                  {!sidebarCollapsed && (
                    <span className="text-sm font-medium flex-1 text-left">{item.label}</span>
                  )}

                  {!sidebarCollapsed && item.badge !== undefined && (
                    <span className="text-[10px] bg-[#fbbf24] text-[#0d1117] font-bold px-1.5 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-3 border-t border-[#30363d]">
            {!sidebarCollapsed ? (
              <div className="space-y-2">
                <div className="text-[10px] text-[#484f58] uppercase tracking-wider">Session</div>
                <div className="flex items-center gap-2 text-xs text-[#8b949e]">
                  <span>Agents</span>
                  <span className="text-[#fbbf24] font-mono">{session.agentCount}</span>
                  <span className="text-[#484f58]">·</span>
                  <span>Msgs</span>
                  <span className="text-[#fbbf24] font-mono">{session.messageCount}</span>
                </div>
                <button
                  onClick={() => setSidebarCollapsed(true)}
                  className="w-full text-xs text-[#484f58] hover:text-[#8b949e] transition-colors py-1"
                >
                  ← Collapse
                </button>
              </div>
            ) : (
              <button
                onClick={() => setSidebarCollapsed(false)}
                className="w-full text-xs text-[#484f58] hover:text-[#8b949e] transition-colors py-2 text-center"
                title="Expand sidebar"
              >
                →
              </button>
            )}
          </div>
        </aside>

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#161b22] border-t border-[#30363d] flex items-center justify-around h-16 px-2">
          {NAV_ITEMS.slice(0, 5).map(item => {
            const isActive = activePanel === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActivePanel(item.id); setMobileNavOpen(false); }}
                className={`
                  flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors
                  ${isActive ? 'text-[#fbbf24]' : 'text-[#8b949e]'}
                `}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* ── Main Panel ──────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-hidden relative pb-16 md:pb-0">
          <div className="absolute inset-0 overflow-y-auto">
            {/* Panel entrance animation */}
            <div
              key={activePanel}
              className="animate-panel-enter min-h-full"
            >
              {renderPanel()}
            </div>
          </div>
        </main>
      </div>

      {/* ── Status Bar ─────────────────────────────────────────────────────── */}
      <footer className="duck-status fixed bottom-0 md:bottom-unset md:top-14 right-0 w-full md:w-60
                        h-8 bg-[#161b22] border-t md:border-t-0 md:border-b border-[#30363d]
                        flex items-center px-4 gap-4 text-[10px] text-[#484f58]
                        shrink-0 z-20 hidden lg:flex">

        <div className="flex items-center gap-1.5">
          <span className="text-[#fbbf24] font-bold" style={{ fontFamily: 'var(--font-display)' }}>🦆</span>
          <span>DuckBot</span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-3">
          <span className="font-mono">{gateway.version || 'v—'}</span>
          <span className="text-[#30363d]">|</span>
          <span className="font-mono">{gateway.url.replace('ws://', '')}</span>
        </div>
      </footer>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {shortcutsModalOpen && (
        <DuckModal
          title="Keyboard Shortcuts"
          onClose={() => setShortcutsModalOpen(false)}
        >
          <div className="space-y-3 text-sm">
            {[
              { keys: '⌘ K', action: 'Go to Chat' },
              { keys: '⌘ ⇧ S', action: 'Shortcuts panel' },
              { keys: 'Esc', action: 'Close modal' },
              { keys: '↑ / ↓', action: 'Navigate history' },
              { keys: 'Enter', action: 'Send message' },
            ].map(({ keys, action }) => (
              <div key={keys} className="flex justify-between items-center">
                <span className="text-[#8b949e]">{action}</span>
                <kbd className="bg-[#21262d] border border-[#30363d] text-[#e6edf3] px-2 py-1 rounded text-xs font-mono">
                  {keys}
                </kbd>
              </div>
            ))}
          </div>
        </DuckModal>
      )}

      {aboutModalOpen && (
        <DuckModal
          title="About DuckBot"
          onClose={() => setAboutModalOpen(false)}
        >
          <div className="text-center space-y-4">
            <div className="text-5xl">🦆</div>
            <div>
              <h2 className="text-xl font-bold text-[#fbbf24]" style={{ fontFamily: 'var(--font-display)' }}>
                DuckBot Desktop
              </h2>
              <p className="text-[#8b949e] text-sm mt-1">Your AI command center</p>
            </div>
            <div className="bg-[#0d1117] rounded-lg p-3 text-xs font-mono text-[#8b949e] space-y-1">
              <div>Gateway: {gateway.url}</div>
              <div>Status: {gateway.connected ? '🟢 Connected' : '🔴 Disconnected'}</div>
              <div>Latency: {gateway.latency}ms</div>
            </div>
            <p className="text-[10px] text-[#484f58]">
              Powered by OpenClaw · Built with 💛
            </p>
          </div>
        </DuckModal>
      )}

      {/* Toast Stack */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
};

// ─── Styles (injected) ───────────────────────────────────────────────────────

const _styles = `
@keyframes panel-enter {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-panel-enter {
  animation: panel-enter 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
`;

// Inject styles once
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = _styles;
  document.head.appendChild(style);
}

export default DuckDesktop;
