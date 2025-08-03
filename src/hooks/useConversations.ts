import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'ruby' | 'assistant';
  content: string;
  message_order: number;
  thought?: string;
  action?: string;
  code?: string;
  code_language?: string;
  concept_taught?: string;
  difficulty_level?: string;
  learning_objective?: string;
  ruby_response_tone?: string;
  user_understood?: boolean;
  needs_retry?: boolean;
  timestamp: string;
  execution_status?: string;
}

export interface Conversation {
  id: string;
  project_id: string;
  weekly_plan_id: string;
  title?: string;
  display_order: number;
  conversation_type: 'learning' | 'debugging' | 'exploration' | 'review' | 'help';
  status: 'active' | 'completed' | 'interrupted' | 'error';
  concepts_covered: string[];
  learning_objectives?: string[];
  total_messages: number;
  user_messages: number;
  ruby_messages: number;
  code_generated_count: number;
  engagement_score?: number;
  confusion_indicators: number;
  success_moments: number;
  started_at: string;
  ended_at?: string;
  last_activity_at: string;
  goals_achieved: boolean;
  next_session_plan?: string;
  parent_summary?: string;
  session_number?: number;
}

export function useConversations(projectId: string, weeklyPlanId?: string) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);

  // Fetch conversations for a project
  const fetchConversations = useCallback(async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('conversations')
        .select('*')
        .eq('project_id', projectId)
        .order('display_order', { ascending: true });

      if (weeklyPlanId) {
        query = query.eq('weekly_plan_id', weeklyPlanId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      setConversations(data || []);
    } catch (err) {
      console.error('Error fetching conversations:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch conversations');
    } finally {
      setLoading(false);
    }
  }, [projectId, weeklyPlanId, supabase]);

  // Fetch messages for a specific conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('message_order', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      setMessages(data || []);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch messages');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Create a new conversation
  const createConversation = useCallback(async (
    weeklyPlanId: string,
    title?: string,
    conversationType: Conversation['conversation_type'] = 'learning'
  ) => {
    try {
      setError(null);

      // Get the next display order
      const { data: existingConversations } = await supabase
        .from('conversations')
        .select('display_order')
        .eq('project_id', projectId)
        .eq('weekly_plan_id', weeklyPlanId)
        .order('display_order', { ascending: false })
        .limit(1);

      const nextOrder = existingConversations && existingConversations.length > 0 
        ? existingConversations[0].display_order + 1 
        : 1;

      const { data, error: createError } = await supabase
        .from('conversations')
        .insert({
          project_id: projectId,
          weekly_plan_id: weeklyPlanId,
          title: title || `Conversation ${nextOrder}`,
          display_order: nextOrder,
          conversation_type: conversationType,
          status: 'active'
        })
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      // Refresh conversations
      await fetchConversations();
      
      return data;
    } catch (err) {
      console.error('Error creating conversation:', err);
      setError(err instanceof Error ? err.message : 'Failed to create conversation');
      return null;
    }
  }, [projectId, supabase, fetchConversations]);

  // Send a message
  const sendMessage = useCallback(async (
    conversationId: string,
    content: string,
    role: 'user' | 'ruby' = 'user'
  ) => {
    try {
      setSendingMessage(true);
      setError(null);

      // Get the next message order
      const { data: existingMessages } = await supabase
        .from('messages')
        .select('message_order')
        .eq('conversation_id', conversationId)
        .order('message_order', { ascending: false })
        .limit(1);

      const nextOrder = existingMessages && existingMessages.length > 0 
        ? existingMessages[0].message_order + 1 
        : 1;

      // Insert the message
      const { data, error: insertError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          role,
          content,
          message_order: nextOrder
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      // Update conversation stats
      const { data: currentConv } = await supabase
        .from('conversations')
        .select('total_messages, user_messages, ruby_messages')
        .eq('id', conversationId)
        .single();

      if (currentConv) {
        const updateData: any = {
          total_messages: currentConv.total_messages + 1,
          last_activity_at: new Date().toISOString()
        };

        if (role === 'user') {
          updateData.user_messages = currentConv.user_messages + 1;
        } else {
          updateData.ruby_messages = currentConv.ruby_messages + 1;
        }

        const { error: updateError } = await supabase
          .from('conversations')
          .update(updateData)
          .eq('id', conversationId);

        if (updateError) {
          console.error('Error updating conversation stats:', updateError);
        }
      }

      // Refresh messages for the current conversation
      if (activeConversation?.id === conversationId) {
        await fetchMessages(conversationId);
      }

      return data;
    } catch (err) {
      console.error('Error sending message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
      return null;
    } finally {
      setSendingMessage(false);
    }
  }, [supabase, activeConversation?.id, fetchMessages]);

  // Set active conversation and fetch its messages
  const setActiveConversationAndFetch = useCallback(async (conversation: Conversation) => {
    setActiveConversation(conversation);
    await fetchMessages(conversation.id);
  }, [fetchMessages]);

  const clearActiveConversation = useCallback(() => {
    setActiveConversation(null);
    setMessages([]);
  }, []);

  // Auto-fetch conversations when projectId or weeklyPlanId changes
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return {
    conversations,
    activeConversation,
    messages,
    loading,
    error,
    sendingMessage,
    fetchConversations,
    fetchMessages,
    createConversation,
    sendMessage,
    setActiveConversation: setActiveConversationAndFetch,
    clearActiveConversation
  };
}
