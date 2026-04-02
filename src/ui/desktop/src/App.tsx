import { ChatContainer } from './components/chat'

export default function App() {
  return (
    <div className="h-screen w-screen bg-zinc-950 text-white overflow-hidden">
      {/* Header */}
      <div
        className="h-14 px-6 flex items-center justify-between border-b border-zinc-800"
        style={{
          background: 'rgba(255, 215, 0, 0.03)',
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">🦆</span>
          <span className="text-lg font-bold text-yellow-500">Duck Agent</span>
          <span
            className="px-2 py-0.5 text-xs rounded-md"
            style={{
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
            }}
          >
            Desktop UI
          </span>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span>Connected</span>
        </div>
      </div>

      {/* Main content */}
      <div className="h-[calc(100vh-56px)]">
        <ChatContainer />
      </div>
    </div>
  )
}
