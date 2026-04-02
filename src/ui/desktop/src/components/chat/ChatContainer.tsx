import { memo, useEffect, useRef, useCallback } from 'react'
import { useChatStore, type Message } from '@/stores/chat-store'
import { MessageBubble } from './MessageBubble'
import { ChatInput } from './ChatInput'
import { cn } from '@/lib/utils'
import { IconMessageCircle } from '@tabler/icons-react'

interface ChatContainerProps {
  className?: string
}

export const ChatContainer = memo(({ className }: ChatContainerProps) => {
  const {
    chats,
    currentChatId,
    isLoading,
    createChat,
    selectChat,
    addMessage,
    updateMessage,
    setLoading,
    getCurrentChat,
  } = useChatStore()

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const currentChat = getCurrentChat()

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentChat?.messages])

  // Create initial chat if none exists
  useEffect(() => {
    if (chats.length === 0) {
      createChat()
    }
  }, [chats.length, createChat])

  // Send message handler
  const handleSubmit = useCallback(async (content: string) => {
    if (!currentChatId) return
    
    // Add user message
    addMessage(currentChatId, { role: 'user', content })
    setLoading(true)

    try {
      // Call duck-cli's ACP/gateway API
      const response = await fetch('http://localhost:18792/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('gateway_token') || ''}`,
        },
        body: JSON.stringify({
          model: 'auto',
          messages: [
            ...currentChat!.messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            { role: 'user', content },
          ],
          stream: true,
        }),
      })

      if (!response.ok) throw new Error('API error')

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ''

      // Add empty assistant message
      const msg = addMessage(currentChatId, { role: 'assistant', content: '' })

      // Stream response
      while (reader) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            
            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta?.content || ''
              if (delta) {
                assistantMessage += delta
                updateMessage(currentChatId, msg.id, { content: assistantMessage })
              }
            } catch {}
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
      addMessage(currentChatId, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Make sure duck-cli gateway is running.',
      })
    } finally {
      setLoading(false)
    }
  }, [currentChatId, currentChat, addMessage, updateMessage, setLoading])

  const handleStop = useCallback(() => {
    setLoading(false)
  }, [setLoading])

  return (
    <div className={cn('flex h-full', className)}>
      {/* Sidebar */}
      <div className="w-64 border-r border-zinc-800 flex flex-col bg-zinc-900/50">
        {/* New chat button */}
        <div className="p-3">
          <button
            onClick={() => createChat()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-yellow-500 text-black font-medium hover:bg-yellow-400 transition-colors"
          >
            <span>New Chat</span>
          </button>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto px-2">
          {chats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => selectChat(chat.id)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm mb-1 transition-colors',
                chat.id === currentChatId
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'
              )}
            >
              <IconMessageCircle size={16} className="shrink-0" />
              <span className="truncate">{chat.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {currentChat?.messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">🦆</div>
                <h2 className="text-xl font-semibold text-white mb-2">
                  Duck Agent Desktop
                </h2>
                <p className="text-zinc-500">
                  Ask me anything about coding, research, or your projects.
                </p>
              </div>
            </div>
          ) : (
            <div className="py-4">
              {currentChat?.messages.map((message, index) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isLast={index === (currentChat?.messages.length ?? 0) - 1}
                  isLoading={isLoading}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <ChatInput
          onSubmit={handleSubmit}
          onStop={handleStop}
          isLoading={isLoading}
        />
      </div>
    </div>
  )
})
