import { memo, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Streamdown } from 'streamdown'
import { cjk } from '@streamdown/cjk'
import { code } from '@streamdown/code'
import { mermaid } from '@streamdown/mermaid'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

interface MarkdownProps {
  content: string
  className?: string
  isUser?: boolean
  isStreaming?: boolean
  isAnimating?: boolean
}

// Cache for normalized LaTeX content
const latexCache = new Map<string, string>()

const normalizeLatex = (input: string): string => {
  if (latexCache.has(input)) {
    return latexCache.get(input)!
  }

  const segments = input.split(/(```[\s\S]*?```|`[^`]*`|<[a-zA-Z/_!][^>]*>)/g)
  let result = ''

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    if (!segment) continue
    if (i % 2 === 1) {
      result += segment
      continue
    }

    let s = segment
    // Escape suspicious $<number>
    s = s.replace(/\$(\d+)(?![^\n]*\$([^\d]|$))/g, (_, num) => '\\$' + num)
    // Display math: \[...\]
    if (s.includes('\\['))
      s = s.replace(
        /(^|\n)\\\[\s*\n([\s\S]*?)\n\s*\\\](?=\n|$)/g,
        (_, pre, inner) => `${pre}$$\n${inner.trim()}\n$$`
      )
    // Inline math: \(...\)
    if (s.includes('\\('))
      s = s.replace(
        /(^|[^$\\])\\\((.+?)\\\)(?=[^$\\]|$)/g,
        (_, pre, inner) => `${pre}$${inner.trim()}$`
      )
    result += s
  }

  if (latexCache.size > 100) {
    const firstKey = latexCache.keys().next().value || ''
    latexCache.delete(firstKey)
  }
  latexCache.set(input, result)
  return result
}

export const RenderMarkdown = memo(
  ({ content, className, isUser, isAnimating = true }: MarkdownProps) => {
    const normalizedContent = useMemo(() => normalizeLatex(content), [content])

    return (
      <div
        dir="auto"
        className={cn(
          'markdown wrap-break-word select-text prose prose-invert max-w-none',
          isUser && 'text-white',
          className
        )}
      >
        <Streamdown
          animate={isAnimating}
          animationDuration={500}
          linkSafety={{ enabled: false }}
          className={cn(
            'size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
            className
          )}
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          plugins={{
            code: code,
            mermaid: mermaid,
            cjk: cjk,
          }}
          controls={{
            mermaid: { fullscreen: false },
          }}
        >
          {normalizedContent}
        </Streamdown>
      </div>
    )
  }
)
