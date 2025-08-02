'use client'

import { Project } from '../../hooks/useProjects'

interface MetricsSectionProps {
  projects: Project[]
  loading: boolean
}

export default function MetricsSection({ projects, loading }: MetricsSectionProps) {
  const getMetrics = () => {
    if (loading) return { completed: 0, active: 0, total: 0, totalTime: 0, concepts: 0 }

    const completed = projects.filter(p => p.status === 'completed').length
    const active = projects.filter(p => p.status === 'active').length
    const total = projects.length

    // Calculate total learning time (simplified - just count hours)
    const totalTimeMinutes = projects.reduce((acc, project) => {
      if (!project.total_time_spent || project.total_time_spent === '00:00:00') return acc
      const parts = project.total_time_spent.split(':')
      const hours = parseInt(parts[0]) || 0
      const minutes = parseInt(parts[1]) || 0
      return acc + (hours * 60) + minutes
    }, 0)

    // Count unique concepts mastered
    const allConcepts = projects.flatMap(p => p.concepts_mastered || [])
    const uniqueConcepts = new Set(allConcepts).size

    return { completed, active, total, totalTime: totalTimeMinutes, concepts: uniqueConcepts }
  }

  const metrics = getMetrics()

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}min`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`
  }

  const metricCards = [
    {
      icon: '✅',
      value: loading ? '...' : metrics.completed,
      label: 'Completed Projects',
      gradient: 'from-green-400 to-emerald-400',
      bgColor: 'bg-green-50/80'
    },
    {
      icon: '🚀',
      value: loading ? '...' : metrics.active,
      label: 'Active Projects',
      gradient: 'from-blue-400 to-cyan-400',
      bgColor: 'bg-blue-50/80'
    },
    {
      icon: '⏱️',
      value: loading ? '...' : formatTime(metrics.totalTime),
      label: 'Learning Time',
      gradient: 'from-purple-400 to-pink-400',
      bgColor: 'bg-purple-50/80'
    },
    {
      icon: '🎯',
      value: loading ? '...' : metrics.concepts,
      label: 'Concepts Learned',
      gradient: 'from-orange-400 to-red-400',
      bgColor: 'bg-orange-50/80'
    }
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {metricCards.map((metric, index) => (
        <div
          key={index}
          className={`${metric.bgColor} backdrop-blur-sm rounded-[18px] p-5 shadow-[inset_0_2px_8px_rgba(255,255,255,0.6),0_8px_32px_rgba(0,0,0,0.1)] border border-white/30 transition-all duration-300 hover:scale-105 hover:shadow-[inset_0_2px_8px_rgba(255,255,255,0.6),0_12px_40px_rgba(0,0,0,0.15)]`}
        >
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 bg-gradient-to-r ${metric.gradient} rounded-full flex items-center justify-center shadow-lg`}>
              <span className="text-white text-xl">{metric.icon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-2xl font-bold text-gray-800 truncate">
                {metric.value}
              </p>
              <p className="text-sm text-gray-600 leading-tight">
                {metric.label}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
