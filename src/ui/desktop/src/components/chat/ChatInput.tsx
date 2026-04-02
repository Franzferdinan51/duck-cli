import { memo, useState, useRef, useCallback, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'
import { IconSend, IconPhoto, IconX, IconPlayerStop } from '@tabler/icons-react'

interface ChatInputProps {
  onSubmit: (message: string) => void
  onStop?: () => void
  isLoading?: boolean
  placeholder?: string
}

export const ChatInput = memo(({
  onSubmit,
  onStop,
  isLoading,
  placeholder = 'Ask anything...',
}: ChatInputProps) => {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim()
    if (trimmed && !isLoading) {
      onSubmit(trimmed)
      setInput('')
      textareaRef.current?.focus()
    }
  }, [input, isLoading, onSubmit])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Auto-resize textarea
  const handleInput = (value: string) => {
    setInput(value)
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }

  return (
    <div className="flex items-end gap-2 p-4 border-t border-zinc-800">
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className={cn(
            'w-full resize-none rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 pr-12',
            'text-white placeholder:text-zinc-500',
            'focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/20',
            'transition-all duration-200'
          )}
          style={{ minHeight: '48px', maxHeight: '200px' }}
        />
        
        {/* Attachment button */}
        <button
          className="absolute left-3 bottom-3 p-1 text-zinc-500 hover:text-white transition-colors"
          title="Add image"
        >
          <IconPhoto size={18} />
        </button>
      </div>

      {/* Send / Stop button */}
      <button
        onClick={isLoading ? onStop : handleSubmit}
        disabled={!input.trim() && !isLoading}
        className={cn(
          'shrink-0 p-3 rounded-xl transition-all duration-200',
          isLoading
            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
            : 'bg-yellow-500 text-black hover:bg-yellow-400',
          (!input.trim() && !isLoading) && 'opacity-50 cursor-not-allowed'
        )}
      >
        {isLoading ? <IconPlayerStop size={20} /> : <IconSend size={20} />}
      </button>
    </div>
  )
})
