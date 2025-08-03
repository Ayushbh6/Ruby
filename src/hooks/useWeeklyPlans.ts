import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { type RubyMasterPlan } from '../lib/schemas'

export interface WeeklyPlan {
  id: string
  project_id: string
  week_number: number
  week_title: string
  week_description: string | null
  learning_objectives: string[]
  target_concepts: string[]
  attempt_number: number
  difficulty_level: 'normal' | 'adapted' | 'simplified' | 'beginner' | 'intermediate' | 'advanced'
  status: 'locked' | 'current' | 'completed' | 'skipped' | 'struggling' | 'failed' | 'planned' | 'active' | 'simplified'
  progress_percentage: number
  daily_goals: any[]
  estimated_sessions: number
  created_at: string
  updated_at: string
  started_at: string | null
  completed_at: string | null
  goals: any
  deliverables: string[]
}

export function useWeeklyPlans(projectId?: string) {
  const { user } = useAuth()
  const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlan[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchWeeklyPlans = async (id?: string) => {
    const targetProjectId = id || projectId
    if (!user || !targetProjectId) {
      setWeeklyPlans([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('weekly_plans')
        .select('*')
        .eq('project_id', targetProjectId)
        .order('week_number', { ascending: true })

      if (fetchError) {
        throw fetchError
      }

      setWeeklyPlans(data || [])
    } catch (err) {
      console.error('Error fetching weekly plans:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch weekly plans')
      setWeeklyPlans([])
    } finally {
      setLoading(false)
    }
  }

  const createWeeklyPlansFromMasterPlan = async (projectId: string, masterPlan: RubyMasterPlan) => {
    if (!user) {
      throw new Error('User must be authenticated to create weekly plans')
    }

    try {
      setLoading(true)
      setError(null)

      // Create weekly plan records from master plan breakdown
      const weeklyPlanInserts = masterPlan.weekly_breakdown.map(week => ({
        project_id: projectId,
        week_number: week.week,
        week_title: week.title,
        week_description: week.main_goal,
        learning_objectives: [week.main_goal],
        target_concepts: week.concepts || [],
        attempt_number: 1,
        difficulty_level: masterPlan.difficulty_assessment,
        status: week.week === 1 ? 'current' : 'locked',
        progress_percentage: 0,
        estimated_sessions: week.estimated_sessions || 3,
        goals: {
          main_goal: week.main_goal,
          concepts: week.concepts || [],
          deliverables: week.deliverables || []
        },
        deliverables: week.deliverables || []
      }))

      const { data, error: createError } = await supabase
        .from('weekly_plans')
        .insert(weeklyPlanInserts)
        .select()

      if (createError) {
        console.error('Database error creating weekly plans:', createError)
        throw createError
      }

      setWeeklyPlans(data || [])
      return { data, error: null }
    } catch (err) {
      console.error('Error creating weekly plans:', err)
      setError(err instanceof Error ? err.message : 'Failed to create weekly plans')
      return { 
        data: null, 
        error: err instanceof Error ? err.message : 'Failed to create weekly plans' 
      }
    } finally {
      setLoading(false)
    }
  }

  const updateWeeklyPlan = async (weeklyPlanId: string, updates: Partial<WeeklyPlan>) => {
    if (!user) {
      throw new Error('User must be authenticated to update weekly plans')
    }

    try {
      const { data, error: updateError } = await supabase
        .from('weekly_plans')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', weeklyPlanId)
        .select()
        .single()

      if (updateError) {
        throw updateError
      }

      // Refresh weekly plans
      await fetchWeeklyPlans()
      
      return { data, error: null }
    } catch (err) {
      console.error('Error updating weekly plan:', err)
      return { 
        data: null, 
        error: err instanceof Error ? err.message : 'Failed to update weekly plan' 
      }
    }
  }

  // Effect to fetch weekly plans when projectId changes
  useEffect(() => {
    if (projectId) {
      fetchWeeklyPlans(projectId)
    }
  }, [projectId, user])

  return {
    weeklyPlans,
    loading,
    error,
    fetchWeeklyPlans,
    createWeeklyPlansFromMasterPlan,
    updateWeeklyPlan
  }
}