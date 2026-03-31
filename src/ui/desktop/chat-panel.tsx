/**
 * Duck Agent Desktop — Chat Panel
 *
 * Primary chat interface with streaming messages, model selector,
 * message history, and input composer.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DuckButton } from './components/duck-button';
import { DuckInput } from './components/duck-input';
import { DuckCard } from './components/duck-card';
import { StatusIndicator } from './components/status-indicator';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  model?: string;
  thinking?: string; // reasoning/thinking block
  timestamp: Date;
  attachments?: Attachment[];
  streaming?: boolean;
}

interface Attachment {
  type: 'image' | 'file' | 'link';
  name: string;
  url?: string;
  data?: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  model: string;
}

interface ModelOption {
  id: string;
  label: string;
  provider: string;
  icon?: string;
}

interface ChatPanelProps {
  addToast: (t: { type: string; message: string }) => void;
  gateway: { connected: boolean; url: string; latency: number };
  session: { active: boolean; agentCount: number; messageCount: number };
  setSession: React.Dispatch<React.SetStateAction<{ active: boolean; agentCount: number; messageCount: number }>>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MODELS: ModelOption[] = [
  { id: 'minimax/MiniMax-M2.7', label: 'MiniMax M2.7', provider: 'MiniMax', icon: '🤖' },
  { id: 'kimi/kimi-k2.5', label: 'Kimi K2.5', provider: 'Kimi', icon: '🧠' },
  { id: 'openai-codex/gpt-5.4', label: 'GPT-5.4', provider: 'OpenAI', icon: '🟢' },
  { id: 'lmstudio/qwen3-vl-8b', label: 'Qwen3 VL 8B', provider: 'LM Studio', icon: '💻' },
  { id: 'minimax/glm-5', label: 'GLM-5', provider: 'MiniMax', icon: '🤖' },
];

const DEFAULT_MODEL = 'minimax/MiniMax-M2.7';

// ─── Component ───────────────────────────────────────────────────────────────

const ChatPanel: React.FC<ChatPanelProps> = ({ addToast, gateway, session, setSession }) => {
  // ── State ────────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "🦆 **Quack!** I'm DuckBot — your AI command center. How can I help you today?",
      model: DEFAULT_MODEL,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [isStreaming, setIsStreaming] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── WebSocket Chat ────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isStreaming) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsStreaming(true);

    // Update session
    setSession(prev => ({ ...prev, messageCount: prev.messageCount + 1, active: true }));

    try {
      // Stream via WebSocket
      const ws = new WebSocket(`${gateway.url.replace('ws://', 'http://').replace('wss://', 'https://')}/v1/chat`);

      wsRef.current = ws;

      const assistantMsgId = `assistant-${Date.now()}`;
      let fullContent = '';

      // Optimistic assistant message
      setMessages(prev => [
        ...prev,
        {
          id: assistantMsgId,
          role: 'assistant',
          content: '',
          model: selectedModel,
          timestamp: new Date(),
          streaming: true,
        },
      ]);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'chunk' || data.type === 'content') {
            fullContent += data.content || '';
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantMsgId ? { ...m, content: fullContent } : m
              )
            );
          }
        } catch { /* ignore */ }
      };

      ws.onerror = () => {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMsgId
              ? { ...m, content: "⚠️ Connection error. Try again.", streaming: false }
              : m
          )
        );
        setIsStreaming(false);
        addToast({ type: 'error', message: 'Chat connection failed' });
      };

      ws.onclose = () => {
        setMessages(prev =>
          prev.map(m => m.id === assistantMsgId ? { ...m, streaming: false } : m)
        );
        setIsStreaming(false);
        setSession(prev => ({ ...prev, active: false }));
      };

      // Send the request
      ws.onopen = () => {
        ws.send(JSON.stringify({
          model: selectedModel,
          messages: [
            { role: 'user', content: content.trim() },
          ],
          stream: true,
        }));
      };
    } catch {
      setIsStreaming(false);
      addToast({ type: 'error', message: 'Failed to send message' });
    }
  }, [gateway.url, selectedModel, isStreaming, addToast, setSession]);

  // ── Input handlers ────────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleStop = () => {
    wsRef.current?.close();
    setIsStreaming(false);
    setMessages(prev =>
      prev.map(m => m.streaming ? { ...m, streaming: false } : m)
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  const activeModelLabel = MODELS.find(m => m.id === selectedModel)?.label || selectedModel;
  const activeModelIcon = MODELS.find(m => m.id === selectedModel)?.icon || '🤖';

  return (
    <div className="duck-chat flex flex-col h-full">

      {/* ── Chat Header ───────────────────────────────────────────────────── */}
      <div className="duck-chat-header shrink-0 px-4 py-3 bg-[#0d1117]/80 backdrop-blur-sm border-b border-[#30363d]
                      flex items-center gap-3 sticky top-0 z-10">

        {/* Model Selector */}
        <div className="relative">
          <button
            onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
            className="flex items-center gap-2 bg-[#1c2333] hover:bg-[#21262d] border border-[#30363d]
                       text-[#e6edf3] text-sm px-3 py-1.5 rounded-lg transition-colors"
          >
            <span>{activeModelIcon}</span>
            <span className="hidden sm:block">{activeModelLabel}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 className={`transition-transform ${modelDropdownOpen ? 'rotate-180' : ''}`}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {modelDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-[#1c2333] border border-[#30363d]
                            rounded-lg shadow-xl z-50 py-1 max-h-64 overflow-y-auto">
              {MODELS.map(group => (
                <button
                  key={group.id}
                  onClick={() => { setSelectedModel(group.id); setModelDropdownOpen(false); }}
                  className={`
                    w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors
                    ${selectedModel === group.id
                      ? 'bg-[#fbbf24]/10 text-[#fbbf24]'
                      : 'text-[#8b949e] hover:bg-[#21262d] hover:text-[#e6edf3]'}
                  `}
                >
                  <span>{group.icon}</span>
                  <span className="flex-1 text-left">{group.label}</span>
                  <span className="text-[10px] text-[#484f58]">{group.provider}</span>
                  {selectedModel === group.id && <span className="text-[#fbbf24]">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Session Title */}
        <div className="flex-1 text-center">
          <h2 className="text-sm font-semibold text-[#e6edf3] truncate">
            {activeSessionId
              ? sessions.find(s => s.id === activeSessionId)?.title || 'New Chat'
              : 'New Chat'}
          </h2>
        </div>

        {/* History Toggle */}
        <button
          onClick={() => setHistoryOpen(!historyOpen)}
          className={`
            p-2 rounded-lg transition-colors
            ${historyOpen ? 'bg-[#fbbf24]/10 text-[#fbbf24]' : 'text-[#8b949e] hover:bg-[#21262d] hover:text-[#e6edf3]'}
          `}
          title="Chat History"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5M12 7v5l4 2" />
          </svg>
        </button>
      </div>

      {/* ── Messages Area ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {messages.map(msg => (
          <ChatMessageItem key={msg.id} message={msg} />
        ))}

        {isStreaming && messages[messages.length - 1]?.streaming && (
          <div className="flex items-center gap-2 text-[#8b949e] text-sm animate-pulse">
            <span>{activeModelIcon}</span>
            <span>Thinking...</span>
            <span className="duck-cursor inline-block w-2 h-4 bg-[#fbbf24] rounded animate-blink" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input Area ────────────────────────────────────────────────────── */}
      <div className="duck-input-area shrink-0 p-4 bg-[#0d1117] border-t border-[#30363d]">

        {/* Thinking Preview (if last message had thinking) */}
        {messages[messages.length - 1]?.thinking && (
          <div className="mb-2 p-2 bg-[#1c2333] rounded-lg border border-[#30363d]">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] text-[#fbbf24] uppercase tracking-wider font-bold">Thinking</span>
            </div>
            <p className="text-xs text-[#8b949e] italic">{messages[messages.length - 1].thinking}</p>
          </div>
        )}

        {/* Composer */}
        <div className="duck-composer flex items-end gap-2 bg-[#161b22] border border-[#30363d] rounded-xl p-2
                        focus-within:border-[#fbbf24] transition-colors">

          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask DuckBot anything... (Enter to send, Shift+Enter for newline)"
            rows={1}
            className="flex-1 bg-transparent text-[#e6edf3] text-sm resize-none outline-none placeholder-[#484f58] py-1.5 px-2 max-h-40"
            style={{ fontFamily: 'var(--font-ui, Inter, sans-serif)' }}
          />

          <div className="flex items-center gap-1 shrink-0">
            {isStreaming ? (
              <DuckButton variant="danger" size="sm" onClick={handleStop}>
                ■ Stop
              </DuckButton>
            ) : (
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim()}
                className={`
                  w-8 h-8 rounded-lg flex items-center justify-center transition-all
                  ${input.trim()
                    ? 'bg-[#fbbf24] text-[#0d1117] hover:bg-[#d97706] active:scale-95'
                    : 'bg-[#21262d] text-[#484f58] cursor-not-allowed'}
                `}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between mt-2 px-1">
          <span className="text-[10px] text-[#484f58]">
            {gateway.connected
              ? `🦆 Gateway ${gateway.latency}ms`
              : '⚠️ Gateway disconnected'}
          </span>
          <span className="text-[10px] text-[#484f58]">
            {activeModelLabel} · Shift+Enter for newline
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── Chat Message Item ───────────────────────────────────────────────────────

interface ChatMessageItemProps {
  message: Message;
}

const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isSystem = message.role === 'system';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-message-in`}>
      {/* Avatar */}
      <div className={`
        w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-sm font-bold
        ${isUser ? 'bg-[#fbbf24] text-[#0d1117]' :
          isAssistant ? 'bg-[#1c2333] border border-[#30363d] text-[#fbbf24]' :
          'bg-[#21262d] text-[#8b949e]'}
      `}>
        {isUser ? '👤' : isAssistant ? '🦆' : '⚙️'}
      </div>

      {/* Bubble */}
      <div className={`
        max-w-[80%] min-w-[80px] rounded-2xl px-4 py-3 text-sm leading-relaxed
        ${isUser
          ? 'bg-[#fbbf24] text-[#0d1117] rounded-tr-sm'
          : isSystem
            ? 'bg-[#1c2333] text-[#8b949e] italic border border-[#30363d]'
            : 'bg-[#161b22] text-[#e6edf3] border border-[#30363d] rounded-tl-sm'}
      `}>
        {/* Thinking block */}
        {message.thinking && (
          <details className="mb-2">
            <summary className="text-[10px] text-[#484f58] cursor-pointer hover:text-[#8b949e]">
              View thinking...
            </summary>
            <div className="mt-1 p-2 bg-[#0d1117] rounded text-[#8b949e] text-xs italic">
              {message.thinking}
            </div>
          </details>
        )}

        {/* Content */}
        <div className="whitespace-pre-wrap">
          {message.content.split('\n').map((line, i) => (
            <div key={i}>{line || <br />}</div>
          ))}
        </div>

        {/* Streaming cursor */}
        {message.streaming && (
          <span className="duck-cursor inline-block w-2 h-4 bg-[#fbbf24] rounded animate-blink ml-0.5 align-middle" />
        )}

        {/* Timestamp */}
        <div className="mt-1.5 text-[10px] text-[#484f58]">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {message.model && !isUser && (
            <span className="ml-2 font-mono text-[#fbbf24]/50">{message.model.split('/')[1]}</span>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const _chatStyles = `
@keyframes message-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-message-in {
  animation: message-in 150ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
.animate-blink {
  animation: blink 800ms step-end infinite;
}
`;

if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = _chatStyles;
  document.head.appendChild(style);
}

export default ChatPanel;
