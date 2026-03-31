/**
 * Duck Agent Desktop — ChatCanvas Panel
 *
 * Chat panel with Pretext-powered streaming messages.
 * Uses Canvas 2D for character-level text rendering via pretext.
 * Provides smooth streaming without DOM reflow.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import StreamingMessage from '../StreamingMessage'
import { DuckButton } from '../components/duck-button'
import { DuckInput } from '../components/duck-input'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  model?: string
  timestamp: Date
  streaming?: boolean
}

interface ChatCanvasProps {
  addToast: (t: { type: string; message: string }) => void
  gateway: { connected: boolean; url: string; latency: number }
  session: { active: boolean; agentCount: number; messageCount: number }
  setSession: React.Dispatch<React.SetStateAction<{ active: boolean; agentCount: number; messageCount: number }>>
}

// ─── Streaming Chat Message ───────────────────────────────────────────────────

interface StreamChatMessageProps {
  message: Message
  avatarColor: string
  avatarEmoji: string
}

const StreamChatMessage: React.FC<StreamChatMessageProps> = ({
  message,
  avatarColor,
  avatarEmoji,
}) => {
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-message-in`}>
      {/* Canvas Avatar */}
      <div className="relative w-8 h-8 shrink-0">
        <CanvasAvatar emoji={avatarEmoji} color={avatarColor} />
      </div>

      {/* Bubble */}
      <div
        className={`
          max-w-[75%] min-w-[80px] rounded-2xl px-4 py-3 text-sm leading-relaxed relative overflow-hidden
          ${isUser
            ? 'bg-[#fbbf24] text-[#0d1117] rounded-tr-sm'
            : 'bg-[#161b22] text-[#e6edf3] border border-[#30363d] rounded-tl-sm'}
        `}
      >
        {/* Pretext-powered streaming content for assistant */}
        {isAssistant && !message.streaming && (
          <div className="whitespace-pre-wrap">
            {message.content.split('\n').map((line, i) => (
              <div key={i}>{line || <br />}</div>
            ))}
          </div>
        )}

        {isAssistant && message.streaming && (
          <StreamingMessage
            content={message.content}
            font="15px Inter, system-ui"
            maxWidth={420}
            lineHeight={22}
            color="#fbbf24"
          />
        )}

        {!isAssistant && (
          <div className="whitespace-pre-wrap">
            {message.content.split('\n').map((line, i) => (
              <div key={i}>{line || <br />}</div>
            ))}
          </div>
        )}

        {/* Streaming indicator */}
        {message.streaming && isAssistant && (
          <div className="mt-1.5 flex items-center gap-1">
            <span className="duck-cursor inline-block w-2 h-4 bg-[#fbbf24] rounded animate-blink" />
          </div>
        )}

        {/* Timestamp */}
        <div className="mt-1.5 text-[10px] text-[#484f58]">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}

// ─── Canvas Avatar ─────────────────────────────────────────────────────────────

interface CanvasAvatarProps {
  emoji: string
  color: string
}

const CanvasAvatar: React.FC<CanvasAvatarProps> = ({ emoji, color }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = 32
    canvas.height = 32

    // Circle background
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(16, 16, 14, 0, Math.PI * 2)
    ctx.fill()

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'
    ctx.lineWidth = 2
    ctx.stroke()

    // Emoji
    ctx.font = '16px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(emoji, 16, 17)
  }, [emoji, color])

  return <canvas ref={canvasRef} className="w-8 h-8 rounded-full" />
}

// ─── Component ───────────────────────────────────────────────────────────────

const ChatCanvas: React.FC<ChatCanvasProps> = ({
  addToast,
  gateway,
  session,
  setSession,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Quack! I'm DuckBot with Pretext Canvas rendering — AI-powered generative UI. How can I help?",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isStreaming) return

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsStreaming(true)
    setSession(prev => ({ ...prev, messageCount: prev.messageCount + 1, active: true }))

    const assistantMsgId = `assistant-${Date.now()}`
    let fullContent = ''

    setMessages(prev => [
      ...prev,
      {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        streaming: true,
      },
    ])

    // Simulate streaming for demo (replace with real WebSocket)
    const responses = [
      "I'm processing your request with Pretext Canvas rendering.",
      'The AI Council is visualizing your query in real-time.',
      'Character-level text measurement enables perfect layout.',
      'Canvas rendering gives us pixel-perfect generative UI.',
      'This response streams character by character!',
    ]
    const response = responses[Math.floor(Math.random() * responses.length)]
    let i = 0

    const streamInterval = setInterval(() => {
      if (i < response.length) {
        fullContent += response[i]
        setMessages(prev =>
          prev.map(m => m.id === assistantMsgId ? { ...m, content: fullContent } : m)
        )
        i++
      } else {
        clearInterval(streamInterval)
        setMessages(prev =>
          prev.map(m => m.id === assistantMsgId ? { ...m, streaming: false } : m)
        )
        setIsStreaming(false)
        setSession(prev => ({ ...prev, active: false }))
      }
    }, 30)
  }, [isStreaming, setSession])

  const handleStop = () => {
    wsRef.current?.close()
    setIsStreaming(false)
    setMessages(prev => prev.map(m => m.streaming ? { ...m, streaming: false } : m))
  }

  return (
    <div className="duck-chat-canvas flex flex-col h-full">

      {/* Header */}
      <div className="shrink-0 px-4 py-3 bg-[#0d1117]/80 backdrop-blur-sm border-b border-[#30363d]
                      flex items-center gap-3 sticky top-0 z-10">
        <span className="text-xl">🎨</span>
        <div>
          <h2 className="text-sm font-bold text-[#a78bfa]">Canvas Chat</h2>
          <p className="text-[10px] text-[#484f58]">Pretext-powered streaming</p>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${gateway.connected ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`} />
          <span className="text-xs text-[#8b949e]">{gateway.connected ? `${gateway.latency}ms` : 'Disconnected'}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map(msg => (
          <StreamChatMessage
            key={msg.id}
            message={msg}
            avatarColor={msg.role === 'user' ? '#fbbf24' : '#1c2333'}
            avatarEmoji={msg.role === 'user' ? '👤' : '🦆'}
          />
        ))}

        {isStreaming && messages[messages.length - 1]?.streaming && (
          <div className="flex items-center gap-2 text-[#8b949e] text-sm">
            <span>🦆</span>
            <span>Canvas rendering...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 p-4 bg-[#0d1117] border-t border-[#30363d]">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <div className="flex-1">
            <DuckInput
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
              placeholder="Message DuckBot (Pretext Canvas streaming)..."
              disabled={isStreaming}
              className="w-full"
            />
          </div>
          {isStreaming ? (
            <DuckButton variant="danger" size="sm" onClick={handleStop}>■ Stop</DuckButton>
          ) : (
            <DuckButton
              variant="primary"
              size="sm"
              onClick={() => sendMessage(input)}
              disabled={!input.trim()}
            >
              Send
            </DuckButton>
          )}
        </div>
        <p className="text-[10px] text-[#484f58] text-center mt-2">
          🎨 Pretext Canvas rendering · Character-level text measurement
        </p>
      </div>
    </div>
  )
}

export default ChatCanvas
