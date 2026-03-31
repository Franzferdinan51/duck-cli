/**
 * DuckCopilot - Main CopilotKit Provider Wrapper
 * 
 * Wraps the app with CopilotKit provider for:
 * - Chat UI with streaming
 * - Shared state (useCopilotThread)
 * - Human-in-loop actions
 * - Backend action execution
 */

import React from 'react'
import { CopilotProvider } from '@copilotkit/react-core'
import { CopilotUI } from '@copilotkit/react-ui'
import '@copilotkit/react-ui/styles.css'

export interface DuckCopilotProps {
  children: React.ReactNode
  backendEndpoint?: string
  showChat?: boolean
}

export const DuckCopilot: React.FC<DuckCopilotProps> = ({
  children,
  backendEndpoint = 'ws://localhost:18796',
  showChat = true
}) => {
  return (
    <CopilotProvider
      chatEndpoint={backendEndpoint}
      showChatWindow={showChat}
      publicApiKey={undefined}
    >
      <CopilotUI
        labels={{
          title: 'DuckBot Assistant',
          initial: '有什么可以帮助你的吗? 🦆',
        }}
      />
      {children}
    </CopilotProvider>
  )
}

export default DuckCopilot
