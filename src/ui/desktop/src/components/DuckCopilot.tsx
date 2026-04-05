/**
 * DuckCopilot - Main CopilotKit Provider Wrapper
 * 
 * Wraps the app with CopilotKit provider for:
 * - Chat UI with streaming
 * - Shared state (useThreads)
 * - Human-in-loop actions
 * - Backend action execution
 * 
 * Uses CopilotKit v1.x API:
 * - CopilotKit: Root provider component
 * - CopilotChat: Chat UI component
 * - useCopilotChat: Chat hook for custom UI
 */

import React from 'react'
import { CopilotKit, useCopilotChat } from '@copilotkit/react-core'
import { CopilotChat } from '@copilotkit/react-ui'
import '@copilotkit/react-ui/styles.css'

export interface DuckCopilotProps {
  children: React.ReactNode
  backendEndpoint?: string
  showChat?: boolean
}

export const DuckCopilot: React.FC<DuckCopilotProps> = ({
  children,
  backendEndpoint = 'http://localhost:18796',
  showChat = true
}) => {
  const publicApiKey = import.meta.env.VITE_COPILOTKIT_PUBLIC_API_KEY
  const publicLicenseKey = import.meta.env.VITE_COPILOTKIT_PUBLIC_LICENSE_KEY
  const runtimeUrl = import.meta.env.VITE_COPILOTKIT_RUNTIME_URL || backendEndpoint
  const hasCopilotRuntime = Boolean(publicApiKey || publicLicenseKey || runtimeUrl)

  if (!hasCopilotRuntime) {
    return <>{children}</>
  }

  return (
    <CopilotKit
      runtimeUrl={runtimeUrl}
      publicApiKey={publicApiKey}
      publicLicenseKey={publicLicenseKey}
    >
      {children}
      {showChat && (
        <CopilotChat
          labels={{
            title: 'DuckBot Assistant',
            initial: '有什么可以帮助你的吗? 🦆',
          }}
        />
      )}
    </CopilotKit>
  )
}

export default DuckCopilot
