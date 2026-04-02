/**
 * Duck Agent Desktop — App Entry Point
 * 
 * Now with CopilotKit + Pretext Toolkit integration:
 * - DuckCopilot: Main CopilotKit provider wrapper
 * - GenerativeChat: Chat using CopilotKit + Pretext streaming
 * - CanvasRenderer: Pretext canvas for metrics/council
 * - WeatherCard, CryptoChart, CouncilVoteDisplay: Example generative UIs
 */

import React, { useState } from 'react'
import { DuckCopilot } from './components/DuckCopilot'
import { GenerativeChat } from './components/GenerativeChat'
import CanvasRenderer from './components/CanvasRenderer'
import { WeatherCard } from './examples/WeatherCard'
import { CryptoChart } from './examples/CryptoChart'
import { CouncilVoteDisplay } from './examples/CouncilVoteDisplay'

// Sample data for generative UI examples
const sampleWeather = {
  temp: 72,
  condition: 'Partly Cloudy',
  location: 'Huber Heights, OH',
  humidity: 45,
  wind: 8,
  forecast: [
    { day: 'Tuesday', high: 74, low: 58, condition: 'Sunny' },
    { day: 'Wednesday', high: 71, low: 55, condition: 'Cloudy' },
    { day: 'Thursday', high: 68, low: 52, condition: 'Rain' }
  ]
}

const sampleCrypto = {
  symbol: 'BTC',
  name: 'Bitcoin',
  price: 67432.50,
  change24h: 1234.56,
  changePercent: 1.87,
  high24h: 68100.00,
  low24h: 65800.00,
  volume: '28.5B'
}

const sampleCouncilMembers = [
  { id: '1', name: 'Speaker', role: 'Moderator', vote: 'approve' as const },
  { id: '2', name: 'Technocrat', role: 'Technical Advisor', vote: 'approve' as const },
  { id: '3', name: 'Ethicist', role: 'Ethics Review', vote: 'pending' as const },
  { id: '4', name: 'Pragmatist', role: 'Practical Analysis', vote: 'approve' as const },
  { id: '5', name: 'Skeptic', role: 'Risk Assessment', vote: 'reject' as const },
  { id: '6', name: 'Sentinel', role: 'Security Review', vote: 'approve' as const }
]

type View = 'chat' | 'demo'

export default function App() {
  const [view, setView] = useState<View>('demo')

  return (
    <DuckCopilot>
      <div style={{
        width: '100vw',
        height: '100vh',
        background: '#0a0a0f',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Inter, system-ui, sans-serif'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          background: 'rgba(255, 215, 0, 0.05)',
          borderBottom: '1px solid rgba(255, 215, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '28px' }}>🦆</span>
            <span style={{ color: '#FFD700', fontSize: '20px', fontWeight: 'bold' }}>
              Duck Agent Desktop
            </span>
            <span style={{
              background: 'rgba(16, 185, 129, 0.2)',
              color: '#10b981',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '10px'
            }}>
              CopilotKit + Pretext
            </span>
          </div>
          
          {/* View toggle */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setView('demo')}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                background: view === 'demo' ? 'rgba(255, 215, 0, 0.2)' : 'transparent',
                color: view === 'demo' ? '#FFD700' : 'rgba(255, 255, 255, 0.5)',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              🎨 Demo
            </button>
            <button
              onClick={() => setView('chat')}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                background: view === 'chat' ? 'rgba(255, 215, 0, 0.2)' : 'transparent',
                color: view === 'chat' ? '#FFD700' : 'rgba(255, 255, 255, 0.5)',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              💬 Chat
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {view === 'demo' ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
              gap: '24px',
              maxWidth: '1400px',
              margin: '0 auto'
            }}>
              {/* Weather Card */}
              <div>
                <h3 style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '12px', fontSize: '14px' }}>
                  🌤️ Weather Card (Pretext Canvas)
                </h3>
                <WeatherCard data={sampleWeather} />
              </div>

              {/* Crypto Chart */}
              <div>
                <h3 style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '12px', fontSize: '14px' }}>
                  ₿ Crypto Chart (Pretext Canvas)
                </h3>
                <CryptoChart data={sampleCrypto} />
              </div>

              {/* AI Council Vote */}
              <div>
                <h3 style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '12px', fontSize: '14px' }}>
                  🏛️ AI Council Vote (Pretext Canvas)
                </h3>
                <CouncilVoteDisplay 
                  members={sampleCouncilMembers}
                  topic="Approve deployment of Duck Agent v2.5 to production"
                  consensusThreshold={0.6}
                />
              </div>

              {/* Canvas Particles Demo */}
              <div>
                <h3 style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '12px', fontSize: '14px' }}>
                  ✨ Canvas Particle Effects (Pretext)
                </h3>
                <CanvasRenderer 
                  width={400} 
                  height={260}
                  background="#0a0a0f"
                  onRender={(ctx) => {
                    // Custom render callback for additional effects
                    ctx.fillStyle = 'rgba(255, 215, 0, 0.8)'
                    ctx.font = 'bold 14px Inter'
                    ctx.textAlign = 'center'
                    ctx.fillText('Pretext Canvas Active 🦆', 200, 130)
                  }}
                />
              </div>
            </div>
          ) : (
            <div style={{
              maxWidth: '600px',
              margin: '0 auto',
              height: 'calc(100vh - 140px)'
            }}>
              <GenerativeChat 
                placeholder="Ask DuckBot anything about the AI Council, weather, crypto..."
              />
            </div>
          )}
        </div>
      </div>
    </DuckCopilot>
  )
}
