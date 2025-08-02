'use client'

import { useAuth } from '../hooks/useAuth'
import AuthPage from '../components/AuthPage'
import MainDashboard from '../components/Dashboard/MainDashboard'

export default function Home() {
  const { user, loading } = useAuth()

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
          <p className="text-gray-600">Loading Ruby...</p>
        </div>
      </div>
    )
  }

  // Show dashboard if user is authenticated, otherwise show auth page
  return user ? <MainDashboard /> : <AuthPage />
}
