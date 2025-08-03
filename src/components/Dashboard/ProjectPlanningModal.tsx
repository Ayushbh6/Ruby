'use client'

import { useState, useEffect } from 'react'
import { experimental_useObject as useObject } from '@ai-sdk/react'
import ReactMarkdown from 'react-markdown'
import { 
  rubyProjectOverviewSchema, 
  rubyWeeklyBreakdownSchema,
  type RubyProjectOverview,
  type RubyWeeklyBreakdown,
  type RubyMasterPlan 
} from '../../lib/schemas'

interface ProjectPlanningModalProps {
  isOpen: boolean
  projectName: string
  projectDescription: string
  onPlanApproved: (masterPlan: RubyMasterPlan) => void
  onCancel: () => void
}

type GenerationStep = 'overview' | 'breakdown' | 'complete'

export default function ProjectPlanningModal({
  isOpen,
  projectName,
  projectDescription,
  onPlanApproved,
  onCancel
}: ProjectPlanningModalProps) {
  const [step, setStep] = useState<GenerationStep>('overview')
  const [showFullPlan, setShowFullPlan] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [projectOverview, setProjectOverview] = useState<RubyProjectOverview | null>(null)
  const [weeklyBreakdown, setWeeklyBreakdown] = useState<RubyWeeklyBreakdown | null>(null)

  // Step 1: Project Overview Generation
  const overviewGeneration = useObject({
    api: '/api/generate-project-overview',
    schema: rubyProjectOverviewSchema,
  })

  // Step 2: Weekly Breakdown Generation
  const breakdownGeneration = useObject({
    api: '/api/generate-weekly-breakdown',
    schema: rubyWeeklyBreakdownSchema,
  })

  // Auto-start overview generation when modal opens
  useEffect(() => {
    if (isOpen && projectName && projectDescription && step === 'overview') {
      setProjectOverview(null)
      setWeeklyBreakdown(null)
      setShowFullPlan(false)
      
      overviewGeneration.submit({
        projectName,
        projectDescription,
        userAge: 8, // Default age, could be dynamic
        experienceLevel: 'beginner' // Default level, could be dynamic
      })
    }
  }, [isOpen, projectName, projectDescription, step])

  // Auto-start breakdown generation when overview completes
  useEffect(() => {
    if (overviewGeneration.object && overviewGeneration.object.project_type && step === 'overview') {
      setProjectOverview(overviewGeneration.object as RubyProjectOverview)
      setStep('breakdown')
      
      // Start weekly breakdown generation
      breakdownGeneration.submit({
        projectName,
        projectDescription,
        projectOverview: overviewGeneration.object,
        userAge: 8,
        experienceLevel: 'beginner'
      })
    }
  }, [overviewGeneration.object, step])

  // Mark as complete when breakdown finishes
  useEffect(() => {
    if (breakdownGeneration.object && breakdownGeneration.object.weekly_breakdown && step === 'breakdown') {
      setWeeklyBreakdown(breakdownGeneration.object as RubyWeeklyBreakdown)
      setStep('complete')
    }
  }, [breakdownGeneration.object, step])

  const handleApprovePlan = async () => {
    if (!projectOverview || !weeklyBreakdown || !weeklyBreakdown.weekly_breakdown || weeklyBreakdown.weekly_breakdown.length === 0) {
      alert('Plan is not fully generated yet. Please wait for Ruby to finish.')
      return
    }
    
    // Check that all weekly breakdown items have required fields
    const hasValidWeeks = weeklyBreakdown.weekly_breakdown.every(week => 
      week.title && week.main_goal && week.concepts && week.deliverables
    )
    
    if (!hasValidWeeks) {
      alert('Plan is still generating. Please wait for Ruby to complete all details.')
      return
    }
    
    setIsApproving(true)
    try {
      // Combine overview and breakdown into master plan
      const masterPlan: RubyMasterPlan = {
        response: weeklyBreakdown.response,
        project_analysis: projectOverview.project_analysis,
        project_type: projectOverview.project_type,
        recommended_duration: projectOverview.recommended_duration,
        difficulty_assessment: projectOverview.difficulty_assessment,
        learning_trajectory: projectOverview.learning_trajectory,
        weekly_breakdown: weeklyBreakdown.weekly_breakdown,
        success_criteria: weeklyBreakdown.success_criteria
      }
      
      await onPlanApproved(masterPlan)
    } catch (error) {
      console.error('Error approving plan:', error)
      alert('Failed to approve plan. Please try again.')
    } finally {
      setIsApproving(false)
    }
  }

  const getWeekEmoji = (weekNumber: number) => {
    const emojis = ['🌱', '🌿', '🌸', '🌟']
    return emojis[weekNumber - 1] || '✨'
  }

  const getCurrentError = () => {
    if (step === 'overview') return overviewGeneration.error
    if (step === 'breakdown') return breakdownGeneration.error
    return null
  }

  const getCurrentLoading = () => {
    if (step === 'overview') return overviewGeneration.isLoading
    if (step === 'breakdown') return breakdownGeneration.isLoading
    return false
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/90 backdrop-blur-md border border-white/30 rounded-[24px] shadow-[inset_0_4px_12px_rgba(255,255,255,0.7),0_16px_48px_rgba(147,51,234,0.3)] w-full max-w-4xl max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-purple-100/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),0_4px_16px_rgba(147,51,234,0.3)] flex items-center justify-center">
              <span className="text-lg font-bold text-white">R</span>
            </div>
            <div>
              <h3 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Creating Your Learning Plan
              </h3>
              <p className="text-gray-600 text-sm">{projectName}</p>
            </div>
          </div>
          
          <button
            onClick={onCancel}
            className="w-8 h-8 bg-white/60 backdrop-blur-sm border border-white/30 rounded-full shadow-[inset_0_2px_4px_rgba(255,255,255,0.6)] flex items-center justify-center text-gray-600 hover:text-purple-600 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          
          {/* Loading State */}
          {getCurrentLoading() && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full shadow-[inset_0_2px_4px_rgba(255,255,255,0.4)] flex items-center justify-center mb-4">
                <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>
              <h3 className="text-lg font-bold text-gray-700 mb-2">
                {step === 'overview' ? 'Ruby is analyzing your project...' : 'Ruby is creating your weekly plan...'}
              </h3>
              <p className="text-gray-600 text-center">
                {step === 'overview' 
                  ? 'Determining project type, difficulty, and duration!'
                  : 'Designing week-by-week learning activities!'
                }
              </p>
            </div>
          )}

          {/* Error State */}
          {getCurrentError() && (
            <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-100/50 rounded-[16px] shadow-[inset_0_2px_4px_rgba(255,255,255,0.6)] p-6 text-center">
              <div className="text-4xl mb-4">😅</div>
              <h3 className="text-lg font-bold text-red-700 mb-2">Oops! Something went wrong</h3>
              <p className="text-red-600 mb-4">Ruby had trouble creating your plan. Let's try again!</p>
              <button
                onClick={() => {
                  setStep('overview')
                  setProjectOverview(null)
                  setWeeklyBreakdown(null)
                }}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-[12px] shadow-[0_4px_16px_rgba(147,51,234,0.3)] hover:shadow-[0_6px_20px_rgba(147,51,234,0.4)] transition-all duration-300"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Project Overview Display */}
          {projectOverview && (
            <div className="space-y-6">
              
              {/* Ruby's Response */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100/50 rounded-[16px] shadow-[inset_0_2px_4px_rgba(255,255,255,0.6)] p-6">
                <div className="flex items-start space-x-3 mb-4">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full shadow-[inset_0_2px_4px_rgba(255,255,255,0.4)] flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-white">R</span>
                  </div>
                  <div className="text-gray-800 prose prose-sm max-w-none">
                    <ReactMarkdown>{projectOverview.response}</ReactMarkdown>
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
                    <p className="text-gray-600 capitalize">{projectOverview.project_type.replace('_', ' ')}</p>
                  </div>
                  
                  <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-100/50 rounded-[12px] p-4">
                    <div className="text-2xl mb-2">⏱️</div>
                    <h5 className="font-bold text-gray-800">Duration</h5>
                    <p className="text-gray-600">
                      {projectOverview.recommended_duration} week{projectOverview.recommended_duration > 1 ? 's' : ''}
                    </p>
                  </div>
                  
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100/50 rounded-[12px] p-4">
                    <div className="text-2xl mb-2">📊</div>
                    <h5 className="font-bold text-gray-800">Difficulty</h5>
                    <p className="text-gray-600 capitalize">{projectOverview.difficulty_assessment}</p>
                  </div>
                </div>

                {/* Learning Trajectory */}
                <div className="mb-6">
                  <h5 className="font-bold text-gray-800 mb-2">What You'll Learn</h5>
                  <p className="text-gray-600 leading-relaxed">{projectOverview.learning_trajectory}</p>
                </div>
              </div>
            </div>
          )}

          {/* Weekly Breakdown Display */}
          {weeklyBreakdown && (
            <div className="space-y-6 mt-6">
              
              {/* Week 1 Preview */}
              {weeklyBreakdown.weekly_breakdown.length > 0 && (
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-100/50 rounded-[20px] p-6 shadow-[inset_0_2px_4px_rgba(255,255,255,0.8),0_4px_16px_rgba(0,0,0,0.1)]">
                  <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                    <span className="mr-2">{getWeekEmoji(1)}</span>
                    Week 1: {weeklyBreakdown.weekly_breakdown[0].title}
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
              {!showFullPlan && weeklyBreakdown.weekly_breakdown.length > 1 && (
                <div className="text-center">
                  <button
                    onClick={() => setShowFullPlan(true)}
                    className="px-6 py-3 bg-white/60 backdrop-blur-sm border border-white/30 rounded-[16px] text-gray-700 hover:text-purple-600 hover:border-purple-300 transition-all duration-300 shadow-[inset_0_2px_4px_rgba(255,255,255,0.6)]"
                  >
                    Show Full {projectOverview?.recommended_duration || 'Multi'}-Week Plan
                  </button>
                </div>
              )}

              {/* Full Plan Display */}
              {showFullPlan && weeklyBreakdown.weekly_breakdown.length > 1 && (
                <div className="space-y-4">
                  <h4 className="text-lg font-bold text-gray-800 flex items-center">
                    <span className="mr-2">📚</span>
                    Complete Learning Plan
                  </h4>
                  
                  {weeklyBreakdown.weekly_breakdown.slice(1).map((week, index) => (
                    <div key={week.week || index + 2} className="bg-white/50 rounded-[16px] p-6 shadow-[inset_0_2px_4px_rgba(255,255,255,0.8),0_4px_16px_rgba(0,0,0,0.1)] border border-white/30">
                      <h5 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                        <span className="mr-2">{getWeekEmoji(week.week || index + 2)}</span>
                        Week {week.week || index + 2}: {week.title}
                      </h5>
                      
                      <div className="grid md:grid-cols-3 gap-4">
                        <div>
                          <h6 className="font-semibold text-gray-700 mb-2">Goal</h6>
                          <p className="text-sm text-gray-600">{week.main_goal}</p>
                        </div>
                        
                        <div>
                          <h6 className="font-semibold text-gray-700 mb-2">Concepts</h6>
                          <div className="space-y-1">
                            {week.concepts.map((concept, conceptIndex) => (
                              <div key={conceptIndex} className="text-sm text-gray-600">• {concept}</div>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <h6 className="font-semibold text-gray-700 mb-2">Deliverables</h6>
                          <div className="space-y-1">
                            {week.deliverables.map((deliverable, deliverableIndex) => (
                              <div key={deliverableIndex} className="text-sm text-gray-600">• {deliverable}</div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Success Criteria */}
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
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {step === 'complete' && (
          <div className="p-6 border-t border-purple-100/50">
            <div className="flex space-x-4">
              <button
                onClick={onCancel}
                className="flex-1 px-6 py-3 bg-white/60 backdrop-blur-sm border border-white/30 rounded-[16px] text-gray-700 hover:text-red-600 hover:border-red-300 transition-all duration-300 shadow-[inset_0_2px_4px_rgba(255,255,255,0.6)]"
              >
                Start Over
              </button>
              
              <button
                onClick={handleApprovePlan}
                disabled={isApproving || !projectOverview || !weeklyBreakdown}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-[16px] shadow-[0_8px_32px_rgba(147,51,234,0.3),inset_0_2px_4px_rgba(255,255,255,0.3)] hover:shadow-[0_12px_40px_rgba(147,51,234,0.4)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {isApproving ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Creating Project...</span>
                  </div>
                ) : (
                  'Start Week 1! 🚀'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}