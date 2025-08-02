'use client'

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { experimental_useObject as useObject } from '@ai-sdk/react'
import ReactMarkdown from 'react-markdown'
import { rubyProjectScopingSchema, type RubyProjectScoping } from '../../lib/schemas'
import { useGoalSettingConversation } from '../../hooks/useGoalSettingConversation'

interface Message {
  user: string
  ruby: string
}

interface RubyProjectScopingChatProps {
  isOpen: boolean
  onClose: () => void
  onProjectGoalSet?: (projectName: string, projectDescription: string) => void
}

export interface RubyProjectScopingChatRef {
  restartConversation: () => Promise<void>
}

const RubyProjectScopingChat = forwardRef<RubyProjectScopingChatRef, RubyProjectScopingChatProps>(({ 
  isOpen,
  onClose, 
  onProjectGoalSet 
}, ref) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [userInput, setUserInput] = useState('')
  const currentInputRef = useRef('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Goal setting conversation hook
  const {
    currentConversation,
    messages: dbMessages,
    startNewConversation,
    loadConversation,
    addMessage,
    finalizeGoal,
    getConversationHistory,
    getLatestConversation
  } = useGoalSettingConversation()

  const { object, submit, isLoading, error } = useObject({
    api: '/api/project-scoping-chat',
    schema: rubyProjectScopingSchema,
    onFinish: async (result) => {
      console.log('Generation finished:', result)
      
      // Add the completed message to UI immediately to prevent duplication
      if (result?.object && currentInputRef.current) {
        setMessages(prev => [...prev, {
          user: currentInputRef.current,
          ruby: result.object!.response
        }])
      }
      
      // Save messages to database in background
      if (currentConversation && result?.object) {
        try {
          await addMessage('assistant', result.object.response)
        } catch (err) {
          console.error('Failed to save assistant message:', err)
        }
      }
      
      // If a project goal was set, trigger the confirmation modal
      if (result?.object?.goal_set && result.object.project_name && result.object.project_description) {
        try {
          // Finalize the goal in the database
          if (currentConversation) {
            await finalizeGoal(result.object.project_name, result.object.project_description)
          }
          
          // Start a new conversation for future interactions
          await startNewConversation()
          
          // Trigger the confirmation modal instead of creating project immediately
          onProjectGoalSet?.(result.object.project_name, result.object.project_description)
        } catch (error) {
          console.error('Error finalizing goal:', error)
        }
      }
    }
  })

  // Initialize conversation when chat opens
  useEffect(() => {
    if (isOpen && !currentConversation) {
      initializeConversation()
    }
  }, [isOpen])

  // Convert database messages to UI format
  useEffect(() => {
    if (dbMessages.length > 0) {
      const uiMessages: Message[] = []
      for (let i = 0; i < dbMessages.length; i += 2) {
        const userMsg = dbMessages[i]
        const rubyMsg = dbMessages[i + 1]
        
        if (userMsg && userMsg.role === 'user' && rubyMsg && rubyMsg.role === 'assistant') {
          uiMessages.push({
            user: userMsg.content,
            ruby: rubyMsg.content
          })
        }
      }
      setMessages(uiMessages)
    } else {
      setMessages([])
    }
  }, [dbMessages])

  const initializeConversation = async () => {
    try {
      // Check if there's an existing unfinished conversation
      const latestConversation = await getLatestConversation()
      
      if (latestConversation) {
        // Load existing conversation
        await loadConversation(latestConversation.session_id)
      } else {
        // Start new conversation
        await startNewConversation()
      }
    } catch (err) {
      console.error('Failed to initialize conversation:', err)
    }
  }

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, object, isLoading])

  // Function to restart conversation (for cancel flow)
  const restartConversation = async () => {
    try {
      // Clear current UI state
      setMessages([])
      setUserInput('')
      
      // Start a completely new conversation in the database
      await startNewConversation()
    } catch (err) {
      console.error('Failed to restart conversation:', err)
    }
  }

  // Expose restartConversation function to parent component
  useImperativeHandle(ref, () => ({
    restartConversation
  }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userInput.trim() || isLoading) return

    // Store the current input in ref for onFinish to use
    const currentInput = userInput.trim()
    currentInputRef.current = currentInput
    
    // Save user message to database
    if (currentConversation) {
      try {
        await addMessage('user', currentInput)
      } catch (err) {
        console.error('Failed to save user message:', err)
      }
    }
    
    // Get conversation history from database for better context
    const conversationHistory = getConversationHistory()
    
    submit({
      message: currentInput,
      conversationHistory: conversationHistory
    })
    
    // Clear input immediately for better UX
    setUserInput('')
  }

  const getWelcomeMessage = () => {
    if (messages.length === 0 && !object && !isLoading) {
      return "Hi there! 🌟 I'm Ruby, your coding teacher! I'm so excited to help you build something amazing! What would you like to create with code?"
    }
    return null
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/90 backdrop-blur-md border border-white/30 rounded-[24px] shadow-[inset_0_4px_12px_rgba(255,255,255,0.7),0_16px_48px_rgba(147,51,234,0.3)] w-full max-w-2xl h-[600px] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-purple-100/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),0_4px_16px_rgba(147,51,234,0.3)] flex items-center justify-center">
              <span className="text-lg font-bold text-white">R</span>
            </div>
            <div>
              <h3 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Chat with Ruby
              </h3>
              <p className="text-gray-600 text-sm">Let's figure out what you want to build!</p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="w-8 h-8 bg-white/60 backdrop-blur-sm border border-white/30 rounded-full shadow-[inset_0_2px_4px_rgba(255,255,255,0.6)] flex items-center justify-center text-gray-600 hover:text-purple-600 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
          
          {/* Welcome Message */}
          {getWelcomeMessage() && (
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full shadow-[inset_0_2px_4px_rgba(255,255,255,0.4)] flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-white">R</span>
              </div>
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100/50 rounded-[16px] shadow-[inset_0_2px_4px_rgba(255,255,255,0.6)] p-4 max-w-[75%] break-words">
                <div className="text-gray-800 prose prose-sm max-w-none">
                  <ReactMarkdown>{getWelcomeMessage()}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          {/* Conversation History */}
          {messages.map((message, index) => (
            <div key={index} className="space-y-3">
              {/* User Message */}
              <div className="flex justify-end">
                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-100/50 rounded-[16px] shadow-[inset_0_2px_4px_rgba(255,255,255,0.6)] p-4 max-w-[75%] break-words">
                  <p className="text-gray-800">{message.user}</p>
                </div>
              </div>
              
              {/* Ruby's Response */}
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full shadow-[inset_0_2px_4px_rgba(255,255,255,0.4)] flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-white">R</span>
                </div>
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100/50 rounded-[16px] shadow-[inset_0_2px_4px_rgba(255,255,255,0.6)] p-4 max-w-[75%] break-words">
                  <div className="text-gray-800 prose prose-sm max-w-none">
                    <ReactMarkdown>{message.ruby}</ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Current Ruby Response (Streaming) - only show if actively streaming */}
          {object && isLoading && (
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full shadow-[inset_0_2px_4px_rgba(255,255,255,0.4)] flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-white">R</span>
              </div>
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100/50 rounded-[16px] shadow-[inset_0_2px_4px_rgba(255,255,255,0.6)] p-4 max-w-[75%] break-words">
                <div className="text-gray-800 prose prose-sm max-w-none">
                  <ReactMarkdown>{object.response || '...'}</ReactMarkdown>
                </div>
                {object.goal_set && object.project_name && (
                  <div className="mt-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100/50 rounded-[12px] animate-in slide-in-from-bottom-2 fade-in duration-500">
                    <p className="text-green-800 font-medium">🎉 Perfect! I found your project goal:</p>
                    <p className="text-green-700 font-bold mt-1">{object.project_name}</p>
                    <p className="text-green-600 text-sm mt-2">{object.project_description}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Loading State - only show when loading and no object yet */}
          {isLoading && !object && (
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full shadow-[inset_0_2px_4px_rgba(255,255,255,0.4)] flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-white">R</span>
              </div>
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100/50 rounded-[16px] shadow-[inset_0_2px_4px_rgba(255,255,255,0.6)] p-4">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce delay-100"></div>
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-200"></div>
                  <span className="text-gray-600 ml-2">Ruby is thinking...</span>
                </div>
              </div>
            </div>
          )}


          {/* Error State */}
          {error && (
            <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-100/50 rounded-[16px] shadow-[inset_0_2px_4px_rgba(255,255,255,0.6)] p-4">
              <p className="text-red-700">Oops! Something went wrong. Please try again!</p>
            </div>
          )}

          {/* Scroll target */}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="p-6 border-t border-purple-100/50">
          <div className="flex space-x-3">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Tell Ruby what you'd like to build..."
              className="flex-1 px-4 py-3 bg-white/60 backdrop-blur-sm border border-white/30 rounded-[16px] shadow-[inset_0_2px_4px_rgba(255,255,255,0.6)] focus:outline-none focus:border-purple-300 focus:shadow-[inset_0_2px_4px_rgba(255,255,255,0.6),0_0_0_3px_rgba(147,51,234,0.1)] text-gray-800 placeholder-gray-500"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!userInput.trim() || isLoading}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-[16px] shadow-[0_8px_32px_rgba(147,51,234,0.3),inset_0_2px_4px_rgba(255,255,255,0.3)] hover:shadow-[0_12px_40px_rgba(147,51,234,0.4)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  )
})

RubyProjectScopingChat.displayName = 'RubyProjectScopingChat'

export default RubyProjectScopingChat
