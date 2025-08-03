'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { useAuth } from '../../hooks/useAuth'
import { useWeeklyPlans } from '../../hooks/useWeeklyPlans'
import { useConversations } from '../../hooks/useConversations'
import { useCodeArtifacts } from '../../hooks/useCodeArtifacts'
import { supabase } from '../../lib/supabase'
import { 
  type RubyProjectOverview,
  type RubyWeeklyBreakdown,
  calculateProjectMetadata
} from '../../lib/schemas'
import type { Project } from '../../hooks/useProjects'

interface ProjectDetailViewProps {
  project: Project
  onProjectUpdated: (updates: Partial<Project>) => void
}

type ProjectPhase = 'planning' | 'active' | 'completed' | 'paused' | 'archived'
type PlanningStep = 'overview' | 'overview-review' | 'breakdown' | 'complete'

export default function ProjectDetailView({
  project,
  onProjectUpdated
}: ProjectDetailViewProps) {
  const router = useRouter()
  const { getAuthToken } = useAuth()
  
  // Weekly plans hook
  const { weeklyPlans, loading: weeklyPlansLoading, fetchWeeklyPlans, createWeeklyPlansFromMasterPlan } = useWeeklyPlans(project.id)
  const currentWeekPlan = weeklyPlans.find(plan => plan.week_number === project.current_week)
  
  // Conversations hook - pass current week's plan ID if available
  const {
    conversations,
    activeConversation,
    messages,
    loading: conversationsLoading,
    sendingMessage,
    createConversation,
    sendMessage,
    setActiveConversation,
    clearActiveConversation
  } = useConversations(project.id, currentWeekPlan?.id)
  
  // Code artifacts hook
  const {
    artifacts,
    currentArtifact,
    loading: artifactsLoading,
    createArtifact,
    updateExecutionStatus,
    selectArtifact
  } = useCodeArtifacts(project.id)
  
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
  
  // Sidebar collapse state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  
  // Chat input state
  const [messageInput, setMessageInput] = useState('')
  
  // Conversation management state
  const [showConversationMenu, setShowConversationMenu] = useState<string | null>(null)
  const [renamingConversation, setRenamingConversation] = useState<string | null>(null)
  const [renameInput, setRenameInput] = useState('')
  
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
        // Calculate project metadata for the database columns
        const metadata = calculateProjectMetadata(breakdown.weekly_breakdown, updatedOverview.recommended_duration)
        
        // Prepare milestones array from key_milestones if available  
        const milestonesReached = breakdown.key_milestones?.map((milestone: { title: string; description: string; target_week: number }) => ({
          title: milestone.title,
          description: milestone.description,
          target_week: milestone.target_week,
          completed: false
        })) || []
        
        // Combine overview and breakdown into complete master plan
        const completeMasterPlan = {
          ...currentProject.master_plan,
          breakdown: breakdown,
          breakdown_generated_at: new Date().toISOString(),
          complete: true
        }

        // Update the projects table with complete master plan AND populated metadata columns
        const { error: updateError } = await supabase
          .from('projects')
          .update({
            master_plan: completeMasterPlan,
            duration_weeks: updatedOverview.recommended_duration,
            status: 'planning',
            updated_at: new Date().toISOString(),
            // Populate the empty database columns with calculated data
            target_concepts: updatedOverview.target_concepts || [],
            total_sessions: metadata.total_sessions,
            milestones_reached: milestonesReached
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

  // Handle sending messages
  const handleSendMessage = useCallback(async () => {
    if (!messageInput.trim() || !activeConversation || sendingMessage) {
      return;
    }

    const messageText = messageInput.trim();
    setMessageInput(''); // Clear input immediately for better UX

    try {
      // Send user message
      await sendMessage(activeConversation.id, messageText, 'user');
      
      // TODO: Add AI response logic here
      // For now, we'll just send the user message
      // Later we can integrate with the AI service to generate Ruby's response
      
    } catch (error) {
      console.error('Error sending message:', error);
      // Restore the message input on error
      setMessageInput(messageText);
    }
  }, [messageInput, activeConversation, sendingMessage, sendMessage]);

  // Handle Enter key press in message input
  const handleMessageKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Handle conversation rename
  const handleRenameConversation = useCallback(async (conversationId: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ title: newTitle.trim() })
        .eq('id', conversationId);
      
      if (error) throw error;
      
      // Refresh conversations to show updated title
      // The useConversations hook should automatically update
      setRenamingConversation(null);
      setRenameInput('');
      setShowConversationMenu(null);
    } catch (error) {
      console.error('Error renaming conversation:', error);
      alert('Failed to rename conversation. Please try again.');
    }
  }, []);

  // Handle conversation deletion
  const handleDeleteConversation = useCallback(async (conversationId: string) => {
    if (!confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
      return;
    }
    
    try {
      // Delete all messages first (due to foreign key constraint)
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId);
      
      if (messagesError) throw messagesError;
      
      // Then delete the conversation
      const { error: conversationError } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);
      
      if (conversationError) throw conversationError;
      
      // If we deleted the active conversation, clear it
      if (activeConversation?.id === conversationId) {
        clearActiveConversation();
      }
      
      setShowConversationMenu(null);
    } catch (error) {
      console.error('Error deleting conversation:', error);
      alert('Failed to delete conversation. Please try again.');
    }
  }, [activeConversation, clearActiveConversation]);

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

  // Close conversation menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.conversation-menu')) {
        setShowConversationMenu(null);
      }
    };

    if (showConversationMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showConversationMenu]);

  const handleApprovePlan = async () => {
    if (!projectOverview || !weeklyBreakdown || !weeklyBreakdown.weekly_breakdown || weeklyBreakdown.weekly_breakdown.length === 0) {
      alert('Plan is not fully generated yet. Please wait for Ruby to finish.')
      return
    }
    
    setIsApproving(true)
    try {
      // Calculate project metadata using backend calculations
      const metadata = calculateProjectMetadata(weeklyBreakdown.weekly_breakdown, editableDuration)
      
      // Prepare milestones array from key_milestones if available
      const milestonesReached = weeklyBreakdown.key_milestones?.map((milestone: { title: string; description: string; target_week: number }) => ({
        title: milestone.title,
        description: milestone.description,
        target_week: milestone.target_week,
        completed: false
      })) || []
      
      // Create weekly plans from the master plan
      if (weeklyBreakdown && projectOverview) {
        console.log('🗓️ Creating weekly plans from master plan...')
        
        // Construct the master plan object needed by the hook
        const masterPlanForWeeklyPlans = {
          response: weeklyBreakdown.response,
          project_analysis: projectOverview.project_analysis,
          project_type: projectOverview.project_type,
          recommended_duration: editableDuration,
          difficulty_assessment: projectOverview.difficulty_assessment,
          learning_trajectory: projectOverview.learning_trajectory,
          weekly_breakdown: weeklyBreakdown.weekly_breakdown,
          success_criteria: weeklyBreakdown.success_criteria
        }
        
        const { error: weeklyPlansError } = await createWeeklyPlansFromMasterPlan(project.id, masterPlanForWeeklyPlans)
        
        if (weeklyPlansError) {
          console.error('Error creating weekly plans:', weeklyPlansError)
          alert('Failed to create weekly plans. Please try again.')
          return
        }
      }
      
      // Simply mark the plan as approved and move to active phase with calculated metadata
      await onProjectUpdated({
        plan_approved: true,
        plan_approved_at: new Date().toISOString(),
        status: 'active',
        current_week: 1,
        // Populate the empty database columns with calculated data
        target_concepts: projectOverview.target_concepts || [],
        total_sessions: metadata.total_sessions,
        milestones_reached: milestonesReached
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

  const getPhaseSubtitle = (currentPhase: ProjectPhase) => {
    if (currentPhase === 'planning') return 'Planning Phase'
    if (currentPhase === 'active') return `Week ${project.current_week}/${project.duration_weeks}`
    if (currentPhase === 'completed') return 'Completed'
    if (currentPhase === 'paused') return 'Paused'
    return 'Archived'
  }

  const getPhaseStyles = (currentPhase: ProjectPhase) => {
    if (currentPhase === 'planning') return 'bg-yellow-100 text-yellow-800'
    if (currentPhase === 'active') return 'bg-green-100 text-green-800'
    if (currentPhase === 'completed') return 'bg-blue-100 text-blue-800'
    if (currentPhase === 'paused') return 'bg-orange-100 text-orange-800'
    return 'bg-gray-100 text-gray-800'
  }

  const getPhaseLabel = (currentPhase: ProjectPhase) => {
    if (currentPhase === 'planning') return '📋 Planning'
    if (currentPhase === 'active') return '🚀 Active'
    if (currentPhase === 'completed') return '✅ Completed'
    if (currentPhase === 'paused') return '⏸️ Paused'
    return '📦 Archived'
  }

  return (
    <div className={phase === 'active' ? '' : 'min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100'}>
      {/* Header - Only for planning/completed/paused/archived phases */}
      {phase !== 'active' && (
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
                    {getPhaseSubtitle(phase)}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPhaseStyles(phase)}`}>
                  {getPhaseLabel(phase)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={phase === 'active' ? '' : 'container mx-auto px-6 py-8'}>
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
          <div className="h-screen flex flex-col bg-gradient-to-br from-violet-100 via-rose-100 to-sky-100">
            {/* Top Header Bar */}
            <div className="h-16 bg-gradient-to-r from-white/90 via-violet-50/80 to-rose-50/80 
                          shadow-[inset_0_2px_8px_rgba(255,255,255,0.8),0_4px_16px_rgba(139,69,190,0.15)] 
                          border-b border-violet-200/30 flex items-center justify-between px-8 rounded-b-2xl">
              <div className="flex items-center space-x-6">
                <button
                  onClick={handleBackToDashboard}
                  className="w-10 h-10 bg-gradient-to-br from-violet-200/80 via-white to-violet-100/80 
                           text-violet-600 hover:text-violet-700 transition-all duration-300 
                           rounded-2xl flex items-center justify-center
                           shadow-[inset_0_2px_6px_rgba(255,255,255,0.9),0_4px_12px_rgba(139,69,190,0.2)]
                           hover:shadow-[inset_0_1px_3px_rgba(255,255,255,0.95),0_6px_16px_rgba(139,69,190,0.25)]
                           hover:scale-105 font-bold text-lg"
                >
                  ←
                </button>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-700 via-rose-600 to-sky-600 bg-clip-text text-transparent drop-shadow-sm">{project.title}</h1>
                <span className="px-4 py-2 bg-gradient-to-br from-violet-100/90 via-white to-violet-50/90
                               text-violet-600 text-sm font-medium rounded-2xl
                               shadow-[inset_0_2px_6px_rgba(255,255,255,0.8),0_4px_12px_rgba(139,69,190,0.15)]">
                  Week {project.current_week}/{project.duration_weeks}
                </span>
              </div>
              <div className="flex items-center space-x-4">
                <span className="px-5 py-2.5 bg-gradient-to-br from-emerald-200/90 via-white to-emerald-100/90 
                               text-emerald-700 text-sm font-semibold rounded-2xl
                               shadow-[inset_0_2px_6px_rgba(255,255,255,0.8),0_4px_12px_rgba(16,185,129,0.2)]
                               flex items-center space-x-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-lg"></span>
                  <span>Active</span>
                </span>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden p-4 space-x-4">
              {/* Left Sidebar */}
              <div className={`${sidebarCollapsed ? 'w-20' : 'w-80'} flex-shrink-0 bg-gradient-to-b from-violet-300/40 via-rose-300/30 to-sky-300/40 
                              backdrop-blur-md flex flex-col transition-all duration-300 rounded-3xl
                              shadow-[inset_0_4px_12px_rgba(255,255,255,0.6),0_8px_24px_rgba(139,69,190,0.25)]`}>
                {/* Week Section */}
                <div className="p-6 border-b border-white/20">
                  <div className="flex items-center justify-between mb-4">
                    {!sidebarCollapsed && (
                      <div className="bg-gradient-to-r from-violet-400/90 via-rose-400/90 to-violet-500/90 
                                    text-white text-sm font-bold px-5 py-3 rounded-2xl
                                    shadow-[inset_0_2px_6px_rgba(255,255,255,0.3),0_6px_16px_rgba(139,69,190,0.4)]">
                        {currentWeekPlan ? currentWeekPlan.week_title : `Week ${project.current_week}: Loading...`}
                      </div>
                    )}
                    <button 
                      onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                      className="w-12 h-12 bg-gradient-to-br from-white/60 via-violet-100/50 to-white/40 
                               hover:from-white/70 hover:via-violet-100/60 hover:to-white/50
                               rounded-2xl flex items-center justify-center text-violet-700 hover:text-violet-800 
                               transition-all duration-300 font-bold text-lg
                               shadow-[inset_0_3px_8px_rgba(255,255,255,0.8),0_4px_12px_rgba(139,69,190,0.2)]
                               hover:shadow-[inset_0_2px_6px_rgba(255,255,255,0.9),0_6px_16px_rgba(139,69,190,0.3)]
                               hover:scale-105"
                    >
                      {sidebarCollapsed ? '→' : '←'}
                    </button>
                  </div>
                  {!sidebarCollapsed && (
                    <>
                      <div className="text-sm text-violet-700 mb-4 leading-relaxed font-medium">
                        {currentWeekPlan?.week_description || 'Loading week description...'}
                      </div>
                      <div className="bg-gradient-to-r from-white/60 via-violet-50/80 to-white/50 rounded-2xl p-3
                                    shadow-[inset_0_3px_8px_rgba(255,255,255,0.7),0_4px_12px_rgba(139,69,190,0.15)]">
                        <div className="flex items-center space-x-3">
                          <div className="flex-1 bg-gradient-to-r from-violet-200/60 via-white/40 to-violet-100/60 
                                        rounded-2xl h-3 overflow-hidden
                                        shadow-[inset_0_2px_6px_rgba(139,69,190,0.2)]">
                            <div className="bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-400 h-3 rounded-2xl 
                                          shadow-[0_2px_8px_rgba(16,185,129,0.4)]
                                          transition-all duration-500" style={{width: `${currentWeekPlan?.progress_percentage || 0}%`}}></div>
                          </div>
                          <span className="text-sm text-violet-700 font-semibold px-2">{currentWeekPlan?.progress_percentage || 0}%</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Conversations */}
                <div className="flex-1 p-6 space-y-3 overflow-y-auto">
                  {!sidebarCollapsed && <div className="text-xs text-violet-600 mb-4 uppercase tracking-wider font-bold">Conversations</div>}
                  
                  {/* Show loading state */}
                  {conversationsLoading && !sidebarCollapsed && (
                    <div className="p-4 text-center text-violet-600">
                      Loading conversations...
                    </div>
                  )}
                  
                  {/* Show existing conversations */}
                  {!conversationsLoading && !sidebarCollapsed && conversations.map(conversation => (
                    <div key={conversation.id} 
                         data-conversation-id={conversation.id}
                         className={`relative flex items-center space-x-4 p-4 rounded-2xl text-sm transition-all duration-300
                                    shadow-[inset_0_2px_6px_rgba(255,255,255,0.7),0_4px_12px_rgba(139,69,190,0.1)]
                                    hover:shadow-[inset_0_1px_4px_rgba(255,255,255,0.8),0_6px_16px_rgba(139,69,190,0.15)]
                                    hover:scale-[1.02] border border-white/30 ${
                                      activeConversation?.id === conversation.id 
                                        ? 'bg-gradient-to-br from-violet-100/80 via-violet-50/60 to-violet-100/70'
                                        : 'bg-gradient-to-br from-white/50 via-violet-50/40 to-white/40 backdrop-blur-sm'
                                    } ${showConversationMenu === conversation.id ? 'z-[100000]' : 'z-10'}`}>
                      <div className={`w-3 h-3 rounded-full shadow-[0_2px_8px_rgba(16,185,129,0.6)] ${
                        conversation.status === 'active' ? 'bg-emerald-500 animate-pulse' :
                        conversation.status === 'completed' ? 'bg-green-500' :
                        conversation.status === 'interrupted' ? 'bg-yellow-500' :
                        'bg-gray-400'
                      }`}></div>
                      
                      {/* Conversation title - clickable or editable */}
                      {renamingConversation === conversation.id ? (
                        <input
                          type="text"
                          value={renameInput}
                          onChange={(e) => setRenameInput(e.target.value)}
                          onBlur={() => {
                            if (renameInput.trim()) {
                              handleRenameConversation(conversation.id, renameInput);
                            } else {
                              setRenamingConversation(null);
                              setRenameInput('');
                            }
                          }}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (renameInput.trim()) {
                                handleRenameConversation(conversation.id, renameInput);
                              }
                            } else if (e.key === 'Escape') {
                              setRenamingConversation(null);
                              setRenameInput('');
                            }
                          }}
                          autoFocus
                          className="flex-1 bg-white/90 border border-violet-300 rounded-lg px-2 py-1 text-violet-600 font-medium focus:outline-none focus:ring-2 focus:ring-violet-400"
                        />
                      ) : (
                        <span 
                          className="flex-1 text-violet-600 font-medium cursor-pointer"
                          onClick={() => setActiveConversation(conversation)}
                        >
                          {conversation.title || `${conversation.conversation_type} Session`}
                        </span>
                      )}
                      
                      <div className="flex items-center">
                        {/* 3-dot menu button */}
                        <div className="conversation-menu relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowConversationMenu(showConversationMenu === conversation.id ? null : conversation.id);
                            }}
                            className="w-8 h-8 rounded-xl bg-gradient-to-br from-white/80 via-violet-50/60 to-white/70 
                                     hover:from-white/90 hover:via-violet-50/70 hover:to-white/80
                                     flex items-center justify-center text-violet-600 hover:text-violet-700 
                                     transition-all duration-300
                                     shadow-[inset_0_2px_6px_rgba(255,255,255,0.8),0_3px_8px_rgba(139,69,190,0.15)]
                                     hover:shadow-[inset_0_1px_4px_rgba(255,255,255,0.9),0_4px_10px_rgba(139,69,190,0.2)]"
                          >
                            <span className="text-lg font-bold leading-none">⋯</span>
                          </button>
                          
                          {/* Dropdown menu */}
                          {showConversationMenu === conversation.id && (
                            <div className="absolute right-0 top-10 bg-white rounded-xl shadow-2xl border border-violet-200/50 py-2 min-w-[150px] z-[99999]">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRenameInput(conversation.title || `${conversation.conversation_type} Session`);
                                  setRenamingConversation(conversation.id);
                                  setShowConversationMenu(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-violet-700 hover:bg-violet-50 transition-colors duration-200 flex items-center space-x-2"
                              >
                                <span>✏️</span>
                                <span>Rename</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteConversation(conversation.id);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-200 flex items-center space-x-2"
                              >
                                <span>🗑️</span>
                                <span>Delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Show "Start New Conversation" button if no conversations or we want to create a new one */}
                  {!conversationsLoading && !sidebarCollapsed && currentWeekPlan && (
                    <div className="flex items-center space-x-4 p-4 bg-gradient-to-br from-white/50 via-violet-50/40 to-white/40 
                                  backdrop-blur-sm rounded-2xl text-sm cursor-pointer transition-all duration-300
                                  shadow-[inset_0_2px_6px_rgba(255,255,255,0.7),0_4px_12px_rgba(139,69,190,0.1)]
                                  hover:shadow-[inset_0_1px_4px_rgba(255,255,255,0.8),0_6px_16px_rgba(139,69,190,0.15)]
                                  hover:scale-[1.02] border border-white/30"
                         onClick={async () => {
                           if (currentWeekPlan) {
                             const newConv = await createConversation(currentWeekPlan.id, 'New Learning Session', 'learning');
                             if (newConv) {
                               setActiveConversation(newConv);
                             }
                           }
                         }}>
                      <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse 
                                    shadow-[0_2px_8px_rgba(16,185,129,0.6)]"></div>
                      <span className="flex-1 text-violet-600 font-medium">Start New Learning Session</span>
                      <div className="flex space-x-2">
                        <button className="w-8 h-8 rounded-xl bg-gradient-to-br from-white/80 via-violet-50/60 to-white/70 
                                         hover:from-white/90 hover:via-violet-50/70 hover:to-white/80
                                         flex items-center justify-center text-violet-600 hover:text-violet-700 
                                         transition-all duration-300
                                         shadow-[inset_0_2px_6px_rgba(255,255,255,0.8),0_3px_8px_rgba(139,69,190,0.15)]
                                         hover:shadow-[inset_0_1px_4px_rgba(255,255,255,0.9),0_4px_10px_rgba(139,69,190,0.2)]
                                         hover:scale-110">
                          <span className="text-sm font-bold">+</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Show message if no current week plan */}
                  {!conversationsLoading && !sidebarCollapsed && !currentWeekPlan && (
                    <div className="p-4 text-center text-violet-600/60 text-sm">
                      Complete project planning to start conversations
                    </div>
                  )}

                </div>

                {/* Locked/Other Weeks */}
                {!sidebarCollapsed && weeklyPlans.length > 0 && (
                  <div className="p-6 border-t border-white/20 space-y-3">
                    {weeklyPlans
                      .filter(plan => plan.week_number !== project.current_week)
                      .slice(0, 3) // Show max 3 other weeks
                      .map(plan => (
                        <div key={plan.id} 
                             className="flex items-center space-x-4 p-4 bg-gradient-to-br from-white/30 via-gray-50/40 to-white/25 
                                      rounded-2xl text-sm opacity-60
                                      shadow-[inset_0_2px_6px_rgba(255,255,255,0.6),0_3px_8px_rgba(139,69,190,0.1)]">
                          <span className="text-xl">{plan.status === 'locked' ? '🔒' : plan.status === 'completed' ? '✅' : '⏳'}</span>
                          <span className="text-violet-600 font-medium">{plan.week_title}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Center Chat Area */}
              <div className="flex-1 flex flex-col bg-gradient-to-br from-white/80 via-violet-50/30 to-rose-50/30 
                            backdrop-blur-md rounded-3xl mx-2
                            shadow-[inset_0_4px_12px_rgba(255,255,255,0.7),0_8px_24px_rgba(139,69,190,0.2)]">
                {/* Chat Header */}
                <div className="h-20 bg-gradient-to-r from-white/70 via-violet-100/50 to-rose-100/50 
                              border-b border-violet-200/30 flex items-center px-8 rounded-t-3xl
                              shadow-[inset_0_3px_8px_rgba(255,255,255,0.8),0_2px_6px_rgba(139,69,190,0.1)]">
                  <div>
                    <h3 className="text-xl font-bold text-violet-800">Getting Started with Ruby</h3>
                    <span className="text-sm text-violet-600 font-medium">Let's build your first tic-tac-toe game together! 🎮</span>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                  {/* Show messages if there's an active conversation */}
                  {activeConversation && messages.length > 0 ? (
                    messages.map((message, index) => (
                      <div key={message.id} className="flex space-x-5">
                        {/* Avatar */}
                        <div className={`w-12 h-12 rounded-3xl flex items-center justify-center text-white text-sm font-bold 
                                       flex-shrink-0 shadow-[0_6px_16px_rgba(139,69,190,0.4)] ${
                          message.role === 'ruby' 
                            ? 'bg-gradient-to-br from-violet-400 via-rose-400 to-violet-500'
                            : 'bg-gradient-to-br from-blue-400 via-indigo-400 to-blue-500'
                        }`}>
                          {message.role === 'ruby' ? 'R' : 'U'}
                        </div>
                        
                        {/* Message Content */}
                        <div className="flex-1 max-w-2xl">
                          <div className={`rounded-3xl p-6 border shadow-[inset_0_3px_8px_rgba(255,255,255,0.8),0_6px_20px_rgba(139,69,190,0.2)] ${
                            message.role === 'ruby'
                              ? 'bg-gradient-to-br from-white/90 via-violet-50/80 to-rose-50/70 border-violet-200/40'
                              : 'bg-gradient-to-br from-blue-50/90 via-white/80 to-blue-50/70 border-blue-200/40'
                          }`}>
                            <p className={`leading-relaxed font-medium ${
                              message.role === 'ruby' ? 'text-violet-800' : 'text-blue-800'
                            }`}>
                              {message.content}
                            </p>
                            
                            {/* Show code if present */}
                            {message.code && (
                              <div className="mt-4 p-4 bg-gray-900 rounded-2xl overflow-x-auto">
                                <pre className="text-green-400 text-sm">
                                  <code>{message.code}</code>
                                </pre>
                              </div>
                            )}
                            
                            {/* Show concept taught if present */}
                            {message.concept_taught && (
                              <div className="mt-3 px-3 py-1 bg-violet-100/60 rounded-full text-xs text-violet-600 font-medium inline-block">
                                💡 {message.concept_taught}
                              </div>
                            )}
                          </div>
                          
                          {/* Timestamp */}
                          <div className={`text-xs mt-3 ml-3 font-medium ${
                            message.role === 'ruby' ? 'text-violet-500' : 'text-blue-500'
                          }`}>
                            {message.role === 'ruby' ? 'Ruby' : 'You'} • {new Date(message.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : activeConversation ? (
                    /* Empty conversation state */
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center text-violet-400">
                        <div className="text-4xl mb-4">💬</div>
                        <p className="text-lg font-medium">Start your conversation with Ruby!</p>
                        <p className="text-sm mt-2">Ask questions about your project or get help with coding.</p>
                      </div>
                    </div>
                  ) : (
                    /* No conversation selected */
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center text-violet-400">
                        <div className="text-4xl mb-4">🚀</div>
                        <p className="text-lg font-medium">Select a conversation to get started</p>
                        <p className="text-sm mt-2">Choose a conversation from the sidebar or start a new one!</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Message Input */}
                <div className="p-8 bg-gradient-to-r from-white/60 via-violet-100/50 to-rose-100/50 
                              border-t border-violet-200/30 rounded-b-3xl
                              shadow-[inset_0_3px_8px_rgba(255,255,255,0.8),0_-2px_6px_rgba(139,69,190,0.1)]">
                  <div className="flex space-x-4">
                    <input 
                      type="text" 
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyPress={handleMessageKeyPress}
                      disabled={!activeConversation || sendingMessage}
                      placeholder={activeConversation ? "Ask Ruby anything about your code..." : "Select a conversation to start chatting"}
                      className="flex-1 px-6 py-4 bg-gradient-to-br from-white/90 via-white to-white/80 
                               backdrop-blur-sm border-2 border-violet-200/50 rounded-2xl 
                               focus:outline-none focus:ring-4 focus:ring-violet-300/30 focus:border-violet-400 
                               transition-all duration-300 font-medium text-violet-800
                               shadow-[inset_0_3px_8px_rgba(255,255,255,0.8),0_4px_12px_rgba(139,69,190,0.15)]
                               placeholder-violet-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <button 
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim() || !activeConversation || sendingMessage}
                      className="px-8 py-4 bg-gradient-to-br from-violet-500 via-rose-500 to-violet-600 
                               text-white rounded-2xl hover:from-violet-600 hover:via-rose-600 hover:to-violet-700
                               transition-all duration-300 font-bold text-sm
                               shadow-[inset_0_2px_6px_rgba(255,255,255,0.2),0_6px_20px_rgba(139,69,190,0.4)]
                               hover:shadow-[inset_0_1px_4px_rgba(255,255,255,0.3),0_8px_24px_rgba(139,69,190,0.5)]
                               hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
                      {sendingMessage ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Preview Pane - Claude Artifacts Style */}
              <div className="flex-1 min-w-0 bg-white rounded-lg border border-gray-200 flex flex-col overflow-hidden">
                {/* Header with tabs */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center space-x-4">
                    <div className="flex space-x-1">
                      <button className="px-3 py-1.5 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">
                        Preview
                      </button>
                      <button className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md">
                        Code
                      </button>
                    </div>
                    
                    {/* Version Selector */}
                    {artifacts.length > 0 && (
                      <select
                        value={currentArtifact?.id || ''}
                        onChange={(e) => {
                          const artifact = artifacts.find(a => a.id === e.target.value);
                          if (artifact) selectArtifact(artifact);
                        }}
                        className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select version</option>
                        {artifacts.map((artifact) => (
                          <option key={artifact.id} value={artifact.id}>
                            v{artifact.version_number}{artifact.title ? `: ${artifact.title}` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {currentArtifact && (
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        currentArtifact.execution_status === 'success' ? 'bg-green-100 text-green-800' :
                        currentArtifact.execution_status === 'error' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {currentArtifact.execution_status}
                      </span>
                    )}
                    <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  {currentArtifact ? (
                    <>
                      {/* Live Preview Area */}
                      <div className="flex-1 bg-white border-b border-gray-200 flex items-center justify-center overflow-hidden">
                        <div className="w-full h-full max-w-4xl mx-auto">
                          {/* Game Board or App Preview */}
                          <div className="h-full flex items-center justify-center bg-gray-50">
                            <div className="text-center">
                              <div className="w-64 h-64 mx-auto mb-4 bg-white border-2 border-gray-300 rounded-lg shadow-sm grid grid-cols-3 gap-1 p-2">
                                {[1,2,3,4,5,6,7,8,9].map((num) => (
                                  <div key={num} className="bg-gray-100 border border-gray-200 rounded flex items-center justify-center text-2xl font-bold text-gray-400 hover:bg-gray-200 cursor-pointer transition-colors">
                                    {num % 3 === 0 ? (num % 6 === 0 ? 'O' : 'X') : ''}
                                  </div>
                                ))}
                              </div>
                              <p className="text-sm text-gray-500">Interactive Tic-Tac-Toe Game</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Code Console */}
                      <div className="h-48 bg-gray-900 text-white overflow-auto">
                        <div className="px-4 py-3 border-b border-gray-700">
                          <div className="flex items-center space-x-2">
                            <div className="flex space-x-1">
                              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            </div>
                            <span className="text-sm text-gray-400">Terminal</span>
                          </div>
                        </div>
                        <div className="p-4 font-mono text-sm">
                          <div className="text-green-400">$ Game started!</div>
                          <div className="text-blue-400">→ Grid rendered successfully ✓</div>
                          <div className="text-yellow-400">→ Ready for player input...</div>
                          {currentArtifact.execution_output && (
                            <div className="text-gray-300 mt-2">
                              <div className="text-gray-500">Output:</div>
                              <pre className="whitespace-pre-wrap">{currentArtifact.execution_output}</pre>
                            </div>
                          )}
                          {currentArtifact.error_message && (
                            <div className="text-red-400 mt-2">
                              <div className="text-red-500">Error:</div>
                              <pre className="whitespace-pre-wrap">{currentArtifact.error_message}</pre>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : artifacts.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center bg-gray-50">
                      <div className="text-center max-w-sm">
                        <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-lg flex items-center justify-center">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No code artifacts yet</h3>
                        <p className="text-sm text-gray-500">Your live preview will appear here once you start building your project with Ruby.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center bg-gray-50">
                      <div className="text-center max-w-sm">
                        <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-lg flex items-center justify-center">
                          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Select a version to preview</h3>
                        <p className="text-sm text-gray-500">Choose a code version from the dropdown above to see the live preview.</p>
                      </div>
                    </div>
                  )}
                </div>
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