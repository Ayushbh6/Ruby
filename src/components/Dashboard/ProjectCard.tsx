'use client'

import { Project } from '../../hooks/useProjects'

interface ProjectCardProps {
  project: Project
  onClick?: () => void
}

export default function ProjectCard({ project, onClick }: ProjectCardProps) {
  const getStatusColor = (status: Project['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700 border-green-200'
      case 'active':
        return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'paused':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'planning':
        return 'bg-purple-100 text-purple-700 border-purple-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getProjectTypeIcon = (type: Project['project_type']) => {
    switch (type) {
      case 'game':
        return '🎮'
      case 'animation':
        return '🎬'
      case 'interactive_story':
        return '📚'
      case 'art':
        return '🎨'
      case 'music':
        return '🎵'
      case 'quiz':
        return '❓'
      case 'experiment':
        return '🧪'
      case 'calculator':
        return '🧮'
      case 'data_viz':
        return '📊'
      default:
        return '💻'
    }
  }

  const formatTimeSpent = (timeSpent: string) => {
    // Parse PostgreSQL interval format (e.g., "01:23:45")
    if (!timeSpent || timeSpent === '00:00:00') return '0min'
    
    const parts = timeSpent.split(':')
    const hours = parseInt(parts[0])
    const minutes = parseInt(parts[1])
    
    if (hours > 0) {
      return `${hours}h ${minutes}min`
    }
    return `${minutes}min`
  }

  return (
    <div
      onClick={onClick}
      className="bg-white/50 rounded-[20px] p-6 shadow-[inset_0_2px_4px_rgba(255,255,255,0.8),0_4px_16px_rgba(0,0,0,0.1)] border border-white/30 hover:shadow-[inset_0_2px_4px_rgba(255,255,255,0.8),0_8px_24px_rgba(0,0,0,0.15)] hover:bg-white/60 transition-all duration-300 cursor-pointer group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <div className="text-2xl">{getProjectTypeIcon(project.project_type)}</div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-800 truncate group-hover:text-purple-700 transition-colors">
              {project.title}
            </h3>
            <p className="text-xs text-gray-500 capitalize">
              {project.project_type.replace('_', ' ')} • {project.difficulty_level}
            </p>
          </div>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(project.status)}`}>
          {project.status}
        </span>
      </div>

      {/* Description */}
      {project.description && (
        <p className="text-gray-600 text-sm mb-4 line-clamp-2 leading-relaxed">
          {project.description}
        </p>
      )}

      {/* Progress Section */}
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Progress</span>
          <span className="font-medium text-gray-800">{project.progress_percentage}%</span>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
          <div 
            className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full transition-all duration-500 ease-out" 
            style={{ width: `${project.progress_percentage}%` }}
          />
        </div>

        {/* Stats Row */}
        <div className="flex justify-between items-center text-sm text-gray-600">
          <div className="flex items-center space-x-1">
            <span>📅</span>
            <span>Week {project.current_week}/{project.duration_weeks}</span>
          </div>
          <div className="flex items-center space-x-1">
            <span>⏱️</span>
            <span>{formatTimeSpent(project.total_time_spent)}</span>
          </div>
        </div>

        {/* Sessions */}
        <div className="flex justify-between items-center text-sm text-gray-600">
          <div className="flex items-center space-x-1">
            <span>💬</span>
            <span>{project.total_sessions} sessions</span>
          </div>
          {project.concepts_mastered && project.concepts_mastered.length > 0 && (
            <div className="flex items-center space-x-1">
              <span>🎯</span>
              <span>{project.concepts_mastered.length} concepts</span>
            </div>
          )}
        </div>

        {/* Last updated */}
        <div className="text-xs text-gray-500 pt-2 border-t border-gray-200">
          Updated {new Date(project.updated_at).toLocaleDateString()}
        </div>
      </div>
    </div>
  )
}
