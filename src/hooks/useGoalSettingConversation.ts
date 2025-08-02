import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export interface GoalSettingConversation {
  id: string
  user_id: string
  session_id: string
  project_name: string | null
  project_description: string | null
  final_goal_decided: boolean
  total_messages: number
  started_at: string
  ended_at: string | null
  created_at: string
}

export interface GoalSettingMessage {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  message_order: number
  timestamp: string
}

export function useGoalSettingConversation() {
  const { user } = useAuth()
  const [currentConversation, setCurrentConversation] = useState<GoalSettingConversation | null>(null)
  const [messages, setMessages] = useState<GoalSettingMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Generate unique session ID
  const generateSessionId = () => {
    return `goal-setting-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
  }

  // Create a new goal setting conversation
  const startNewConversation = async (): Promise<GoalSettingConversation | null> => {
    if (!user) {
      setError('User must be authenticated')
      return null
    }

    try {
      setLoading(true)
      setError(null)

      const sessionId = generateSessionId()

      const { data, error: createError } = await supabase
        .from('goal_setting_conversations')
        .insert([
          {
            user_id: user.id,
            session_id: sessionId,
            final_goal_decided: false,
            total_messages: 0
          }
        ])
        .select()
        .single()

      if (createError) {
        throw createError
      }

      setCurrentConversation(data)
      setMessages([])
      return data
    } catch (err) {
      console.error('Error starting conversation:', err)
      setError(err instanceof Error ? err.message : 'Failed to start conversation')
      return null
    } finally {
      setLoading(false)
    }
  }

  // Load existing conversation by session ID
  const loadConversation = async (sessionId: string) => {
    if (!user) {
      setError('User must be authenticated')
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Get conversation
      const { data: conversation, error: convError } = await supabase
        .from('goal_setting_conversations')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .single()

      if (convError) {
        throw convError
      }

      // Get messages
      const { data: messages, error: msgError } = await supabase
        .from('goal_setting_messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('message_order', { ascending: true })

      if (msgError) {
        throw msgError
      }

      setCurrentConversation(conversation)
      setMessages(messages || [])
    } catch (err) {
      console.error('Error loading conversation:', err)
      setError(err instanceof Error ? err.message : 'Failed to load conversation')
    } finally {
      setLoading(false)
    }
  }

  // Add a message to the current conversation
  const addMessage = async (role: 'user' | 'assistant', content: string, conversation?: GoalSettingConversation) => {
    const conversationToUse = conversation || currentConversation
    if (!conversationToUse) {
      throw new Error('No active conversation')
    }

    try {
      // Get the current maximum message order for this conversation
      const { data: maxOrderResult, error: maxOrderError } = await supabase
        .from('goal_setting_messages')
        .select('message_order')
        .eq('conversation_id', conversationToUse.id)
        .order('message_order', { ascending: false })
        .limit(1)

      if (maxOrderError) {
        throw maxOrderError
      }

      const messageOrder = (maxOrderResult?.[0]?.message_order || 0) + 1

      const { data: message, error: msgError } = await supabase
        .from('goal_setting_messages')
        .insert([
          {
            conversation_id: conversationToUse.id,
            role,
            content,
            message_order: messageOrder
          }
        ])
        .select()
        .single()

      if (msgError) {
        throw msgError
      }

      // Update conversation message count
      const { error: updateError } = await supabase
        .from('goal_setting_conversations')
        .update({ 
          total_messages: messageOrder 
        })
        .eq('id', conversationToUse.id)

      if (updateError) {
        throw updateError
      }

      // Update local state
      setMessages(prev => [...prev, message])
      setCurrentConversation(prev => prev ? { ...prev, total_messages: messageOrder } : null)

      return message
    } catch (err) {
      console.error('Error adding message:', err)
      throw err
    }
  }

  // Update conversation when goal is finalized
  const finalizeGoal = async (projectName: string, projectDescription: string) => {
    if (!currentConversation) {
      throw new Error('No active conversation')
    }

    try {
      const { data, error: updateError } = await supabase
        .from('goal_setting_conversations')
        .update({
          project_name: projectName,
          project_description: projectDescription,
          final_goal_decided: true,
          ended_at: new Date().toISOString()
        })
        .eq('id', currentConversation.id)
        .select()
        .single()

      if (updateError) {
        throw updateError
      }

      setCurrentConversation(data)
      return data
    } catch (err) {
      console.error('Error finalizing goal:', err)
      throw err
    }
  }

  // Get conversation history for Ruby (formatted for AI)
  const getConversationHistory = () => {
    return messages.map(msg => ({
      user: msg.role === 'user' ? msg.content : '',
      ruby: msg.role === 'assistant' ? msg.content : ''
    })).filter(msg => msg.user || msg.ruby)
  }

  // Get the most recent conversation for a user (if exists)
  const getLatestConversation = async () => {
    if (!user) return null

    try {
      const { data, error } = await supabase
        .from('goal_setting_conversations')
        .select('*')
        .eq('user_id', user.id)
        .eq('final_goal_decided', false) // Only unfinished conversations
        .order('started_at', { ascending: false })
        .limit(1)

      if (error) {
        throw error
      }

      return data?.[0] || null
    } catch (err) {
      console.error('Error getting latest conversation:', err)
      return null
    }
  }

  return {
    currentConversation,
    messages,
    loading,
    error,
    startNewConversation,
    loadConversation,
    addMessage,
    finalizeGoal,
    getConversationHistory,
    getLatestConversation
  }
}
