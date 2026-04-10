/**
 * 🦆 Duck Agent - Enhanced Web UI
 * Upgraded with session management, real-time updates, and modern UI
 */

import { useState, useEffect, useRef } from 'react';
import { Send, Mic, Settings, History, Shield, Terminal, Activity, Moon, Sun, Bot, User, ChevronDown, ChevronUp, X, Check, AlertCircle, Loader2 } from 'lucide-react';

// Types
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  status?: 'sending' | 'sent' | 'error';
  metadata?: {
    model?: string;
    tokens?: number;
    cost?: number;
    tools?: string[];
  };
}

interface Session {
  id: string;
  name: string;
  messageCount: number;
  lastActive: Date;
}

interface AgentStatus {
  name: string;
  status: 'idle' | 'processing' | 'error';
  providers: string[];
  tools: number;
  skills: number;
  metaAgents: { name: string; status: string }[];
}

// Theme Provider
const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="fixed top-4 right-4 z-50 p-2 rounded-full bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-all"
        >
          {darkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-gray-700" />}
        </button>
        {children}
      </div>
    </div>
  );
};

// Header Component
const Header = ({ status, onMenuClick }: { status: AgentStatus; onMenuClick: () => void }) => (
  <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
    <div className="flex items-center gap-3">
      <button onClick={onMenuClick} className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
        <Terminal className="w-5 h-5 text-gray-600 dark:text-gray-400" />
      </button>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-gray-900 dark:text-white">Duck Agent</h1>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span className={`w-2 h-2 rounded-full ${status.status === 'idle' ? 'bg-green-500' : status.status === 'processing' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`} />
            {status.status === 'idle' ? 'Ready' : status.status === 'processing' ? 'Processing...' : 'Error'}
          </div>
        </div>
      </div>
    </div>
    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
      <span className="hidden sm:inline">{status.providers.length} providers</span>
      <span className="hidden sm:inline">•</span>
      <span>{status.tools} tools</span>
    </div>
  </header>
);

