'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '../../../hooks/useAuth'
import { useProjects } from '../../../hooks/useProjects'
import ProjectDetailView from '../../../components/Project/ProjectDetailView'
import type { Project } from '../../../hooks/useProjects'

export default function ProjectPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { projects, loading: projectsLoading, updateProject } = useProjects()
  
  const [project, setProject] = useState<Project | null>(null)
  const [notFound, setNotFound] = useState(false)

  const projectId = params.id as string

  useEffect(() => {
    if (authLoading || projectsLoading) return

    if (!user) {
      router.push('/')
      return
    }

    if (projects.length === 0) return

    const foundProject = projects.find(p => p.id === projectId)
    if (foundProject) {
      setProject(foundProject)
    } else {
      setNotFound(true)
    }
  }, [user, projects, projectId, authLoading, projectsLoading, router])

  const handleProjectUpdated = async (updates: Partial<Project>) => {
    if (!project) return

    try {
      await updateProject(project.id, updates)
      
      // Update local state
      setProject(prev => prev ? { ...prev, ...updates } : null)
    } catch (error) {
      console.error('Error updating project:', error)
      alert('Failed to update project. Please try again.')
    }
  }

  if (authLoading || projectsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 flex items-center justify-center">
        <div className="bg-white/90 backdrop-blur-md border border-white/30 rounded-[24px] shadow-[inset_0_4px_12px_rgba(255,255,255,0.7),0_16px_48px_rgba(147,51,234,0.3)] p-8">
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-gray-700">Loading project...</span>
          </div>
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 flex items-center justify-center">
        <div className="bg-white/90 backdrop-blur-md border border-white/30 rounded-[24px] shadow-[inset_0_4px_12px_rgba(255,255,255,0.7),0_16px_48px_rgba(147,51,234,0.3)] p-8 text-center">
          <div className="text-4xl mb-4">😅</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Project Not Found</h2>
          <p className="text-gray-600 mb-6">The project you're looking for doesn't exist or you don't have access to it.</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-[16px] shadow-[0_8px_32px_rgba(147,51,234,0.3),inset_0_2px_4px_rgba(255,255,255,0.3)] hover:shadow-[0_12px_40px_rgba(147,51,234,0.4)] transition-all duration-300 font-medium"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  if (!project) {
    return null
  }

  return (
    <ProjectDetailView 
      project={project} 
      onProjectUpdated={handleProjectUpdated}
    />
  )
}