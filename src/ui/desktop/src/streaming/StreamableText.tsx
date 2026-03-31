/**
 * StreamableText - Character-by-character streaming text
 */

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useTextMeasurement } from '../pretext/PretextCanvas'

export interface StreamableTextProps {
  content: string
  font?: string
  maxWidth?: number
  lineHeight?: number
  speed?: number
  autoStart?: boolean
  showCursor?: boolean
  cursorChar?: string
  cursorBlinkSpeed?: number
  onComplete?: () => void
  onProgress?: (progress: number) => void
  className?: string
  style?: React.CSSProperties
}

/**
 * StreamableText component
 */
export const StreamableText: React.FC<StreamableTextProps> = ({
  content,
  font = '16px Inter, system-ui, sans-serif',
  maxWidth = 500,
  lineHeight = 22,
  speed = 20,
  autoStart = true,
  showCursor = true,
  cursorChar = '▋',
  cursorBlinkSpeed = 500,
  onComplete,
  onProgress,
  className,
  style
}) => {
  const [displayed, setDisplayed] = useState('')
  const [isStreaming, setIsStreaming] = useState(autoStart)
  const [progress, setProgress] = useState(0)
  
  const { displayedText } = useStreamingText(content, { speed, autoStart, onComplete, onProgress })
  
  return (
    <div
      className={className}
      style={{
        font,
        color: '#e5e7eb',
        lineHeight: `${lineHeight}px`,
        maxWidth: `${maxWidth}px`,
        ...style
      }}
    >
      {displayedText}
      {isStreaming && showCursor && (
        <StreamingCursor char={cursorChar} blinkSpeed={cursorBlinkSpeed} />
      )}
    </div>
  )
}

export interface StreamingCursorProps {
  char?: string
  blinkSpeed?: number
  color?: string
}

export const StreamingCursor: React.FC<StreamingCursorProps> = ({
  char = '▋',
  blinkSpeed = 500,
  color = 'currentColor'
}) => {
  const [visible, setVisible] = useState(true)
  
  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(v => !v)
    }, blinkSpeed)
    
    return () => clearInterval(interval)
  }, [blinkSpeed])
  
  return (
    <span
      style={{
        opacity: visible ? 1 : 0,
        color,
        transition: 'opacity 0.1s'
      }}
    >
      {char}
    </span>
  )
}

export function useStreamingText(
  text: string,
  options: {
    speed?: number
    autoStart?: boolean
    onComplete?: () => void
    onProgress?: (progress: number) => void
  } = {}
) {
  const { speed = 20, autoStart = true, onComplete, onProgress } = options
  
  const [displayedText, setDisplayedText] = useState('')
  const [isStreaming, setIsStreaming] = useState(autoStart)
  const [progress, setProgress] = useState(0)
  
  const indexRef = useRef(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  
  useEffect(() => {
    if (!text) {
      setDisplayedText('')
      setIsStreaming(false)
      return
    }
    
    // Reset
    indexRef.current = 0
    setDisplayedText('')
    setProgress(0)
    setIsStreaming(autoStart)
    
    if (autoStart) {
      intervalRef.current = setInterval(() => {
        if (indexRef.current < text.length) {
          indexRef.current++
          setDisplayedText(text.slice(0, indexRef.current))
          const newProgress = indexRef.current / text.length
          setProgress(newProgress)
          
          if (onProgress) {
            onProgress(newProgress)
          }
        } else {
          setIsStreaming(false)
          clearInterval(intervalRef.current!)
          
          if (onComplete) {
            onComplete()
          }
        }
      }, speed)
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [text, speed, autoStart, onComplete, onProgress])
  
  const start = useCallback(() => {
    if (indexRef.current >= text.length) return
    setIsStreaming(true)
    
    intervalRef.current = setInterval(() => {
      if (indexRef.current < text.length) {
        indexRef.current++
        setDisplayedText(text.slice(0, indexRef.current))
        const newProgress = indexRef.current / text.length
        setProgress(newProgress)
        
        if (onProgress) {
          onProgress(newProgress)
        }
      } else {
        setIsStreaming(false)
        clearInterval(intervalRef.current!)
        
        if (onComplete) {
          onComplete()
        }
      }
    }, speed)
  }, [text, speed, onComplete, onProgress])
  
  const pause = useCallback(() => {
    setIsStreaming(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
  }, [])
  
  const reset = useCallback(() => {
    pause()
    indexRef.current = 0
    setDisplayedText('')
    setProgress(0)
  }, [pause])
  
  return {
    displayedText,
    isStreaming,
    progress,
    start,
    pause,
    reset
  }
}

export default StreamableText
