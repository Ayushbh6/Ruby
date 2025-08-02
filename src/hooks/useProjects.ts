import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export interface Project {
  id: string
  user_id: string
  title: string
  description: string | null
  project_type: 'game' | 'animation' | 'interactive_story' | 'art' | 'music' | 'quiz' | 'experiment' | 'calculator' | 'data_viz'
  initial_request: string
  scoped_goal: string
  duration_weeks: number
  master_plan: any
  plan_approved: boolean
  plan_approved_at: string | null
  learning_goal: string
  target_concepts: string[]
  difficulty_level: 'beginner' | 'intermediate' | 'advanced'
  status: 'planning' | 'active' | 'completed' | 'paused' | 'archived'
  current_week: number
  progress_percentage: number
  concepts_mastered: string[]
  total_sessions: number
  total_time_spent: string // interval type from PostgreSQL
  milestones_reached: any[]
  created_at: string
  updated_at: string
  completed_at: string | null
  is_public: boolean
  is_template: boolean
}

export function useProjects() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProjects = async () => {
    if (!user) {
      setProjects([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })

      if (fetchError) {
        throw fetchError
      }

      setProjects(data || [])
    } catch (err) {
      console.error('Error fetching projects:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch projects')
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  const createProject = async (projectData: {
    title: string
    description?: string
    project_type: Project['project_type']
    initial_request: string
    scoped_goal: string
    duration_weeks: number
    learning_goal: string
    difficulty_level?: Project['difficulty_level']
  }) => {
    if (!user) {
      throw new Error('User must be authenticated to create projects')
    }

    try {
      const { data, error: createError } = await supabase
        .from('projects')
        .insert([
          {
            user_id: user.id,
            title: projectData.title,
            description: projectData.description || null,
            project_type: projectData.project_type,
            initial_request: projectData.initial_request,
            scoped_goal: projectData.scoped_goal,
            duration_weeks: projectData.duration_weeks,
            learning_goal: projectData.learning_goal,
            difficulty_level: projectData.difficulty_level || 'beginner',
            master_plan: {}, // Will be populated by Ruby AI later
            status: 'planning',
            current_week: 0,
            progress_percentage: 0
          }
        ])
        .select()
        .single()

      if (createError) {
        throw createError
      }

      // Refresh projects list
      await fetchProjects()
      
      return { data, error: null }
    } catch (err) {
      console.error('Error creating project:', err)
      return { 
        data: null, 
        error: err instanceof Error ? err.message : 'Failed to create project' 
      }
    }
  }

  const updateProject = async (projectId: string, updates: Partial<Project>) => {
    if (!user) {
      throw new Error('User must be authenticated to update projects')
    }

    try {
      const { data, error: updateError } = await supabase
        .from('projects')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId)
        .eq('user_id', user.id) // Ensure user can only update their own projects
        .select()
        .single()

      if (updateError) {
        throw updateError
      }

      // Refresh projects list
      await fetchProjects()
      
      return { data, error: null }
    } catch (err) {
      console.error('Error updating project:', err)
      return { 
        data: null, 
        error: err instanceof Error ? err.message : 'Failed to update project' 
      }
    }
  }

  const deleteProject = async (projectId: string) => {
    if (!user) {
      throw new Error('User must be authenticated to delete projects')
    }

    try {
      const { error: deleteError } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
        .eq('user_id', user.id) // Ensure user can only delete their own projects

      if (deleteError) {
        throw deleteError
      }

      // Refresh projects list
      await fetchProjects()
      
      return { error: null }
    } catch (err) {
      console.error('Error deleting project:', err)
      return { 
        error: err instanceof Error ? err.message : 'Failed to delete project' 
      }
    }
  }

  // Effect to fetch projects when user changes
  useEffect(() => {
    fetchProjects()
  }, [user])

  return {
    projects,
    loading,
    error,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject
  }
}
