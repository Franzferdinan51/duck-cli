/**
 * PretextStream - Streaming text with pre-measurement
 * 
 * Enables smooth character-by-character text streaming
 * with pre-calculated layout to prevent content jumping.
 */

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { TextMeasurement, useTextMeasurement } from './PretextCanvas'

// Types
export interface StreamConfig {
  speed?: number // ms per character
  startDelay?: number // ms before starting
  chunkSize?: number // characters per chunk
  chunkDelay?: number // ms between chunks
  enableCursor?: boolean
  cursorChar?: string
  cursorBlinkSpeed?: number // ms
}

export interface PretextStreamProps {
  text: string
  font?: string
  maxWidth?: number
  lineHeight?: number
  color?: string
  config?: StreamConfig
  onComplete?: () => void
  onProgress?: (progress: number) => void
  className?: string
  style?: React.CSSProperties
}

export interface StreamingCursorProps {
  char?: string
  blinkSpeed?: number
  color?: string
  className?: string
}

/**
 * StreamingCursor - Blinking cursor component
 */
export const StreamingCursor: React.FC<StreamingCursorProps> = ({
  char = '▋',
  blinkSpeed = 500,
  color = 'currentColor',
  className
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
      className={className}
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

/**
 * PretextStream - Main streaming text component
 */
export const PretextStream: React.FC<PretextStreamProps> = ({
  text,
  font = '16px Inter, system-ui, sans-serif',
  maxWidth = 500,
  lineHeight = 22,
  color = '#ffffff',
  config = {},
  onComplete,
  onProgress,
  className,
  style
}) => {
  const {
    speed = 20,
    startDelay = 0,
    chunkSize = 1,
    chunkDelay = 0,
    enableCursor = true,
    cursorChar = '▋',
    cursorBlinkSpeed = 500
  } = config
  
  const [displayedText, setDisplayedText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  
  // Pre-measure final text to prevent layout shift
  const finalMeasurement = useTextMeasurement(text, font, maxWidth, lineHeight)
  
  // Calculate current text measurement for smooth rendering
  const currentMeasurement = useTextMeasurement(displayedText, font, maxWidth, lineHeight)
  
  // Handle streaming
  useEffect(() => {
    if (!text) {
      setDisplayedText('')
      setIsStreaming(false)
      setIsComplete(false)
      return
    }
    
    // Reset state
    setDisplayedText('')
    setIsStreaming(false)
    setIsComplete(false)
    
    // Start streaming after delay
    const startTimeout = setTimeout(() => {
      setIsStreaming(true)
      
      let currentIndex = 0
      const streamInterval = setInterval(() => {
        if (currentIndex < text.length) {
          const nextIndex = Math.min(currentIndex + chunkSize, text.length)
          setDisplayedText(text.slice(0, nextIndex))
          currentIndex = nextIndex
          
          // Report progress
          if (onProgress) {
            onProgress(currentIndex / text.length)
          }
        } else {
          clearInterval(streamInterval)
          setIsStreaming(false)
          setIsComplete(true)
          
          if (onComplete) {
            onComplete()
          }
        }
      }, chunkSize > 1 ? chunkDelay || speed : speed)
      
      return () => clearInterval(streamInterval)
    }, startDelay)
    
    return () => clearTimeout(startTimeout)
  }, [text, speed, startDelay, chunkSize, chunkDelay, onComplete, onProgress])
  
  // Use final measurement height to prevent layout shift
  const containerHeight = useMemo(() => {
    if (finalMeasurement) {
      return finalMeasurement.height + lineHeight
    }
    return 'auto'
  }, [finalMeasurement, lineHeight])
  
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        font,
        color,
        lineHeight: `${lineHeight}px`,
        maxWidth: `${maxWidth}px`,
        minHeight: typeof containerHeight === 'number' ? `${containerHeight}px` : undefined,
        ...style
      }}
    >
      {currentMeasurement?.lines.map((line, i) => (
        <div
          key={i}
          style={{
            height: `${lineHeight}px`,
            display: 'flex',
            alignItems: 'flex-start'
          }}
        >
          <span>{line.text}</span>
        </div>
      ))}
      
      {enableCursor && isStreaming && (
        <StreamingCursor
          char={cursorChar}
          blinkSpeed={cursorBlinkSpeed}
          color={color}
        />
      )}
    </div>
  )
}

