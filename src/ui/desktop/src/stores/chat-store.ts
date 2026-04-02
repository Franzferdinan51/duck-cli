import { create } from 'zustand'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
  reasoning?: string
}

export interface Chat {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
}

interface ChatStore {
  chats: Chat[]
  currentChatId: string | null
  isLoading: boolean
  
  createChat: () => string
  deleteChat: (id: string) => void
  selectChat: (id: string) => void
  addMessage: (chatId: string, message: Omit<Message, 'id' | 'createdAt'>) => Message
  updateMessage: (chatId: string, messageId: string, updates: Partial<Message>) => void
  setLoading: (loading: boolean) => void
  getCurrentChat: () => Chat | null
}

export const useChatStore = create<ChatStore>((set, get) => ({
  chats: [],
  currentChatId: null,
  isLoading: false,
  
  createChat: () => {
    const id = crypto.randomUUID()
    const chat: Chat = {
      id,
      title: 'New Chat',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    set((state) => ({
      chats: [chat, ...state.chats],
      currentChatId: id,
    }))
    return id
  },
  
  deleteChat: (id) => {
    set((state) => ({
      chats: state.chats.filter((c) => c.id !== id),
      currentChatId: state.currentChatId === id ? state.chats[0]?.id ?? null : state.currentChatId,
    }))
  },
  
  selectChat: (id) => {
    set({ currentChatId: id })
  },
  
  addMessage: (chatId, message) => {
    const newMessage: Message = {
      ...message,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    }
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === chatId
          ? { ...chat, messages: [...chat.messages, newMessage], updatedAt: new Date() }
          : chat
      ),
    }))
    return newMessage
  },
  
  updateMessage: (chatId, messageId, updates) => {
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              messages: chat.messages.map((msg) =>
                msg.id === messageId ? { ...msg, ...updates } : msg
              ),
              updatedAt: new Date(),
            }
          : chat
      ),
    }))
  },
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  getCurrentChat: () => {
    const state = get()
    return state.chats.find((c) => c.id === state.currentChatId) ?? null
  },
}))
