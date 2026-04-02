import { memo, useState } from 'react'
import { cn } from '@/lib/utils'
import { RenderMarkdown } from './RenderMarkdown'
import { formatDate } from '@/lib/utils'
import { IconCopy, IconCheck, IconEdit, IconTrash, IconRefresh } from '@tabler/icons-react'
import type { Message } from '@/stores/chat-store'

interface MessageBubbleProps {
  message: Message
  isLast?: boolean
  isLoading?: boolean
  onRegenerate?: () => void
  onEdit?: (newContent: string) => void
  onDelete?: () => void
}

export const MessageBubble = memo(({
  message,
  isLast,
  isLoading,
  onRegenerate,
  onEdit,
  onDelete,
}: MessageBubbleProps) => {
  const [copied, setCopied] = useState(false)
  const [showActions, setShowActions] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isUser = message.role === 'user'

  return (
    <div
      className={cn(
        'group flex w-full gap-3 px-4 py-2',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium',
          isUser
            ? 'bg-yellow-500 text-black'
            : 'bg-gradient-to-br from-purple-500 to-blue-500 text-white'
        )}
      >
        {isUser ? 'U' : 'AI'}
      </div>

      {/* Content */}
      <div className={cn('flex flex-col gap-1 max-w-[80%]', isUser && 'items-end')}>
        {/* Time */}
        <span className="text-[10px] text-zinc-500">
          {formatDate(message.createdAt)}
        </span>

        {/* Message bubble */}
        <div
          className={cn(
            'rounded-2xl px-4 py-2',
            isUser
              ? 'bg-yellow-500/20 text-white rounded-tr-sm'
              : 'bg-zinc-800 text-zinc-100 rounded-tl-sm'
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <RenderMarkdown
              content={message.content}
              isStreaming={isLoading && isLast}
              isAnimating={true}
            />
          )}
          
          {/* Reasoning indicator */}
          {message.reasoning && !isUser && (
            <div className="mt-2 border-t border-zinc-700 pt-2 text-xs text-zinc-400">
              <span className="text-purple-400">Thinking:</span> {message.reasoning}
            </div>
          )}
        </div>

        {/* Actions */}
        {showActions && !isLoading && (
          <div className={cn(
            'flex items-center gap-1 mt-1',
            isUser ? 'flex-row-reverse' : 'flex-row'
          )}>
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg hover:bg-zinc-700/50 text-zinc-400 hover:text-white transition-colors"
              title="Copy"
            >
              {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
            </button>
            
            {!isUser && onRegenerate && (
              <button
                onClick={onRegenerate}
                className="p-1.5 rounded-lg hover:bg-zinc-700/50 text-zinc-400 hover:text-white transition-colors"
                title="Regenerate"
              >
                <IconRefresh size={14} />
              </button>
            )}
            
            <button
              onClick={() => onEdit?.(message.content)}
              className="p-1.5 rounded-lg hover:bg-zinc-700/50 text-zinc-400 hover:text-white transition-colors"
              title="Edit"
            >
              <IconEdit size={14} />
            </button>
            
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg hover:bg-zinc-700/50 text-zinc-400 hover:text-red-400 transition-colors"
              title="Delete"
            >
              <IconTrash size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
})
