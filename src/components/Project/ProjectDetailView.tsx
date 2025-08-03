'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { 
  type RubyProjectOverview,
  type RubyWeeklyBreakdown
} from '../../lib/schemas'
import type { Project } from '../../hooks/useProjects'

interface ProjectDetailViewProps {
  project: Project
  onProjectUpdated: (updates: Partial<Project>) => void
}

type ProjectPhase = 'planning' | 'active' | 'completed'
type PlanningStep = 'overview' | 'overview-review' | 'breakdown' | 'complete'

export default function ProjectDetailView({
  project,
  onProjectUpdated
}: ProjectDetailViewProps) {
  const router = useRouter()
  const { getAuthToken } = useAuth()
  
  const [phase, setPhase] = useState<ProjectPhase>(project.status as ProjectPhase || 'planning')
  const [showFullPlan, setShowFullPlan] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [projectOverview, setProjectOverview] = useState<RubyProjectOverview | null>(null)
  const [weeklyBreakdown, setWeeklyBreakdown] = useState<RubyWeeklyBreakdown | null>(null)
  
  // Planning steps: overview -> overview-review -> breakdown -> complete
  const [planningStep, setPlanningStep] = useState<PlanningStep>('overview')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Editable duration (user can modify after overview)
  const [editableDuration, setEditableDuration] = useState<number>(1)
  
  // Auto-save states for duration changes
  const [isSavingDuration, setIsSavingDuration] = useState(false)
  const [durationSaved, setDurationSaved] = useState(false)
  
  // Use refs to persist across component remounts (survives fast refresh and tab switching)
  const hasGeneratedOverviewRef = useRef(false)
  const hasGeneratedBreakdownRef = useRef(false)
  
  // Track the project ID to reset state when project changes
  const lastProjectIdRef = useRef<string>('')

  // Load existing plans from database on mount - use project.id to prevent unnecessary re-runs
  useEffect(() => {
    // Reset state if project changed
    if (lastProjectIdRef.current !== project.id) {
      console.log('🔄 Project changed, resetting state')
      hasGeneratedOverviewRef.current = false
      hasGeneratedBreakdownRef.current = false
      setProjectOverview(null)
      setWeeklyBreakdown(null)
      setError(null)
      setIsLoading(false)
      lastProjectIdRef.current = project.id
    }

    const loadExistingPlan = () => {
      if (project.master_plan && typeof project.master_plan === 'object') {
        const masterPlan = project.master_plan as any
        
        console.log('📋 Loading existing plan from database:', masterPlan)
        
        // Check if we have overview data
        if (masterPlan.overview) {
          console.log('✅ Found existing overview - setting hasGenerated to true')
          setProjectOverview(masterPlan.overview)
          setEditableDuration(masterPlan.overview.recommended_duration || project.duration_weeks)
          hasGeneratedOverviewRef.current = true // Mark as generated since it exists in DB
          
          // Check if we have complete plan
          if (masterPlan.breakdown && masterPlan.complete) {
            console.log('✅ Found complete plan')
            setWeeklyBreakdown(masterPlan.breakdown)
            hasGeneratedBreakdownRef.current = true
            setPlanningStep('complete')
          } else {
            setPlanningStep('overview-review')
          }
        } else if (Object.keys(masterPlan).length > 0) {
          // Has some data but no overview - check if it's valid plan data
          const hasValidPlanData = masterPlan.overview || masterPlan.breakdown || masterPlan.complete
          if (hasValidPlanData) {
            console.log('📋 Found partial plan data - preventing auto-generation')
            hasGeneratedOverviewRef.current = true
            setPlanningStep('overview')
          } else {
            // Has invalid/test data - clear it and allow auto-generation
            console.log('📋 Found invalid plan data - clearing and allowing auto-generation')
            setPlanningStep('overview')
          }
        } else {
          // Empty master_plan object - can auto-generate
          console.log('📋 Empty master plan - allowing auto-generation')
          setPlanningStep('overview')
        }
      } else {
        // No master plan data, start from beginning
        console.log('📋 No master plan data - allowing auto-generation')
        setPlanningStep('overview')
      }
    }
    
    loadExistingPlan()
  }, [project.id])

  // Debug component mount/unmount
  useEffect(() => {
    console.log('📋 ProjectDetailView mounted for project:', project.id)
    return () => {
      console.log('🗑️ ProjectDetailView unmounting for project:', project.id)
    }
  }, [project.id])

  const generateProjectOverview = useCallback(async (isReplay = false) => {
    console.log('🔥 generateProjectOverview called - hasGenerated:', hasGeneratedOverviewRef.current, 'isLoading:', isLoading, 'isReplay:', isReplay)
    
    // Prevent duplicate calls (unless it's a replay)
    if (!isReplay && hasGeneratedOverviewRef.current || isLoading) {
      console.log('❌ Skipping - already generated or loading')
      return
    }
    
    // Additional check: if there's existing VALID data in the database, don't auto-generate
    if (!isReplay && project.master_plan && typeof project.master_plan === 'object' && Object.keys(project.master_plan).length > 0) {
      const hasValidPlanData = project.master_plan.overview || project.master_plan.breakdown || project.master_plan.complete
      if (hasValidPlanData) {
        console.log('❌ Skipping - existing valid data found in database')
        hasGeneratedOverviewRef.current = true // Mark as generated to prevent future auto-calls
        return
      } else {
        console.log('🔄 Found invalid data, proceeding with generation to replace it')
      }
    }
    
    console.log('✅ Proceeding with API call')
    hasGeneratedOverviewRef.current = true // Mark as attempted immediately
    setIsLoading(true)
    setError(null)
    
    try {
      // Call API route (no authentication needed)
      const response = await fetch('/api/generate-project-overview', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectName: project.title,
          projectDescription: project.description || project.scoped_goal,
          userAge: 8,
          experienceLevel: 'beginner'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate project overview')
      }

      const result = await response.json()
      console.log('Project overview result:', result) // Debug log
      
      // Handle the response structure from generateObject
      const overview = result.object || result
      setProjectOverview(overview)
      setEditableDuration(overview?.recommended_duration || 1)
      setPlanningStep('overview-review')
      
      // Save to database using client-side auth
      const { error: updateError } = await supabase
        .from('projects')
        .update({
          master_plan: {
            overview: overview,
            overview_generated_at: new Date().toISOString()
          },
          project_type: overview.project_type,
          difficulty_level: overview.difficulty_assessment,
          duration_weeks: overview.recommended_duration,
          learning_goal: overview.learning_trajectory,
          status: 'planning',
          updated_at: new Date().toISOString()
        })
        .eq('id', project.id)

      if (updateError) {
        console.error('Error saving project overview:', updateError)
        // Don't throw error here - the overview was generated successfully
        // Just log the error and continue
      }
      
      // Call onProjectUpdated to refresh project data
      if (onProjectUpdated) {
        onProjectUpdated({
          master_plan: {
            overview: overview,
            overview_generated_at: new Date().toISOString()
          },
          project_type: overview.project_type,
          difficulty_level: overview.difficulty_assessment,
          duration_weeks: overview.recommended_duration,
          learning_goal: overview.learning_trajectory,
          status: 'planning',
          updated_at: new Date().toISOString()
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate overview')
      hasGeneratedOverviewRef.current = false // Reset flag on error so user can retry
    } finally {
      setIsLoading(false)
    }
  }, [project.id, project.title, project.description, project.scoped_goal, isLoading, onProjectUpdated])

  // Auto-start planning ONLY if no existing data and not already generated AND user hasn't interacted yet
  useEffect(() => {
    console.log('🔍 Planning effect triggered:', {
      phase,
      hasProjectOverview: !!projectOverview,
      planningStep,
      hasGeneratedOverview: hasGeneratedOverviewRef.current,
      isLoading
    })
    
    // Only auto-generate if:
    // 1. We're in planning phase
    // 2. No project overview exists in state OR database
    // 3. We're on the overview step
    // 4. We haven't attempted generation yet
    // 5. We're not currently loading
    // 6. There's no existing VALID data in the database
    const hasValidExistingData = project.master_plan && 
                                typeof project.master_plan === 'object' && 
                                Object.keys(project.master_plan).length > 0 &&
                                (project.master_plan.overview || project.master_plan.breakdown || project.master_plan.complete)
    
    if (phase === 'planning' && 
        !projectOverview && 
        planningStep === 'overview' && 
        !hasGeneratedOverviewRef.current && 
        !isLoading &&
        !hasValidExistingData) {
      console.log('🚀 Starting project overview generation...')
      generateProjectOverview()
    } else if (hasValidExistingData) {
      console.log('📋 Skipping auto-generation - existing valid data found in database')
    }
  }, [phase, projectOverview, planningStep, isLoading, generateProjectOverview, project.master_plan])

  const generateWeeklyBreakdown = useCallback(async (isReplay = false) => {
    if (!projectOverview) return
    
    // Prevent duplicate calls (unless it's a replay)
    if (!isReplay && hasGeneratedBreakdownRef.current || isLoading) {
      return
    }
    
    hasGeneratedBreakdownRef.current = true // Mark as attempted immediately
    setIsLoading(true)
    setError(null)
    setPlanningStep('breakdown')
    
    try {
      // Update overview with user's edited duration
      const updatedOverview = { ...projectOverview, recommended_duration: editableDuration }
      
      const response = await fetch('/api/generate-weekly-breakdown', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectName: project.title,
          projectDescription: project.description || project.scoped_goal,
          projectOverview: updatedOverview,
          userAge: 8,
          experienceLevel: 'beginner'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate weekly breakdown')
      }

      const result = await response.json()
      console.log('Weekly breakdown result:', result) // Debug log
      
      // Handle the response structure from generateObject
      const breakdown = result.object || result
      setWeeklyBreakdown(breakdown)
      setPlanningStep('complete')
      
      // Save to database using client-side auth
      // First, get the current master_plan to preserve the overview
      const { data: currentProject, error: fetchError } = await supabase
        .from('projects')
        .select('master_plan')
        .eq('id', project.id)
        .single()

      if (fetchError) {
        console.error('Error fetching current project:', fetchError)
        // Don't throw error - the breakdown was generated successfully
      } else {
        // Combine overview and breakdown into complete master plan
        const completeMasterPlan = {
          ...currentProject.master_plan,
          breakdown: breakdown,
          breakdown_generated_at: new Date().toISOString(),
          complete: true
        }

        // Update the projects table with complete master plan
        const { error: updateError } = await supabase
          .from('projects')
          .update({
            master_plan: completeMasterPlan,
            duration_weeks: updatedOverview.recommended_duration,
            status: 'planning',
            updated_at: new Date().toISOString()
          })
          .eq('id', project.id)

        if (updateError) {
          console.error('Error saving weekly breakdown:', updateError)
          // Don't throw error - the breakdown was generated successfully
        }

        // Call onProjectUpdated with the updated data
        if (onProjectUpdated) {
          onProjectUpdated({
            master_plan: completeMasterPlan,
            duration_weeks: updatedOverview.recommended_duration,
            status: 'planning',
            updated_at: new Date().toISOString()
          })
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate breakdown')
      hasGeneratedBreakdownRef.current = false // Reset flag on error so user can retry
      setPlanningStep('overview-review') // Go back to review step on error
    } finally {
      setIsLoading(false)
    }
  }, [projectOverview, editableDuration, project.id, project.title, project.description, project.scoped_goal, isLoading, onProjectUpdated])

  // Auto-save duration changes to database
  const saveDurationChange = useCallback(async (newDuration: number) => {
    if (!projectOverview || newDuration === projectOverview.recommended_duration) {
      return // No change needed
    }

    setIsSavingDuration(true)
    setDurationSaved(false)

    try {
      // Update the overview with new duration
      const updatedOverview = { ...projectOverview, recommended_duration: newDuration }
      
      // Save to database
      const { error: updateError } = await supabase
        .from('projects')
        .update({
          master_plan: {
            ...project.master_plan,
            overview: updatedOverview,
            overview_generated_at: project.master_plan?.overview_generated_at || new Date().toISOString()
          },
          duration_weeks: newDuration,
          updated_at: new Date().toISOString()
        })
        .eq('id', project.id)

      if (updateError) {
        console.error('Error saving duration change:', updateError)
        return
      }

      // Update local state
      setProjectOverview(updatedOverview)
      setDurationSaved(true)

      // Call onProjectUpdated
      if (onProjectUpdated) {
        onProjectUpdated({
          master_plan: {
            ...project.master_plan,
            overview: updatedOverview
          },
          duration_weeks: newDuration,
          updated_at: new Date().toISOString()
        })
      }

      // Clear the "saved" indicator after 2 seconds
      setTimeout(() => setDurationSaved(false), 2000)
    } catch (err) {
      console.error('Error saving duration:', err)
    } finally {
      setIsSavingDuration(false)
    }
  }, [projectOverview, project.id, project.master_plan, onProjectUpdated])

  // Auto-save when duration changes (with debounce)
  useEffect(() => {
    if (!projectOverview || editableDuration === projectOverview.recommended_duration) {
      return
    }

    const timeoutId = setTimeout(() => {
      saveDurationChange(editableDuration)
    }, 1000) // 1 second debounce

    return () => clearTimeout(timeoutId)
  }, [editableDuration, saveDurationChange])

  const handleApprovePlan = async () => {
    if (!projectOverview || !weeklyBreakdown || !weeklyBreakdown.weekly_breakdown || weeklyBreakdown.weekly_breakdown.length === 0) {
      alert('Plan is not fully generated yet. Please wait for Ruby to finish.')
      return
    }
    
    setIsApproving(true)
    try {
      // Simply mark the plan as approved and move to active phase
      await onProjectUpdated({
        plan_approved: true,
        plan_approved_at: new Date().toISOString(),
        status: 'active',
        current_week: 1
      })
      
      // Move to active phase
      setPhase('active')
    } catch (error) {
      console.error('Error approving plan:', error)
      alert('Failed to approve plan. Please try again.')
    } finally {
      setIsApproving(false)
    }
  }

  const handleBackToDashboard = () => {
    router.push('/')
  }

  const getWeekEmoji = (weekNumber: number) => {
    const emojis = ['🌱', '🌿', '🌸', '🌟']
    return emojis[weekNumber - 1] || '✨'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100">
      {/* Header */}
      <div className="bg-white/70 backdrop-blur-md border-b border-white/30 shadow-[0_4px_24px_rgba(147,51,234,0.1)]">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBackToDashboard}
                className="w-10 h-10 bg-white/60 backdrop-blur-sm border border-white/30 rounded-full shadow-[inset_0_2px_4px_rgba(255,255,255,0.6)] flex items-center justify-center text-gray-600 hover:text-purple-600 transition-colors"
              >
                ←
              </button>
              
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  {project.title}
                </h1>
                <p className="text-gray-600 text-sm">
                  {phase === 'planning' ? 'Planning Phase' : phase === 'active' ? `Week ${project.current_week}/${project.duration_weeks}` : 'Completed'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                phase === 'planning' ? 'bg-yellow-100 text-yellow-800' :
                phase === 'active' ? 'bg-green-100 text-green-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {phase === 'planning' ? '📋 Planning' : phase === 'active' ? '🚀 Active' : '✅ Completed'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Planning Phase */}
        {phase === 'planning' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white/90 backdrop-blur-md border border-white/30 rounded-[24px] shadow-[inset_0_4px_12px_rgba(255,255,255,0.7),0_16px_48px_rgba(147,51,234,0.3)] p-8">
              
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
                  Let's Plan Your Project! 🎯
                </h2>
                <p className="text-gray-600 text-lg">
                  {planningStep === 'overview' && 'Ruby is analyzing your project and creating a personalized learning plan just for you.'}
                  {planningStep === 'overview-review' && 'Review your project overview and adjust the duration if needed.'}
                  {planningStep === 'breakdown' && 'Ruby is creating your detailed weekly breakdown.'}
                  {planningStep === 'complete' && 'Your complete learning plan is ready for review!'}
                </p>
              </div>

              {/* Loading State */}
              {isLoading && (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-16 h-16 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full shadow-[inset_0_2px_4px_rgba(255,255,255,0.4)] flex items-center justify-center mb-4">
                    <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <h3 className="text-lg font-bold text-gray-700 mb-2">
                    {planningStep === 'overview' ? 'Ruby is analyzing your project...' : 'Ruby is creating your weekly plan...'}
                  </h3>
                  <p className="text-gray-600 text-center">
                    {planningStep === 'overview' 
                      ? 'Determining project type, difficulty, and duration!'
                      : 'Designing week-by-week learning activities!'
                    }
                  </p>
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-100/50 rounded-[16px] shadow-[inset_0_2px_4px_rgba(255,255,255,0.6)] p-6 text-center">
                  <div className="text-4xl mb-4">😅</div>
                  <h3 className="text-lg font-bold text-red-700 mb-2">Oops! Something went wrong</h3>
                  <p className="text-red-600 mb-4">{error}</p>
                  <button
                    onClick={() => {
                      console.log('🔄 User clicked "Try Again" after error')
                      setPlanningStep('overview')
                      setProjectOverview(null)
                      setWeeklyBreakdown(null)
                      setError(null)
                      hasGeneratedOverviewRef.current = false
                      hasGeneratedBreakdownRef.current = false
                      generateProjectOverview(true) // Try again with replay mode for different approach
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-[12px] shadow-[0_4px_16px_rgba(147,51,234,0.3)] hover:shadow-[0_6px_20px_rgba(147,51,234,0.4)] transition-all duration-300"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* Project Overview Display */}
              {projectOverview && (planningStep === 'overview-review' || planningStep === 'breakdown' || planningStep === 'complete') && (
                <div className="space-y-6">
                  
                  {/* Ruby's Response */}
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100/50 rounded-[16px] shadow-[inset_0_2px_4px_rgba(255,255,255,0.6)] p-6">
                    <div className="flex items-start space-x-3 mb-4">
                      <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full shadow-[inset_0_2px_4px_rgba(255,255,255,0.4)] flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-white">R</span>
                      </div>
                      <div className="text-gray-800 prose prose-sm max-w-none">
                        <ReactMarkdown>{projectOverview.response || 'Ruby is excited to help you build this project!'}</ReactMarkdown>
                      </div>
                    </div>
                  </div>

                  {/* Plan Overview */}
                  <div className="bg-white/50 rounded-[20px] p-6 shadow-[inset_0_2px_4px_rgba(255,255,255,0.8),0_4px_16px_rgba(0,0,0,0.1)] border border-white/30">
                    <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                      <span className="mr-2">🎯</span>
                      Your Learning Journey
                    </h4>
                    
                    <div className="grid md:grid-cols-3 gap-4 mb-6">
                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100/50 rounded-[12px] p-4">
                        <div className="text-2xl mb-2">🎯</div>
                        <h5 className="font-bold text-gray-800">Project Type</h5>
                        <p className="text-gray-600 capitalize">{projectOverview.project_type?.replace('_', ' ') || 'Unknown'}</p>
                      </div>
                      
                      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-100/50 rounded-[12px] p-4">
                        <div className="text-2xl mb-2">⏱️</div>
                        <h5 className="font-bold text-gray-800">Duration</h5>
                        {planningStep === 'overview-review' ? (
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => setEditableDuration(Math.max(1, editableDuration - 1))}
                                disabled={editableDuration <= 1}
                                className="w-8 h-8 bg-white/60 rounded-full flex items-center justify-center text-gray-600 hover:text-purple-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                -
                              </button>
                              <span className="font-bold text-gray-800 min-w-[3rem] text-center">
                                {editableDuration} week{editableDuration > 1 ? 's' : ''}
                              </span>
                              <button
                                onClick={() => setEditableDuration(Math.min(4, editableDuration + 1))}
                                disabled={editableDuration >= 4}
                                className="w-8 h-8 bg-white/60 rounded-full flex items-center justify-center text-gray-600 hover:text-purple-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                +
                              </button>
                            </div>
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-gray-500">
                                Ruby suggested {projectOverview.recommended_duration || 1} week{(projectOverview.recommended_duration || 1) > 1 ? 's' : ''}
                              </p>
                              {isSavingDuration && (
                                <span className="text-xs text-blue-500 flex items-center">
                                  <svg className="animate-spin h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Saving...
                                </span>
                              )}
                              {durationSaved && !isSavingDuration && (
                                <span className="text-xs text-green-500 flex items-center">
                                  <svg className="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                  Saved
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="text-gray-600">
                            {editableDuration} week{editableDuration > 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                      
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100/50 rounded-[12px] p-4">
                        <div className="text-2xl mb-2">📊</div>
                        <h5 className="font-bold text-gray-800">Difficulty</h5>
                        <p className="text-gray-600 capitalize">{projectOverview.difficulty_assessment || 'beginner'}</p>
                      </div>
                    </div>

                    {/* Learning Trajectory */}
                    <div className="mb-6">
                      <h5 className="font-bold text-gray-800 mb-2">What You'll Learn</h5>
                      <p className="text-gray-600 leading-relaxed">{projectOverview.learning_trajectory || 'Learning programming fundamentals'}</p>
                    </div>

                    {/* Overview Review Actions */}
                    {planningStep === 'overview-review' && (
                      <div className="space-y-3 pt-4 border-t border-gray-200">
                        <div className="flex space-x-3">
                          <button
                            onClick={() => {
                              console.log('️ User clicked "Start Over"')
                              setPlanningStep('overview')
                              setProjectOverview(null)
                              setError(null)
                              hasGeneratedOverviewRef.current = false
                              hasGeneratedBreakdownRef.current = false
                            }}
                            className="px-4 py-2 bg-red-100 hover:bg-red-200 border border-red-300 rounded-[12px] text-red-700 transition-all duration-300"
                          >
                            🗑️ Start Over
                          </button>
                        </div>
                        <button
                          onClick={() => generateWeeklyBreakdown()}
                          disabled={isLoading}
                          className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-[12px] shadow-[0_4px_16px_rgba(147,51,234,0.3)] hover:shadow-[0_6px_20px_rgba(147,51,234,0.4)] transition-all duration-300 disabled:opacity-50 font-medium"
                        >
                          Continue to Weekly Plan →
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Weekly Breakdown Display */}
              {weeklyBreakdown && planningStep === 'complete' && (
                <div className="space-y-6 mt-6">
                  
                  {/* Week 1 Preview */}
                  {weeklyBreakdown.weekly_breakdown && weeklyBreakdown.weekly_breakdown.length > 0 && (
                    <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-100/50 rounded-[20px] p-6 shadow-[inset_0_2px_4px_rgba(255,255,255,0.8),0_4px_16px_rgba(0,0,0,0.1)]">
                      <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                        <span className="mr-2">{getWeekEmoji(1)}</span>
                        Week 1: {weeklyBreakdown.weekly_breakdown[0].title || 'Getting Started'}
                      </h4>
                      
                      <div className="space-y-4">
                        {weeklyBreakdown.weekly_breakdown[0]?.main_goal && (
                          <div>
                            <h5 className="font-bold text-gray-800 mb-2">Main Goal</h5>
                            <p className="text-gray-600">{weeklyBreakdown.weekly_breakdown[0].main_goal}</p>
                          </div>
                        )}
                        
                        {weeklyBreakdown.weekly_breakdown[0]?.concepts && weeklyBreakdown.weekly_breakdown[0].concepts.length > 0 && (
                          <div>
                            <h5 className="font-bold text-gray-800 mb-2">You'll Learn</h5>
                            <div className="flex flex-wrap gap-2">
                              {weeklyBreakdown.weekly_breakdown[0].concepts.map((concept, index) => (
                                <span key={index} className="bg-white/60 px-3 py-1 rounded-full text-sm text-gray-700 border border-gray-200">
                                  {concept}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {weeklyBreakdown.weekly_breakdown[0]?.deliverables && weeklyBreakdown.weekly_breakdown[0].deliverables.length > 0 && (
                          <div>
                            <h5 className="font-bold text-gray-800 mb-2">You'll Build</h5>
                            <ul className="space-y-1">
                              {weeklyBreakdown.weekly_breakdown[0].deliverables.map((deliverable, index) => (
                                <li key={index} className="flex items-start space-x-2">
                                  <span className="text-orange-500 mt-1">•</span>
                                  <span className="text-gray-600">{deliverable}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Full Plan Toggle */}
                  {!showFullPlan && weeklyBreakdown.weekly_breakdown && weeklyBreakdown.weekly_breakdown.length > 1 && (
                    <div className="text-center">
                      <button
                        onClick={() => setShowFullPlan(true)}
                        className="px-6 py-3 bg-white/60 backdrop-blur-sm border border-white/30 rounded-[16px] text-gray-700 hover:text-purple-600 hover:border-purple-300 transition-all duration-300 shadow-[inset_0_2px_4px_rgba(255,255,255,0.6)]"
                      >
                        Show Full {editableDuration}-Week Plan
                      </button>
                    </div>
                  )}

                  {/* Full Plan Display */}
                  {showFullPlan && weeklyBreakdown.weekly_breakdown && weeklyBreakdown.weekly_breakdown.length > 1 && (
                    <div className="space-y-4">
                      <h4 className="text-lg font-bold text-gray-800 flex items-center">
                        <span className="mr-2">📚</span>
                        Complete {editableDuration}-Week Learning Plan
                      </h4>
                      
                      {weeklyBreakdown.weekly_breakdown.slice(1).map((week, index) => {
                        const weekNumber = (week.week || index + 2)
                        return (
                          <div key={weekNumber} className="bg-white/50 rounded-[16px] p-6 shadow-[inset_0_2px_4px_rgba(255,255,255,0.8),0_4px_16px_rgba(0,0,0,0.1)] border border-white/30">
                            <h5 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                              <span className="mr-2">{getWeekEmoji(weekNumber)}</span>
                              Week {weekNumber}: {week.title || `Week ${weekNumber}`}
                            </h5>
                            
                            <div className="grid md:grid-cols-3 gap-4">
                              <div>
                                <h6 className="font-semibold text-gray-700 mb-2">Goal</h6>
                                <p className="text-sm text-gray-600">{week.main_goal || 'Continue building your project'}</p>
                              </div>
                              
                              <div>
                                <h6 className="font-semibold text-gray-700 mb-2">Concepts</h6>
                                <div className="space-y-1">
                                  {(week.concepts || []).map((concept, conceptIndex) => (
                                    <div key={conceptIndex} className="text-sm text-gray-600">• {concept}</div>
                                  ))}
                                </div>
                              </div>
                              
                              <div>
                                <h6 className="font-semibold text-gray-700 mb-2">Deliverables</h6>
                                <div className="space-y-1">
                                  {(week.deliverables || []).map((deliverable, deliverableIndex) => (
                                    <div key={deliverableIndex} className="text-sm text-gray-600">• {deliverable}</div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Success Criteria */}
                  {weeklyBreakdown.success_criteria && weeklyBreakdown.success_criteria.length > 0 && (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100/50 rounded-[16px] p-6">
                      <h5 className="font-bold text-gray-800 mb-3">By the end, you'll be able to:</h5>
                      <div className="grid gap-2">
                        {weeklyBreakdown.success_criteria.map((criteria, index) => (
                          <div key={index} className="flex items-start space-x-2">
                            <span className="text-green-500 mt-1">✓</span>
                            <span className="text-gray-600">{criteria}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              {planningStep === 'complete' && (
                <div className="mt-8 pt-6 border-t border-purple-100/50">
                  
                  {/* Editing Options */}
                  <div className="mb-6 p-4 bg-blue-50 rounded-[16px] border border-blue-100">
                    <h4 className="font-bold text-blue-800 mb-3">Want to make changes?</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <button
                        onClick={() => {
                          hasGeneratedBreakdownRef.current = false
                          setWeeklyBreakdown(null)
                          generateWeeklyBreakdown(true) // isReplay = true
                        }}
                        disabled={isLoading}
                        className="px-4 py-2 bg-orange-100 hover:bg-orange-200 border border-orange-300 rounded-[12px] text-orange-700 transition-all duration-300 disabled:opacity-50 text-sm"
                      >
                        🔄 Regenerate Weekly Plan
                      </button>
                      <button
                        onClick={() => {
                          setPlanningStep('overview-review')
                          hasGeneratedBreakdownRef.current = false
                          setWeeklyBreakdown(null)
                        }}
                        className="px-4 py-2 bg-blue-100 hover:bg-blue-200 border border-blue-300 rounded-[12px] text-blue-700 transition-all duration-300 text-sm"
                      >
                        📝 Edit Duration
                      </button>
                      <button
                        onClick={() => {
                          console.log('🗑️ User clicked "Start Over" from complete step')
                          setPlanningStep('overview')
                          setProjectOverview(null)
                          setWeeklyBreakdown(null)
                          setError(null)
                          hasGeneratedOverviewRef.current = false
                          hasGeneratedBreakdownRef.current = false
                        }}
                        className="px-4 py-2 bg-red-100 hover:bg-red-200 border border-red-300 rounded-[12px] text-red-700 transition-all duration-300 text-sm"
                      >
                        🗑️ Start Over
                      </button>
                    </div>
                  </div>

                  {/* Main Action */}
                  <button
                    onClick={handleApprovePlan}
                    disabled={isApproving || !projectOverview || !weeklyBreakdown}
                    className="w-full px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-[16px] shadow-[0_8px_32px_rgba(147,51,234,0.3),inset_0_2px_4px_rgba(255,255,255,0.3)] hover:shadow-[0_12px_40px_rgba(147,51,234,0.4)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-lg"
                  >
                    {isApproving ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Approving Plan...</span>
                      </div>
                    ) : (
                      'Perfect! Start Week 1! 🚀'
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Active Phase */}
        {phase === 'active' && (
          <div className="max-w-6xl mx-auto">
            <div className="bg-white/90 backdrop-blur-md border border-white/30 rounded-[24px] shadow-[inset_0_4px_12px_rgba(255,255,255,0.7),0_16px_48px_rgba(147,51,234,0.3)] p-8">
              
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
                  Welcome to Your Project! 🚀
                </h2>
                <p className="text-gray-600 text-lg">
                  This is where you'll chat with Ruby and write code for Week {project.current_week}.
                </p>
              </div>

              {/* TODO: Add the main project interface here */}
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-100/50 rounded-[16px] p-8 text-center">
                <div className="text-4xl mb-4">🚧</div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Coming Soon!</h3>
                <p className="text-gray-600">
                  The main project interface with Ruby chat and code editor will be implemented here.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Completed Phase */}
        {phase === 'completed' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white/90 backdrop-blur-md border border-white/30 rounded-[24px] shadow-[inset_0_4px_12px_rgba(255,255,255,0.7),0_16px_48px_rgba(147,51,234,0.3)] p-8 text-center">
              
              <div className="text-6xl mb-6">🎉</div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
                Project Completed!
              </h2>
              <p className="text-gray-600 text-lg mb-8">
                Congratulations on completing your {project.title} project!
              </p>

              <button
                onClick={handleBackToDashboard}
                className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-[16px] shadow-[0_8px_32px_rgba(147,51,234,0.3),inset_0_2px_4px_rgba(255,255,255,0.3)] hover:shadow-[0_12px_40px_rgba(147,51,234,0.4)] transition-all duration-300 font-medium"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}