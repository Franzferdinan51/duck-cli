/**
 * useDuckAgent - Hook to connect to Duck Agent WebSocket backend
 * 
 * Connects to the existing Duck Agent WebSocket on port 18796
 * for streaming responses, agent state, and council metrics.
 */

import { useState, useEffect, useRef, useCallback } from 'react'

export interface DuckAgentMessage {
  type: 'chat' | 'stream' | 'council' | 'metrics' | 'error' | 'connected'
  content?: string
  data?: any
  timestamp?: number
}

export interface DuckAgentState {
  isConnected: boolean
  isStreaming: boolean
  lastMessage: DuckAgentMessage | null
  error: string | null
}

export interface UseDuckAgentOptions {
  url?: string
  autoConnect?: boolean
  onMessage?: (message: DuckAgentMessage) => void
  onConnect?: () => void
  onDisconnect?: () => void
}

export const useDuckAgent = (options: UseDuckAgentOptions = {}) => {
  const {
    url = 'ws://localhost:18796',
    autoConnect = true,
    onMessage,
    onConnect,
    onDisconnect
  } = options

  const [state, setState] = useState<DuckAgentState>({
    isConnected: false,
    isStreaming: false,
    lastMessage: null,
    error: null
  })
  
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const messageQueueRef = useRef<string[]>([])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        setState(prev => ({ 
          ...prev, 
          isConnected: true, 
          error: null 
        }))
        onConnect?.()
        
        // Flush queued messages
        while (messageQueueRef.current.length > 0) {
          const msg = messageQueueRef.current.shift()
          if (msg) ws.send(msg)
        }
      }

      ws.onmessage = (event) => {
        try {
          const message: DuckAgentMessage = JSON.parse(event.data)
          setState(prev => ({ 
            ...prev, 
            lastMessage: message,
            isStreaming: message.type === 'stream'
          }))
          onMessage?.(message)
        } catch (e) {
          // Plain text message
          const message: DuckAgentMessage = {
            type: 'chat',
            content: event.data,
            timestamp: Date.now()
          }
          setState(prev => ({ 
            ...prev, 
            lastMessage: message 
          }))
          onMessage?.(message)
        }
      }

      ws.onerror = () => {
        setState(prev => ({ 
          ...prev, 
          error: 'WebSocket connection error' 
        }))
      }

      ws.onclose = () => {
        setState(prev => ({ 
          ...prev, 
          isConnected: false,
          isStreaming: false
        }))
        onDisconnect?.()
        
        // Auto-reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect()
        }, 3000)
      }
    } catch (e) {
      setState(prev => ({ 
        ...prev, 
        error: `Failed to connect: ${e}`
      }))
    }
  }, [url, onMessage, onConnect, onDisconnect])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  const sendMessage = useCallback((content: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'chat',
        content,
        timestamp: Date.now()
      }))
    } else {
      // Queue message for when connection is established
      messageQueueRef.current.push(content)
    }
  }, [])

  const sendAction = useCallback((action: string, data?: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: action,
        data,
        timestamp: Date.now()
      }))
    }
  }, [])

  useEffect(() => {
    if (autoConnect) {
      connect()
    }
    
    return () => {
      disconnect()
    }
  }, [autoConnect, connect, disconnect])

  return {
    ...state,
    connect,
    disconnect,
    sendMessage,
    sendAction
  }
}

export default useDuckAgent