/**
 * useStreamingText - Hook for streaming text logic
 */
export function useStreamingText(
  text: string,
  config: StreamConfig = {}
): {
  displayedText: string
  isStreaming: boolean
  isComplete: boolean
  progress: number
  start: () => void
  pause: () => void
  reset: () => void
} {
  const {
    speed = 20,
    chunkSize = 1,
    chunkDelay = 0
  } = config
  
  const [displayedText, setDisplayedText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [progress, setProgress] = useState(0)
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const textRef = useRef(text)
  const indexRef = useRef(0)
  
  // Update text when it changes
  useEffect(() => {
    textRef.current = text
    indexRef.current = 0
    setDisplayedText('')
    setProgress(0)
    setIsComplete(false)
  }, [text])
  
  const start = useCallback(() => {
    if (isComplete || !textRef.current) return
    
    setIsStreaming(true)
    
    intervalRef.current = setInterval(() => {
      const currentText = textRef.current
      if (!currentText) return
      
      if (indexRef.current < currentText.length) {
        const nextIndex = Math.min(indexRef.current + chunkSize, currentText.length)
        setDisplayedText(currentText.slice(0, nextIndex))
        indexRef.current = nextIndex
        setProgress(nextIndex / currentText.length)
      } else {
        setIsStreaming(false)
        setIsComplete(true)
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
        }
      }
    }, chunkSize > 1 ? chunkDelay || speed : speed)
  }, [speed, chunkSize, chunkDelay, isComplete])
  
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
    setIsComplete(false)
  }, [pause])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])
  
  return {
    displayedText,
    isStreaming,
    isComplete,
    progress,
    start,
    pause,
    reset
  }
}

/**
 * ChunkStream - Stream text in configurable chunks
 */
export interface ChunkStreamProps {
  chunks: string[]
  font?: string
  maxWidth?: number
  lineHeight?: number
  color?: string
  chunkDelay?: number
  onChunkComplete?: (index: number) => void
  onComplete?: () => void
  className?: string
  style?: React.CSSProperties
}

export const ChunkStream: React.FC<ChunkStreamProps> = ({
  chunks,
  font = '16px Inter, system-ui, sans-serif',
  maxWidth = 500,
  lineHeight = 22,
  color = '#ffffff',
  chunkDelay = 500,
  onChunkComplete,
  onComplete,
  className,
  style
}) => {
  const [currentChunk, setCurrentChunk] = useState(0)
  const [displayedChunk, setDisplayedChunk] = useState('')
  const [isChunkStreaming, setIsChunkStreaming] = useState(false)
  
  const { displayedText, isStreaming, isComplete } = useStreamingText(
    chunks[currentChunk] || '',
    { speed: 15, chunkSize: 3 }
  )
  
  // Handle chunk completion
  useEffect(() => {
    if (isComplete && displayedText === chunks[currentChunk]) {
      if (onChunkComplete) {
        onChunkComplete(currentChunk)
      }
      
      // Move to next chunk after delay
      if (currentChunk < chunks.length - 1) {
        setTimeout(() => {
          setCurrentChunk(c => c + 1)
        }, chunkDelay)
      } else if (onComplete) {
        onComplete()
      }
    }
  }, [isComplete, displayedText, chunks, currentChunk, chunkDelay, onChunkComplete, onComplete])
  
  return (
    <div
      className={className}
      style={{
        font,
        color,
        lineHeight: `${lineHeight}px`,
        maxWidth: `${maxWidth}px`,
        ...style
      }}
    >
      {displayedText}
    </div>
  )
}

export default PretextStream