// Sidebar Component
const Sidebar = ({ 
  isOpen, 
  onClose, 
  sessions, 
  activeSession, 
  onSessionChange,
  metaAgents 
}: { 
  isOpen: boolean; 
  onClose: () => void;
  sessions: Session[];
  activeSession: string;
  onSessionChange: (id: string) => void;
  metaAgents: { name: string; status: string }[];
}) => (
  <>
    {/* Mobile overlay */}
    {isOpen && (
      <div 
        className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
        onClick={onClose}
      />
    )}
    <aside className={`
      fixed lg:static inset-y-0 left-0 z-50 w-72 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
      transform transition-transform duration-300 ease-in-out
      ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      flex flex-col
    `}>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <button className="w-full py-2 px-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-lg font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2">
          <Bot className="w-4 h-4" />
          New Chat
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Sessions</h3>
        <div className="space-y-1">
          {sessions.map(session => (
            <button
              key={session.id}
              onClick={() => onSessionChange(session.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                activeSession === session.id 
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-100' 
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <div className="font-medium truncate">{session.name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {session.messageCount} messages • {new Date(session.lastActive).toLocaleDateString()}
              </div>
            </button>
          ))}
        </div>

        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 mt-6">Meta Agents</h3>
        <div className="space-y-1">
          {metaAgents.map(agent => (
            <div key={agent.name} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
              <div className={`w-2 h-2 rounded-full ${agent.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
              {agent.name}
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
          <Settings className="w-4 h-4" />
          Settings
        </button>
      </div>
    </aside>
  </>
);

// Message Component
const MessageBubble = ({ message }: { message: Message }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
        isUser ? 'bg-blue-500' : isSystem ? 'bg-gray-500' : 'bg-gradient-to-br from-yellow-400 to-orange-500'
      }`}>
        {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
      </div>
      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`px-4 py-3 rounded-2xl ${
          isUser 
            ? 'bg-blue-500 text-white rounded-br-md' 
            : isSystem
            ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-bl-md'
            : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-bl-md shadow-sm'
        }`}>
          <div className="whitespace-pre-wrap">{message.content}</div>
          {message.status === 'sending' && (
            <div className="flex items-center gap-2 mt-2 text-xs opacity-70">
              <Loader2 className="w-3 h-3 animate-spin" />
              Sending...
            </div>
          )}
        </div>
        {message.metadata && (
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
            {message.metadata.model && <span>{message.metadata.model}</span>}
            {message.metadata.tokens && <span>• {message.metadata.tokens} tokens</span>}
            {message.metadata.cost && <span>• ${message.metadata.cost.toFixed(4)}</span>}
          </div>
        )}
      </div>
    </div>
  );
};

// Input Component
const ChatInput = ({ onSend, disabled }: { onSend: (message: string) => void; disabled: boolean }) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="max-w-4xl mx-auto relative">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message Duck Agent..."
          disabled={disabled}
          rows={1}
          className="w-full pr-24 pl-4 py-3 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl resize-none focus:ring-2 focus:ring-yellow-400 dark:text-white placeholder-gray-500"
          style={{ minHeight: '56px', maxHeight: '200px' }}
        />
        <div className="absolute right-2 bottom-2 flex items-center gap-2">
          <button 
            disabled={disabled}
            className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-50"
          >
            <Mic className="w-5 h-5" />
          </button>
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || disabled}
            className="p-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="max-w-4xl mx-auto mt-2 text-xs text-center text-gray-500 dark:text-gray-400">
        Duck Agent can make mistakes. Consider checking important information.
      </div>
    </div>
  );
};

// Status Panel Component
const StatusPanel = ({ status }: { status: AgentStatus }) => (
  <div className="bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 w-80 hidden xl:block overflow-y-auto">
    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
      <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <Activity className="w-4 h-4" />
        System Status
      </h2>
    </div>
    <div className="p-4 space-y-4">
      <div>
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Providers</h3>
        <div className="flex flex-wrap gap-2">
          {status.providers.map(provider => (
            <span key={provider} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-xs rounded-full text-gray-700 dark:text-gray-300">
              {provider}
            </span>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Meta Agents</h3>
        <div className="space-y-2">
          {status.metaAgents.map(agent => (
            <div key={agent.name} className="flex items-center justify-between text-sm">
              <span className="text-gray-700 dark:text-gray-300">{agent.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                agent.status === 'active' 
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
              }`}>
                {agent.status}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Capabilities</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
            <div className="font-medium text-gray-900 dark:text-white">{status.tools}</div>
            <div className="text-gray-500 dark:text-gray-400">Tools</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
            <div className="font-medium text-gray-900 dark:text-white">{status.skills}</div>
            <div className="text-gray-500 dark:text-gray-400">Skills</div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// Main App Component
export default function DuckAgentApp() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSession, setActiveSession] = useState('default');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m Duck Agent, your AI assistant. I can help you with tasks, answer questions, and even control your devices. What would you like to do?',
      timestamp: new Date(),
      metadata: { model: 'MiniMax-M2.7' }
    }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);

  const [sessions] = useState<Session[]>([
    { id: 'default', name: 'Current Session', messageCount: 1, lastActive: new Date() },
    { id: '1', name: 'Android Automation', messageCount: 15, lastActive: new Date(Date.now() - 86400000) },
    { id: '2', name: 'Security Audit', messageCount: 8, lastActive: new Date(Date.now() - 172800000) },
  ]);

  const [status] = useState<AgentStatus>({
    name: 'Duck Agent',
    status: 'idle',
    providers: ['MiniMax', 'Kimi', 'LM Studio', 'OpenRouter'],
    tools: 40,
    skills: 10,
    metaAgents: [
      { name: 'Orchestrator', status: 'active' },
      { name: 'Bridge', status: 'active' },
      { name: 'Security', status: 'active' },
      { name: 'Memory', status: 'active' },
      { name: 'Monitor', status: 'idle' },
    ]
  });

  const handleSendMessage = async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
      status: 'sent'
    };

    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);

    // Simulate API call
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I received your message: "${content}"\n\nThis is a demo response. In the real implementation, this would connect to the Duck Agent backend and process your request using the appropriate tools and AI models.`,
        timestamp: new Date(),
        metadata: { model: 'MiniMax-M2.7', tokens: 150, cost: 0.002 }
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsProcessing(false);
    }, 1500);
  };

  return (
    <ThemeProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar 
          isOpen={sidebarOpen} 
          onClose={() => setSidebarOpen(false)}
          sessions={sessions}
          activeSession={activeSession}
          onSessionChange={setActiveSession}
          metaAgents={status.metaAgents}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <Header status={status} onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
            <div className="max-w-4xl mx-auto p-4 space-y-6">
              {messages.map(message => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {isProcessing && (
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Duck Agent is thinking...
                </div>
              )}
            </div>
          </main>
          <ChatInput onSend={handleSendMessage} disabled={isProcessing} />
        </div>
        <StatusPanel status={status} />
      </div>
    </ThemeProvider>
  );
}
