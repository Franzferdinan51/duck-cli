/**
 * Duck Agent Desktop — AI Council Panel
 *
 * Multi-agent deliberation interface with councilor deck,
 * voting, debate heat visualization, and consensus scoring.
 *
 * Design patterns borrowed from: AI-Bot-Council-Concensus
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { DuckButton } from './components/duck-button';
import { DuckInput } from './components/duck-input';
import { DuckCard } from './components/duck-card';
import { VotePanel } from './components/vote-panel';
import { CouncilorBadge } from './components/councilor-badge';

// ─── Types ───────────────────────────────────────────────────────────────────

type SessionMode = 'proposal' | 'deliberation' | 'inquiry' | 'research' | 'swarm' | 'swarm_coding' | 'prediction';
type SessionStatus = 'IDLE' | 'OPENING' | 'DEBATING' | 'VOTING' | 'RESOLVING' | 'ADJOURNED' | 'PAUSED';

interface Councilor {
  id: string;
  name: string;
  role: 'speaker' | 'moderator' | 'councilor' | 'specialist' | 'sentinel';
  color: string; // gradient string like 'from-amber-500 to-orange-600'
  model: string;
  persona: string;
  enabled: boolean;
  thinking?: boolean;
}

interface Message {
  id: string;
  author: string;
  authorType: 'HUMAN' | 'GEMINI' | 'SYSTEM' | 'LMSTUDIO';
  content: string;
  thinking?: string;
  roleLabel?: string;
  color?: string;
  voteData?: VoteData;
  timestamp: Date;
}

interface VoteData {
  topic: string;
  yeas: number;
  nays: number;
  result: 'PASSED' | 'REJECTED' | 'RECONCILIATION NEEDED';
  avgConfidence: number;
  consensusScore: number;
  consensusLabel: string;
  votes: { voter: string; choice: 'YEA' | 'NAY'; confidence: number; reason: string; color: string }[];
}

interface CouncilPanelProps {
  addToast: (t: { type: string; message: string }) => void;
  gateway: { connected: boolean; url: string; latency: number };
  session: { active: boolean; agentCount: number; messageCount: number };
  setSession: React.Dispatch<React.SetStateAction<{ active: boolean; agentCount: number; messageCount: number }>>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const COUNCILORS: Councilor[] = [
  { id: 'spkr-1', name: 'Lord Quackington', role: 'speaker', color: 'from-amber-500 to-orange-600', model: 'minimax/MiniMax-M2.7', persona: 'Wise duck elder', enabled: true },
  { id: 'mod-1', name: 'Magistrate Mallard', role: 'moderator', color: 'from-cyan-500 to-blue-600', model: 'minimax/glm-5', persona: 'Fair adjudicator', enabled: true },
  { id: 'coun-1', name: 'Technocrat Teal', role: 'councilor', color: 'from-blue-500 to-indigo-600', model: 'kimi/kimi-k2', persona: 'Technical expert', enabled: true },
  { id: 'coun-2', name: 'Ethicist Emerald', role: 'councilor', color: 'from-purple-500 to-pink-600', model: 'minimax/MiniMax-M2.7', persona: 'Ethics guardian', enabled: true },
  { id: 'coun-3', name: 'Pragmatist Pewter', role: 'councilor', color: 'from-emerald-500 to-teal-600', model: 'kimi/kimi-k2', persona: 'Practical realist', enabled: true },
  { id: 'coun-4', name: 'Skeptic Slate', role: 'councilor', color: 'from-slate-500 to-gray-600', model: 'minimax/glm-5', persona: 'Critical examiner', enabled: true },
  { id: 'sent-1', name: 'Sentinel Silver', role: 'sentinel', color: 'from-gray-400 to-slate-600', model: 'minimax/MiniMax-M2.7', persona: 'Security watcher', enabled: false },
];

const MODES: { id: SessionMode; label: string; emoji: string; description: string }[] = [
  { id: 'proposal', label: 'Legislative', emoji: '⚖️', description: 'Debate & vote on proposals' },
  { id: 'deliberation', label: 'Deliberation', emoji: '🗣️', description: 'Roundtable discussion' },
  { id: 'inquiry', label: 'Inquiry', emoji: '🔍', description: 'Research & answer questions' },
  { id: 'prediction', label: 'Prediction', emoji: '🔮', description: 'Forecast outcomes' },
  { id: 'swarm_coding', label: 'Dev Swarm', emoji: '🐛', description: 'Parallel code generation' },
  { id: 'swarm', label: 'Swarm', emoji: '🐝', description: 'Hive-mind research' },
];

// ─── Component ───────────────────────────────────────────────────────────────

const CouncilPanel: React.FC<CouncilPanelProps> = ({ addToast, gateway, session, setSession }) => {
  // ── State ────────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      author: 'Clerk',
      authorType: 'SYSTEM',
      content: '⚖️ All rise. The Duck Council is in session. Submit a topic to begin deliberation.',
      timestamp: new Date(),
    },
  ]);
  const [topic, setTopic] = useState('');
  const [sessionMode, setSessionMode] = useState<SessionMode>('proposal');
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('IDLE');
  const [debateHeat, setDebateHeat] = useState(0); // -1 to 1
  const [thinkingIds, setThinkingIds] = useState<string[]>([]);
  const [councilors, setCouncilors] = useState<Councilor[]>(COUNCILORS);
  const [modeDropdownOpen, setModeDropdownOpen] = useState(false);
  const [privateCounselId, setPrivateCounselId] = useState<string | null>(null);

  // ── Refs ────────────────────────────────────────────────────────────────
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const getModeColor = (mode: SessionMode): string => {
    const map: Record<SessionMode, string> = {
      proposal: 'text-amber-400',
      deliberation: 'text-purple-400',
      inquiry: 'text-cyan-400',
      research: 'text-emerald-400',
      swarm: 'text-orange-400',
      swarm_coding: 'text-pink-400',
      prediction: 'text-indigo-400',
    };
    return map[mode] || 'text-slate-400';
  };

  const getStatusColor = (status: SessionStatus): string => {
    const map: Record<SessionStatus, string> = {
      IDLE: 'text-slate-400',
      OPENING: 'text-amber-400',
      DEBATING: 'text-orange-400',
      VOTING: 'text-yellow-400',
      RESOLVING: 'text-emerald-400',
      ADJOURNED: 'text-slate-500',
      PAUSED: 'text-cyan-400',
    };
    return map[status] || 'text-slate-400';
  };

  const activeMode = MODES.find(m => m.id === sessionMode)!;

  // ── Submit Topic ─────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!topic.trim() || sessionStatus !== 'IDLE') return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      author: 'Petitioner',
      authorType: 'HUMAN',
      content: topic.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setSessionStatus('OPENING');
    setSession(prev => ({ ...prev, active: true, agentCount: councilors.filter(c => c.enabled).length }));

    // Simulate council deliberation (placeholder for real API integration)
    const enabledCouncilors = councilors.filter(c => c.enabled);

    // Opening
    await new Promise(r => setTimeout(r, 800));
    setMessages(prev => [...prev, {
      id: `open-${Date.now()}`,
      author: enabledCouncilors[0]?.name || 'Speaker',
      authorType: 'GEMINI',
      content: `The Council acknowledges the petition: "${topic.trim()}" — opening deliberation.`,
      color: enabledCouncilors[0]?.color,
      roleLabel: 'OPENING BRIEF',
      timestamp: new Date(),
    }]);

    // Simulate debate
    await new Promise(r => setTimeout(r, 600));
    setSessionStatus('DEBATING');

    for (const councilor of enabledCouncilors.slice(1)) {
      setThinkingIds(prev => [...prev, councilor.id]);
      await new Promise(r => setTimeout(r, 1200));
      setThinkingIds(prev => prev.filter(id => id !== councilor.id));

      const stances = [
        'I concur with the proposal. The evidence supports this direction.',
        'I have concerns. We should examine the implications more closely.',
        'This aligns with our principles. I vote YEA.',
        'Further analysis required. I reserve judgment.',
        'Strong arguments on both sides. I lean toward agreement.',
      ];

      setMessages(prev => [...prev, {
        id: `deb-${councilor.id}-${Date.now()}`,
        author: councilor.name,
        authorType: 'GEMINI',
        content: stances[Math.floor(Math.random() * stances.length)],
        color: councilor.color,
        roleLabel: councilor.role.toUpperCase(),
        timestamp: new Date(),
      }]);
    }

    // Vote
    await new Promise(r => setTimeout(r, 800));
    setSessionStatus('VOTING');
    setDebateHeat(Math.random() * 0.6 - 0.3);

    const voteYeast = Math.floor(Math.random() * 3) + 2;
    const voteNays = Math.floor(Math.random() * 2) + 1;
    const total = voteYeast + voteNays;
    const margin = Math.abs(voteYeast - voteNays) / total;
    const consensus = Math.round((margin * 0.7 + 0.5 * 0.3) * 100);

    const voteData: VoteData = {
      topic: topic.trim(),
      yeas: voteYeast,
      nays: voteNays,
      result: voteYeast > voteNays ? 'PASSED' : 'REJECTED',
      avgConfidence: 7.2,
      consensusScore: consensus,
      consensusLabel: consensus > 65 ? 'Strong Consensus' : 'Contentious',
      votes: enabledCouncilors.slice(1).map(c => ({
        voter: c.name,
        choice: Math.random() > 0.35 ? 'YEA' : 'NAY',
        confidence: Math.floor(Math.random() * 3) + 7,
        reason: 'As assessed.',
        color: c.color,
      })),
    };

    setMessages(prev => [...prev, {
      id: `vote-${Date.now()}`,
      author: 'Clerk',
      authorType: 'SYSTEM',
      content: `Vote concluded: ${voteData.result}`,
      voteData,
      timestamp: new Date(),
    }]);

    await new Promise(r => setTimeout(r, 500));
    setSessionStatus('ADJOURNED');
    setSession(prev => ({ ...prev, active: false }));
    addToast({ type: 'success', message: `🦆 Council concluded: ${voteData.result}` });

  }, [topic, sessionStatus, councilors, addToast, setSession]);

  const handleClear = () => {
    setMessages([{
      id: `clear-${Date.now()}`,
      author: 'Clerk',
      authorType: 'SYSTEM',
      content: '⚖️ Council session reset. Awaiting new petition.',
      timestamp: new Date(),
    }]);
    setTopic('');
    setSessionStatus('IDLE');
    setThinkingIds([]);
    setDebateHeat(0);
    setSession({ active: false, agentCount: 0, messageCount: 0 });
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  const isActive = sessionStatus !== 'IDLE' && sessionStatus !== 'ADJOURNED';

  return (
    <div className="duck-council flex flex-col h-full">

      {/* ── Council Header ────────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 py-3 bg-[#0d1117]/80 backdrop-blur-sm border-b border-[#30363d] sticky top-0 z-10">

        <div className="flex items-center justify-between gap-4">
          {/* Title */}
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚖️</span>
            <div>
              <h2 className={`text-sm font-bold tracking-wider uppercase ${getModeColor(sessionMode)}`}
                  style={{ fontFamily: 'var(--font-display, Crimson Pro, serif)' }}>
                Duck AI Council
              </h2>
              <p className="text-[10px] text-[#8b949e]">
                Status: <span className={`font-mono ${getStatusColor(sessionStatus)}`}>{sessionStatus}</span>
              </p>
            </div>
          </div>

          {/* Mode Selector */}
          <div className="relative">
            <button
              onClick={() => setModeDropdownOpen(!modeDropdownOpen)}
              className="flex items-center gap-2 bg-[#1c2333] hover:bg-[#21262d] border border-[#30363d]
                         text-[#e6edf3] text-xs px-3 py-1.5 rounded-lg transition-colors"
            >
              <span>{activeMode.emoji}</span>
              <span className="hidden sm:block">{activeMode.label}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                   className={`transition-transform ${modeDropdownOpen ? 'rotate-180' : ''}`}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {modeDropdownOpen && (
              <div className="absolute top-full right-0 mt-1 w-48 bg-[#1c2333] border border-[#30363d]
                              rounded-lg shadow-xl z-50 py-1">
                {MODES.map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => { setSessionMode(mode.id); setModeDropdownOpen(false); }}
                    className={`
                      w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors
                      ${sessionMode === mode.id
                        ? 'bg-[#fbbf24]/10 text-[#fbbf24]'
                        : 'text-[#8b949e] hover:bg-[#21262d] hover:text-[#e6edf3]'}
                    `}
                  >
                    <span>{mode.emoji}</span>
                    <span className="flex-1 text-left">{mode.label}</span>
                    {sessionMode === mode.id && <span>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Debate Heat Bar */}
          <div className="hidden md:flex flex-col items-center gap-1 w-24">
            <span className="text-[10px] text-[#484f58] uppercase tracking-wider">Heat</span>
            <div className="w-full h-1.5 bg-[#21262d] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.abs(debateHeat) * 50}%`,
                  marginLeft: debateHeat < 0 ? '50%' : 'auto',
                  background: debateHeat > 0
                    ? 'linear-gradient(to right, #06b6d4, #f97316)'
                    : 'linear-gradient(to left, #06b6d4, #f97316)',
                }}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <DuckButton variant="ghost" size="sm" onClick={handleClear}>
              Reset
            </DuckButton>
          </div>
        </div>
      </div>

      {/* ── Councilor Deck ────────────────────────────────────────────────── */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto bg-[#0d1117]/50 border-b border-[#21262d]
                      scrollbar-hide items-center">
        {councilors.map(bot => (
          <CouncilorBadge
            key={bot.id}
            councilor={bot}
            isThinking={thinkingIds.includes(bot.id)}
            onClick={() => bot.enabled && setPrivateCounselId(bot.id)}
          />
        ))}
      </div>

      {/* ── Messages ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map(msg => (
          <CouncilMessageItem
            key={msg.id}
            message={msg}
            isLast={msg.id === messages[messages.length - 1].id}
          />
        ))}

        {/* Thinking indicator */}
        {thinkingIds.length > 0 && (
          <div className="flex items-center gap-2 text-[#8b949e] text-xs animate-pulse">
            <span>Council deliberating...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Vote Dashboard (if latest message has vote) ───────────────────── */}
      {messages[messages.length - 1]?.voteData && (
        <div className="shrink-0 px-4 pb-4">
          <VotePanel voteData={messages[messages.length - 1].voteData!} />
        </div>
      )}

      {/* ── Topic Input ──────────────────────────────────────────────────── */}
      <div className="shrink-0 p-4 bg-[#0d1117] border-t border-[#30363d]">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <div className="flex-1">
            <DuckInput
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
              placeholder="Submit a topic for the Council to deliberate..."
              disabled={isActive}
              className="w-full"
            />
          </div>
          <DuckButton
            variant="primary"
            onClick={handleSubmit}
            disabled={!topic.trim() || isActive}
            loading={sessionStatus === 'OPENING'}
          >
            ⚖️ Submit
          </DuckButton>
        </div>
        <p className="text-[10px] text-[#484f58] text-center mt-2">
          {activeMode.emoji} {activeMode.description} · {councilors.filter(c => c.enabled).length} councilors active
        </p>
      </div>
    </div>
  );
};

// ─── Council Message Item ─────────────────────────────────────────────────────

interface CouncilMessageItemProps {
  message: Message;
  isLast: boolean;
}

const CouncilMessageItem: React.FC<CouncilMessageItemProps> = ({ message, isLast }) => {
  const isSystem = message.authorType === 'SYSTEM';
  const isHuman = message.authorType === 'HUMAN';

  return (
    <div className={`flex gap-3 animate-message-in ${isSystem ? 'items-start' : ''}`}>
      {!isSystem && message.color && (
        <div className={`
          w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs
          bg-gradient-to-br ${message.color}
          border border-white/10
        `}>
          🦆
        </div>
      )}

      {isSystem && (
        <div className="w-8 h-8 rounded-full shrink-0 bg-[#21262d] border border-[#30363d] flex items-center justify-center text-xs">
          ⚖️
        </div>
      )}

      <div className={`
        flex-1 min-w-0
        ${isSystem ? 'text-center' : ''}
      `}>
        {/* Author + Role */}
        {!isSystem && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-[#e6edf3]">{message.author}</span>
            {message.roleLabel && (
              <span className="text-[10px] bg-[#21262d] text-[#8b949e] px-1.5 py-0.5 rounded uppercase tracking-wider">
                {message.roleLabel}
              </span>
            )}
          </div>
        )}

        {/* Content */}
        <div className={`
          rounded-xl px-4 py-3 text-sm leading-relaxed
          ${isSystem
            ? 'text-[#8b949e] italic text-xs bg-[#1c2333] border border-[#30363d]/50 inline-block mx-auto'
            : isHuman
              ? 'text-[#0d1117] bg-[#fbbf24] rounded-tr-sm'
              : 'text-[#e6edf3] bg-[#161b22] border border-[#30363d] rounded-tl-sm'}
        `}>
          {message.content}
        </div>

        {/* Thinking */}
        {message.thinking && (
          <details className="mt-1">
            <summary className="text-[10px] text-[#484f58] cursor-pointer hover:text-[#8b949e]">
              View thinking...
            </summary>
            <div className="mt-1 p-2 bg-[#0d1117] rounded text-xs text-[#8b949e] italic">
              {message.thinking}
            </div>
          </details>
        )}

        {/* Timestamp */}
        <div className="mt-1 text-[10px] text-[#484f58]">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const _styles = `
@keyframes message-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-message-in {
  animation: message-in 150ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
`;

if (typeof document !== 'undefined') {
  const s = document.createElement('style');
  s.textContent = _styles;
  document.head.appendChild(s);
}

export default CouncilPanel;
