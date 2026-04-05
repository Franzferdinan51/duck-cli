import React, { useState } from 'react'
import { GenerativeChat } from './components/GenerativeChat'

type View = 'chat' | 'status'

const statusCards = [
  {
    title: 'Chat',
    body: 'Local demo chat UI is working in-browser and on phone.'
  },
  {
    title: 'Desktop UI',
    body: 'This app is the duck-cli desktop/web surface. It can be opened from phone or desktop browser.'
  },
  {
    title: 'Runtime note',
    body: 'CopilotKit runtime + some Pretext demo panels still need wiring before they count as fully verified.'
  }
]

export default function App() {
  const [view, setView] = useState<View>('chat')

  return (
    <div
      style={{
        width: '100vw',
        minHeight: '100vh',
        background: '#0a0a0f',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Inter, system-ui, sans-serif'
      }}
    >
      <div
        style={{
          padding: '16px 20px',
          background: 'rgba(255, 215, 0, 0.06)',
          borderBottom: '1px solid rgba(255, 215, 0, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '28px' }}>🦆</span>
          <div>
            <div style={{ color: '#FFD700', fontSize: '20px', fontWeight: 700 }}>Duck Agent App</div>
            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '12px' }}>
              Mobile-friendly duck-cli web UI
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setView('chat')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.12)',
              background: view === 'chat' ? 'rgba(255,215,0,0.18)' : 'transparent',
              color: '#fff'
            }}
          >
            Chat
          </button>
          <button
            onClick={() => setView('status')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.12)',
              background: view === 'status' ? 'rgba(255,215,0,0.18)' : 'transparent',
              color: '#fff'
            }}
          >
            Status
          </button>
        </div>
      </div>

      <div style={{ flex: 1, padding: '16px', maxWidth: '980px', width: '100%', margin: '0 auto' }}>
        {view === 'chat' ? (
          <div style={{ height: 'calc(100vh - 110px)' }}>
            <GenerativeChat placeholder="Ask DuckBot anything..." />
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {statusCards.map((card) => (
              <div
                key={card.title}
                style={{
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '14px',
                  padding: '16px',
                  background: 'rgba(255,255,255,0.03)'
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '8px', color: '#FFD700' }}>{card.title}</div>
                <div style={{ color: 'rgba(255,255,255,0.78)', lineHeight: 1.5 }}>{card.body}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
