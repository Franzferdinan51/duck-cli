/**
 * Duck Agent Desktop — CouncilCanvas Panel
 *
 * AI Council deliberation with Pretext Canvas rendering.
 * Uses character-level text measurement for perfect vote visualization.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'
import PretextCanvasRenderer, {
  type CouncilorMessage,
  type Vote,
} from '../PretextCanvasRenderer'
import { DuckButton } from '../components/duck-button'
import { DuckInput } from '../components/duck-input'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Councilor {
  id: string
  name: string
  color: string
  emoji: string
  role: string
  enabled: boolean
  thinking?: boolean
}

interface CouncilCanvasProps {
  addToast: (t: { type: string; message: string }) => void
  gateway: { connected: boolean; url: string; latency: number }
  session: { active: boolean; agentCount: number; messageCount: number }
  setSession: React.Dispatch<React.SetStateAction<{ active: boolean; agentCount: number; messageCount: number }>>
}

// ─── Constants ───────────────────────────────────────────────────────────────

const COUNCILORS: Councilor[] = [
  { id: 'c1', name: 'Lord Quackington', color: '#f59e0b', emoji: '🦆', role: 'Speaker', enabled: true },
  { id: 'c2', name: 'Technocrat Teal', color: '#06b6d4', emoji: '🔷', role: 'Technocrat', enabled: true },
  { id: 'c3', name: 'Ethicist Emerald', color: '#a855f7', emoji: '💜', role: 'Ethicist', enabled: true },
  { id: 'c4', name: 'Pragmatist Pewter', color: '#22c55e', emoji: '⚖️', role: 'Pragmatist', enabled: true },
  { id: 'c5', name: 'Skeptic Slate', color: '#64748b', emoji: '🔍', role: 'Skeptic', enabled: true },
  { id: 'c6', name: 'Sentinel Silver', color: '#94a3b8', emoji: '🛡️', role: 'Sentinel', enabled: false },
]

// ─── Council Canvas Panel ─────────────────────────────────────────────────────

const CouncilCanvas: React.FC<CouncilCanvasProps> = ({
  addToast,
  gateway,
  session,
  setSession,
}) => {
  const [messages, setMessages] = useState<CouncilorMessage[]>([])
  const [votes, setVotes] = useState<Vote[]>([])
  const [consensus, setConsensus] = useState(0)
  const [topic, setTopic] = useState('')
  const [isDeliberating, setIsDeliberating] = useState(false)
  const [debateHeat, setDebateHeat] = useState(0)
  const msgIdRef = useRef(0)

  const addMessage = useCallback((msg: Omit<CouncilorMessage, 'id' | 'timestamp'>) => {
    msgIdRef.current++
    setMessages(prev => [
      ...prev,
      { ...msg, id: `msg-${msgIdRef.current}`, timestamp: Date.now() } as CouncilorMessage,
    ])
  }, [])

  const handleDeliberate = useCallback(async () => {
    if (!topic.trim() || isDeliberating) return

    setIsDeliberating(true)
    setMessages([])
    setVotes([])
    setConsensus(0)
    setSession(prev => ({ ...prev, active: true, agentCount: COUNCILORS.filter(c => c.enabled).length }))

    // Opening
    addMessage({
      councilor: 'Lord Quackington',
      emoji: '🦆',
      color: '#f59e0b',
      role: 'Speaker',
      text: `The Council acknowledges the petition: "${topic.trim()}" — opening deliberation.`,
      isStreaming: false,
    })

    await new Promise(r => setTimeout(r, 1000))

    // Enabled councilors speak
    const enabled = COUNCILORS.filter(c => c.enabled)
    const stances = [
      'I concur with the proposal. The evidence strongly supports this direction.',
      'I have reservations. The implications require deeper analysis.',
      'This aligns with our principles. I vote YEA with confidence.',
      'Further examination needed before I can commit.',
      'Strong arguments on both sides. I lean toward agreement.',
    ]

    for (const councilor of enabled.slice(1)) {
      await new Promise(r => setTimeout(r, 800))

      const stance = stances[Math.floor(Math.random() * stances.length)]
      addMessage({
        councilor: councilor.name,
        emoji: councilor.emoji,
        color: councilor.color,
        role: councilor.role,
        text: stance,
        isStreaming: true,
      })

      await new Promise(r => setTimeout(r, 600))
    }

    await new Promise(r => setTimeout(r, 500))

    // Vote
    const passCount = Math.floor(Math.random() * 3) + 2
    const total = enabled.length
    const rejectCount = total - passCount
    const newVotes: Vote[] = enabled.slice(1).map(c => ({
      voter: c.name,
      color: c.color,
      choice: Math.random() > 0.35 ? 'PASS' as const : 'REJECT' as const,
      confidence: Math.floor(Math.random() * 25) + 70,
      reason: 'As assessed.',
    }))

    setVotes(newVotes)

    const margin = Math.abs(passCount - rejectCount) / total
    const newConsensus = Math.round((margin * 0.7 + 0.5) * 100)
    setConsensus(newConsensus)
    setDebateHeat(Math.random() * 0.6 - 0.3)

    const result = passCount > rejectCount ? 'PASSED' : 'REJECTED'
    addMessage({
      councilor: 'Lord Quackington',
      emoji: '🦆',
      color: '#f59e0b',
      role: 'Speaker',
      text: `The vote is concluded. The matter has ${result}. Consensus: ${newConsensus}%`,
      isStreaming: false,
      vote: {
        choice: result,
        confidence: newConsensus,
        reason: result === 'PASSED' ? 'Majority YEA' : 'Majority NAY',
      },
    })

    setIsDeliberating(false)
    setSession(prev => ({ ...prev, active: false }))
    addToast({ type: 'success', message: `⚖️ Council: ${result} (${newConsensus}% consensus)` })
  }, [topic, isDeliberating, addMessage, addToast, setSession])

  const handleReset = () => {
    setMessages([])
    setVotes([])
    setConsensus(0)
    setTopic('')
    setIsDeliberating(false)
    setDebateHeat(0)
    setSession({ active: false, agentCount: 0, messageCount: 0 })
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  const activeCouncilors = COUNCILORS.filter(c => c.enabled)

  return (
    <div className="duck-council-canvas flex flex-col h-full">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 py-3 bg-[#0d1117]/80 backdrop-blur-sm border-b border-[#30363d]
                      flex items-center gap-3 sticky top-0 z-10">
        <span className="text-2xl">⚖️</span>
        <div>
          <h2 className="text-sm font-bold text-[#a78bfa]" style={{ fontFamily: 'var(--font-display)' }}>
            Canvas Council
          </h2>
          <p className="text-[10px] text-[#8b949e]">
            Pretext rendering · {activeCouncilors.length} councilors · {Math.round(consensus)}% consensus
          </p>
        </div>

        <div className="flex-1" />

        {/* Heat bar */}
        <div className="hidden md:flex flex-col items-center gap-1 w-20">
          <span className="text-[10px] text-[#484f58] uppercase">Heat</span>
          <div className="w-full h-1.5 bg-[#21262d] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.abs(debateHeat) * 50}%`,
                marginLeft: debateHeat < 0 ? '50%' : 'auto',
                background: debateHeat > 0
                  ? 'linear-gradient(to right, #06b6d4, #f97316)'
                  : 'linear-gradient(to left, #06b6d4, #f97316)',
              }}
            />
          </div>
        </div>

        {/* Canvas badge */}
        <div className="bg-[#a78bfa]/20 text-[#a78bfa] text-[10px] px-2 py-1 rounded-full font-mono">
          CANVAS
        </div>

        <DuckButton variant="ghost" size="sm" onClick={handleReset} disabled={isDeliberating}>
          Reset
        </DuckButton>
      </div>

      {/* ── Councilor Strip ───────────────────────────────────────────────── */}
      <div className="flex gap-2 px-4 py-2 overflow-x-auto bg-[#0d1117]/50 border-b border-[#21262d]
                      scrollbar-hide items-center">
        {COUNCILORS.map(c => (
          <div
            key={c.id}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs shrink-0
              ${c.enabled
                ? 'bg-[#1c2333] border border-[#30363d]'
                : 'bg-[#161b22] opacity-40'}
            `}
          >
            <span style={{ color: c.enabled ? c.color : '#666' }}>{c.emoji}</span>
            <span className={c.enabled ? 'text-[#e6edf3]' : 'text-[#484f58]'}>{c.name.split(' ')[0]}</span>
            {c.thinking && <span className="animate-pulse text-[#f59e0b]">…</span>}
          </div>
        ))}
      </div>

      {/* ── Canvas Area ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {messages.length > 0 ? (
          <div className="p-4">
            <PretextCanvasRenderer
              messages={messages}
              votes={votes}
              consensus={consensus}
              showVotes={votes.length > 0}
              width={860}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="text-5xl mb-4">⚖️</div>
            <h3 className="text-lg font-bold text-[#e6edf3] mb-2">Duck AI Council</h3>
            <p className="text-sm text-[#8b949e] max-w-md">
              Submit a topic for the Council to deliberate. Each councilor will render
              their stance via Pretext Canvas with character-level text measurement.
            </p>
          </div>
        )}
      </div>

      {/* ── Topic Input ──────────────────────────────────────────────────── */}
      <div className="shrink-0 p-4 bg-[#0d1117] border-t border-[#30363d]">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <div className="flex-1">
            <DuckInput
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleDeliberate()}
              placeholder="Submit a topic for the Canvas Council..."
              disabled={isDeliberating}
              className="w-full"
            />
          </div>
          <DuckButton
            variant="primary"
            onClick={handleDeliberate}
            disabled={!topic.trim() || isDeliberating}
            loading={isDeliberating}
          >
            ⚖️ Deliberate
          </DuckButton>
        </div>
        <p className="text-[10px] text-[#484f58] text-center mt-2">
          🎨 Pretext Canvas · Character-level rendering · Live vote visualization
        </p>
      </div>
    </div>
  )
}

export default CouncilCanvas
