'use client'

import { useState } from 'react'
import { useProjects, Project } from '../../hooks/useProjects'

interface CreateProjectModalProps {
  isOpen: boolean
  onClose: () => void
}

type ProjectType = Project['project_type']
type DifficultyLevel = Project['difficulty_level']

export default function CreateProjectModal({ isOpen, onClose }: CreateProjectModalProps) {
  const { createProject } = useProjects()
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    project_type: 'game' as ProjectType,
    initial_request: '',
    scoped_goal: '',
    learning_goal: '',
    duration_weeks: 4,
    difficulty_level: 'beginner' as DifficultyLevel
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      await createProject(formData)
      setFormData({
        title: '',
        description: '',
        project_type: 'game' as ProjectType,
        initial_request: '',
        scoped_goal: '',
        learning_goal: '',
        duration_weeks: 4,
        difficulty_level: 'beginner' as DifficultyLevel
      })
      onClose()
    } catch (error) {
      console.error('Error creating project:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/90 backdrop-blur-md rounded-[24px] p-8 max-w-md w-full shadow-[inset_0_2px_8px_rgba(255,255,255,0.6),0_16px_64px_rgba(0,0,0,0.2)] border border-white/30">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Create New Project
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-gray-100/80 hover:bg-gray-200/80 rounded-full flex items-center justify-center transition-colors"
          >
            <span className="text-gray-600">✕</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Project Title
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-3 bg-white/60 backdrop-blur-sm border border-white/30 rounded-[12px] focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all"
              placeholder="My Awesome Ruby Project"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-4 py-3 bg-white/60 backdrop-blur-sm border border-white/30 rounded-[12px] focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all resize-none"
              placeholder="Describe what you want to build..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What do you want to learn?
            </label>
            <textarea
              required
              value={formData.learning_goal}
              onChange={(e) => setFormData({ ...formData, learning_goal: e.target.value })}
              rows={2}
              className="w-full px-4 py-3 bg-white/60 backdrop-blur-sm border border-white/30 rounded-[12px] focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all resize-none"
              placeholder="I want to learn about variables, loops, methods..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tell Ruby about your idea
            </label>
            <textarea
              required
              value={formData.initial_request}
              onChange={(e) => setFormData({ ...formData, initial_request: e.target.value })}
              rows={2}
              className="w-full px-4 py-3 bg-white/60 backdrop-blur-sm border border-white/30 rounded-[12px] focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all resize-none"
              placeholder="I want to create a game where..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Project Goal
            </label>
            <input
              type="text"
              required
              value={formData.scoped_goal}
              onChange={(e) => setFormData({ ...formData, scoped_goal: e.target.value })}
              className="w-full px-4 py-3 bg-white/60 backdrop-blur-sm border border-white/30 rounded-[12px] focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all"
              placeholder="Build a simple number guessing game"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project Type
              </label>
              <select
                value={formData.project_type}
                onChange={(e) => setFormData({ ...formData, project_type: e.target.value as ProjectType })}
                className="w-full px-4 py-3 bg-white/60 backdrop-blur-sm border border-white/30 rounded-[12px] focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all"
              >
                <option value="game">🎮 Game</option>
                <option value="animation">🎬 Animation</option>
                <option value="interactive_story">📖 Interactive Story</option>
                <option value="art">🎨 Art</option>
                <option value="music">🎵 Music</option>
                <option value="quiz">🧠 Quiz</option>
                <option value="experiment">🔬 Experiment</option>
                <option value="calculator">🧮 Calculator</option>
                <option value="data_viz">� Data Visualization</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration
              </label>
              <select
                value={formData.duration_weeks}
                onChange={(e) => setFormData({ ...formData, duration_weeks: parseInt(e.target.value) })}
                className="w-full px-4 py-3 bg-white/60 backdrop-blur-sm border border-white/30 rounded-[12px] focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all"
              >
                <option value={2}>2 weeks</option>
                <option value={4}>4 weeks</option>
                <option value={6}>6 weeks</option>
                <option value={8}>8 weeks</option>
                <option value={12}>12 weeks</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Difficulty Level
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['beginner', 'intermediate', 'advanced'].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setFormData({ ...formData, difficulty_level: level as DifficultyLevel })}
                  className={`px-4 py-2 rounded-[10px] text-sm font-medium transition-all ${
                    formData.difficulty_level === level
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                      : 'bg-white/60 text-gray-700 hover:bg-white/80'
                  }`}
                >
                  {level === 'beginner' && '🌱'} 
                  {level === 'intermediate' && '🌿'} 
                  {level === 'advanced' && '🌳'} 
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-100/80 text-gray-700 rounded-[12px] font-medium hover:bg-gray-200/80 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-[12px] font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                  Creating...
                </div>
              ) : (
                'Create Project'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
