/**
 * GenerativeChat - Chat UI combining CopilotKit + Pretext streaming
 * 
 * Features:
 * - Uses CopilotKit for chat infrastructure
 * - Uses Pretext StreamableText for animated message rendering
 * - Canvas-based message display for AI responses
 * - Duck-themed styling
 */

import React, { useState, useEffect, useRef } from 'react'
import { useCopilotChat } from '@copilotkit/react-core'
import { StreamableText, StreamingCursor } from '../pretextgen/streaming/StreamableText'

export interface GenerativeChatProps {
  className?: string
  style?: React.CSSProperties
  onMessage?: (message: string) => void
  placeholder?: string
}

export const GenerativeChat: React.FC<GenerativeChatProps> = ({
  className = '',
  style,
  onMessage,
  placeholder = 'Ask DuckBot anything...'
}) => {
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentResponse, setCurrentResponse] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const { messages, sendMessage, isLoading } = useCopilotChat({
    onResponse: (response) => {
      if (response) {
        setIsStreaming(true)
      }
    },
    onFinish: () => {
      setIsStreaming(false)
    }
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    
    setCurrentResponse('')
    await sendMessage(input)
    setInput('')
    
    if (onMessage) {
      onMessage(input)
    }
  }

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentResponse])

  return (
    <div 
      className={`generative-chat ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        borderRadius: '12px',
        overflow: 'hidden',
        ...style
      }}
    >
      {/* Chat Header */}
      <div style={{
        padding: '16px 20px',
        background: 'rgba(255, 215, 0, 0.1)',
        borderBottom: '1px solid rgba(255, 215, 0, 0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <span style={{ fontSize: '24px' }}>🦆</span>
        <span style={{ 
          color: '#FFD700', 
          fontWeight: 'bold',
          fontSize: '16px'
        }}>
          DuckBot Assistant
        </span>
        <div style={{
          marginLeft: 'auto',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#22c55e'
        }} />
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div style={{
              maxWidth: '75%',
              padding: '12px 16px',
              borderRadius: '12px',
              background: msg.role === 'user' 
                ? 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)'
                : 'rgba(255, 255, 255, 0.1)',
              color: msg.role === 'user' ? '#1a1a2e' : '#e5e7eb',
              fontSize: '14px',
              lineHeight: 1.5
            }}>
              {msg.role === 'user' ? (
                msg.content
              ) : (
                <StreamableText 
                  content={msg.content || ''}
                  font="14px Inter, system-ui, sans-serif"
                  speed={15}
                  showCursor={true}
                />
              )}
            </div>
          </div>
        ))}
        
        {/* Current streaming response */}
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              maxWidth: '75%',
              padding: '12px 16px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#e5e7eb'
            }}>
              <StreamingCursor 
                char="▋"
                blinkSpeed={300}
                color="#FFD700"
              />
              <span style={{ marginLeft: '8px', opacity: 0.7 }}>
                DuckBot is thinking...
              </span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form 
        onSubmit={handleSubmit}
        style={{
          padding: '16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          gap: '12px'
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: '8px',
            border: '1px solid rgba(255, 215, 0, 0.3)',
            background: 'rgba(255, 255, 255, 0.05)',
            color: '#fff',
            fontSize: '14px',
            outline: 'none'
          }}
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          style={{
            padding: '12px 24px',
            borderRadius: '8px',
            border: 'none',
            background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
            color: '#1a1a2e',
            fontWeight: 'bold',
            cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
            opacity: input.trim() && !isLoading ? 1 : 0.5
          }}
        >
          Send 🦆
        </button>
      </form>
    </div>
  )
}

export default GenerativeChat
