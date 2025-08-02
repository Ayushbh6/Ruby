'use client'

import { useState, useRef } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useProjects } from '../../hooks/useProjects'
import MetricsSection from './MetricsSection'
import ProjectCard from './ProjectCard'
import RubyProjectScopingChat, { type RubyProjectScopingChatRef } from './RubyProjectScopingChat'
import ProjectConfirmationModal from './ProjectConfirmationModal'

export default function MainDashboard() {
  const { user, signOut } = useAuth()
  const { projects, loading: projectsLoading, createProject } = useProjects()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showConfirmationModal, setShowConfirmationModal] = useState(false)
  const [pendingProject, setPendingProject] = useState<{ name: string; description: string } | null>(null)
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  
  // Ref for Ruby chat component
  const rubyChatRef = useRef<RubyProjectScopingChatRef>(null)

  // Get time-based greeting
  const getTimeBasedGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  // Get user's first name or fallback
  const getUserName = () => {
    return user?.user_metadata?.first_name || 'Young Coder'
  }

  // Get personalized subtitle based on progress
  const getPersonalizedSubtitle = () => {
    const completedProjects = projects.filter(p => p.status === 'completed').length
    const activeProjects = projects.filter(p => p.status === 'active').length
    
    if (completedProjects > 0) {
      return `🌟 You've completed ${completedProjects} project${completedProjects > 1 ? 's' : ''}! Keep up the amazing work!`
    } else if (activeProjects > 0) {
      return `🚀 You have ${activeProjects} active project${activeProjects > 1 ? 's' : ''}. Let's continue building!`
    } else {
      return "Ready to start your first coding adventure?"
    }
  }

  const handleSignOut = async () => {
    await signOut()
  }

  const handleProjectGoalSet = (projectName: string, projectDescription: string) => {
    setPendingProject({ name: projectName, description: projectDescription })
    setShowCreateModal(false)
    setShowConfirmationModal(true)
  }

  const handleConfirmProject = async (name: string, description: string) => {
    setIsCreatingProject(true)
    try {
      await createProject({
        title: name,
        description: description,
        project_type: 'experiment', // Default type, Ruby should provide better categorization later
        initial_request: name, // Could be improved to store the actual initial request
        scoped_goal: description,
        duration_weeks: 3, // Default 3 weeks
        learning_goal: description,
        difficulty_level: 'beginner' // Default level
      })
      
      setShowConfirmationModal(false)
      setPendingProject(null)
    } catch (error) {
      console.error('Error creating project:', error)
      alert('Failed to create project. Please try again.')
    } finally {
      setIsCreatingProject(false)
    }
  }

  const handleCancelProject = async () => {
    setShowConfirmationModal(false)
    setPendingProject(null)
    setShowCreateModal(true) // Reopen chat for new conversation
    
    // Start a new conversation to ensure fresh conversation ID
    try {
      await rubyChatRef.current?.restartConversation()
    } catch (err) {
      console.error('Failed to restart conversation:', err)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-32 h-32 bg-gradient-to-r from-purple-200 to-pink-200 rounded-full opacity-20 blur-xl"></div>
        <div className="absolute top-40 right-32 w-24 h-24 bg-gradient-to-r from-blue-200 to-cyan-200 rounded-full opacity-20 blur-xl"></div>
        <div className="absolute bottom-32 left-32 w-40 h-40 bg-gradient-to-r from-green-200 to-teal-200 rounded-full opacity-20 blur-xl"></div>
        <div className="absolute bottom-20 right-20 w-28 h-28 bg-gradient-to-r from-yellow-200 to-orange-200 rounded-full opacity-20 blur-xl"></div>
      </div>

      {/* Main content */}
      <div className="relative z-10 p-6 max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-4">
            {/* Ruby Logo */}
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),0_4px_16px_rgba(147,51,234,0.3)]">
              <span className="text-xl font-bold text-white">R</span>
            </div>
            
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                {getTimeBasedGreeting()}, {getUserName()}! 👋
              </h1>
              <p className="text-gray-600 text-sm">{getPersonalizedSubtitle()}</p>
            </div>
          </div>

          {/* Sign Out Button */}
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-white/60 backdrop-blur-sm border border-white/30 rounded-[12px] text-gray-700 hover:text-purple-600 transition-all duration-300 shadow-[inset_0_2px_4px_rgba(255,255,255,0.6),0_4px_16px_rgba(0,0,0,0.1)]"
          >
            Sign Out
          </button>
        </header>

        {/* Metrics Section */}
        <MetricsSection projects={projects} loading={projectsLoading} />

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <button 
            onClick={() => setShowCreateModal(true)}
            className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-6 rounded-[20px] shadow-[0_8px_32px_rgba(147,51,234,0.3),inset_0_2px_4px_rgba(255,255,255,0.3)] hover:shadow-[0_12px_40px_rgba(147,51,234,0.4),inset_0_2px_4px_rgba(255,255,255,0.3)] transition-all duration-300 group"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <span className="text-2xl">🚀</span>
              </div>
              <div className="text-left">
                <h3 className="text-xl font-bold">Start New Project</h3>
                <p className="text-purple-100 text-sm">Create something amazing with Ruby!</p>
              </div>
            </div>
          </button>

          <button className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white p-6 rounded-[20px] shadow-[0_8px_32px_rgba(59,130,246,0.3),inset_0_2px_4px_rgba(255,255,255,0.3)] hover:shadow-[0_12px_40px_rgba(59,130,246,0.4),inset_0_2px_4px_rgba(255,255,255,0.3)] transition-all duration-300 group">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <span className="text-2xl">📖</span>
              </div>
              <div className="text-left">
                <h3 className="text-xl font-bold">Continue Learning</h3>
                <p className="text-blue-100 text-sm">Pick up where you left off!</p>
              </div>
            </div>
          </button>
        </div>

        {/* Projects Section */}
        <div className="bg-white/40 backdrop-blur-sm rounded-[24px] p-8 shadow-[inset_0_2px_8px_rgba(255,255,255,0.6),0_8px_32px_rgba(0,0,0,0.1)] border border-white/20">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Your Projects</h2>
          
          {projectsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🎯</span>
              </div>
              <h3 className="text-xl font-bold text-gray-700 mb-2">No projects yet!</h3>
              <p className="text-gray-600 mb-6">Ready to start your first coding adventure?</p>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-[16px] shadow-[0_4px_16px_rgba(147,51,234,0.3)] hover:shadow-[0_6px_20px_rgba(147,51,234,0.4)] transition-all duration-300"
              >
                Create Your First Project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ruby Project Scoping Chat */}
      <RubyProjectScopingChat 
        ref={rubyChatRef}
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)}
        onProjectGoalSet={handleProjectGoalSet}
      />

      {/* Project Confirmation Modal */}
      <ProjectConfirmationModal
        isOpen={showConfirmationModal}
        projectName={pendingProject?.name || ''}
        projectDescription={pendingProject?.description || ''}
        onConfirm={handleConfirmProject}
        onCancel={handleCancelProject}
        isCreating={isCreatingProject}
      />
    </div>
  )
}
