'use client'

import { useState, useEffect } from 'react'

interface ProjectConfirmationModalProps {
  isOpen: boolean
  projectName: string
  projectDescription: string
  onConfirm: (name: string, description: string) => void
  onCancel: () => void
  isCreating?: boolean
}

export default function ProjectConfirmationModal({
  isOpen,
  projectName,
  projectDescription,
  onConfirm,
  onCancel,
  isCreating = false
}: ProjectConfirmationModalProps) {
  const [editableName, setEditableName] = useState(projectName)
  const [editableDescription, setEditableDescription] = useState(projectDescription)
  const [isEditingName, setIsEditingName] = useState(false)
  const [isEditingDescription, setIsEditingDescription] = useState(false)

  // Update local state when props change
  useEffect(() => {
    setEditableName(projectName)
    setEditableDescription(projectDescription)
  }, [projectName, projectDescription])

  const handleConfirm = () => {
    if (editableName.trim() && editableDescription.trim()) {
      onConfirm(editableName.trim(), editableDescription.trim())
    }
  }

  const handleCancel = () => {
    // Reset to original values
    setEditableName(projectName)
    setEditableDescription(projectDescription)
    setIsEditingName(false)
    setIsEditingDescription(false)
    onCancel()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/90 backdrop-blur-md border border-white/30 rounded-[24px] shadow-[inset_0_4px_12px_rgba(255,255,255,0.7),0_16px_48px_rgba(147,51,234,0.3)] w-full max-w-lg">
        
        {/* Header */}
        <div className="p-6 border-b border-purple-100/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),0_4px_16px_rgba(34,197,94,0.3)] flex items-center justify-center">
              <span className="text-lg font-bold text-white">🎉</span>
            </div>
            <div>
              <h3 className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                Project Ready!
              </h3>
              <p className="text-gray-600 text-sm">Review and customize your project details</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          {/* Project Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Project Name
            </label>
            {isEditingName ? (
              <input
                type="text"
                value={editableName}
                onChange={(e) => setEditableName(e.target.value)}
                onBlur={() => setIsEditingName(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setIsEditingName(false)
                  if (e.key === 'Escape') {
                    setEditableName(projectName)
                    setIsEditingName(false)
                  }
                }}
                className="w-full px-4 py-3 bg-white/60 backdrop-blur-sm border border-white/30 rounded-[16px] shadow-[inset_0_2px_4px_rgba(255,255,255,0.6)] focus:outline-none focus:border-green-300 focus:shadow-[inset_0_2px_4px_rgba(255,255,255,0.6),0_0_0_3px_rgba(34,197,94,0.1)] text-gray-800"
                autoFocus
              />
            ) : (
              <div
                onClick={() => setIsEditingName(true)}
                className="w-full px-4 py-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100/50 rounded-[16px] shadow-[inset_0_2px_4px_rgba(255,255,255,0.6)] cursor-pointer hover:shadow-[inset_0_2px_4px_rgba(255,255,255,0.6),0_0_0_2px_rgba(34,197,94,0.1)] transition-all"
              >
                <p className="text-gray-800 font-medium">{editableName}</p>
                <p className="text-xs text-gray-500 mt-1">Click to edit</p>
              </div>
            )}
          </div>

          {/* Project Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Project Description
            </label>
            {isEditingDescription ? (
              <textarea
                value={editableDescription}
                onChange={(e) => setEditableDescription(e.target.value)}
                onBlur={() => setIsEditingDescription(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setEditableDescription(projectDescription)
                    setIsEditingDescription(false)
                  }
                }}
                rows={4}
                className="w-full px-4 py-3 bg-white/60 backdrop-blur-sm border border-white/30 rounded-[16px] shadow-[inset_0_2px_4px_rgba(255,255,255,0.6)] focus:outline-none focus:border-green-300 focus:shadow-[inset_0_2px_4px_rgba(255,255,255,0.6),0_0_0_3px_rgba(34,197,94,0.1)] text-gray-800 resize-none"
                autoFocus
              />
            ) : (
              <div
                onClick={() => setIsEditingDescription(true)}
                className="w-full px-4 py-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100/50 rounded-[16px] shadow-[inset_0_2px_4px_rgba(255,255,255,0.6)] cursor-pointer hover:shadow-[inset_0_2px_4px_rgba(255,255,255,0.6),0_0_0_2px_rgba(34,197,94,0.1)] transition-all min-h-[80px]"
              >
                <p className="text-gray-800">{editableDescription}</p>
                <p className="text-xs text-gray-500 mt-2">Click to edit</p>
              </div>
            )}
          </div>

          {/* Loading State */}
          {isCreating && (
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-100/50 rounded-[16px] shadow-[inset_0_2px_4px_rgba(255,255,255,0.6)] p-4">
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-blue-800 font-medium">Creating your project...</span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-purple-100/50">
          <div className="flex space-x-3">
            <button
              onClick={handleCancel}
              disabled={isCreating}
              className="flex-1 px-6 py-3 bg-white/60 backdrop-blur-sm border border-white/30 rounded-[16px] shadow-[inset_0_2px_4px_rgba(255,255,255,0.6)] text-gray-700 font-medium hover:bg-white/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!editableName.trim() || !editableDescription.trim() || isCreating}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-[16px] shadow-[0_8px_32px_rgba(34,197,94,0.3),inset_0_2px_4px_rgba(255,255,255,0.3)] hover:shadow-[0_12px_40px_rgba(34,197,94,0.4)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isCreating ? 'Creating...' : 'Start Building'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
