'use client'

import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import Image from 'next/image'

interface SignUpData {
  first_name: string
  last_name: string
  date_of_birth?: string
  parent_email: string
  email: string
  password: string
  confirmPassword: string
}

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  })

  const [signUpData, setSignUpData] = useState<SignUpData>({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    parent_email: '',
    email: '',
    password: '',
    confirmPassword: ''
  })

  const { signIn, signUp } = useAuth()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { error } = await signIn(loginData.email, loginData.password)
      if (error) {
        setError(error.message)
      } else {
        setSuccess('Welcome back to Ruby!')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    }
    
    setLoading(false)
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Validation
    if (signUpData.password !== signUpData.confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (signUpData.password.length < 6) {
      setError('Password must be at least 6 characters long')
      setLoading(false)
      return
    }

    try {
      const { error } = await signUp(signUpData.email, signUpData.password, {
        first_name: signUpData.first_name,
        last_name: signUpData.last_name,
        date_of_birth: signUpData.date_of_birth,
        parent_email: signUpData.parent_email
      })

      if (error) {
        setError(error.message)
      } else {
        setSuccess('Account created successfully! Please check your email to verify your account.')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    }
    
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-32 h-32 bg-gradient-to-r from-purple-200 to-pink-200 rounded-full opacity-20 blur-xl"></div>
        <div className="absolute top-40 right-32 w-24 h-24 bg-gradient-to-r from-blue-200 to-cyan-200 rounded-full opacity-20 blur-xl"></div>
        <div className="absolute bottom-32 left-32 w-40 h-40 bg-gradient-to-r from-green-200 to-teal-200 rounded-full opacity-20 blur-xl"></div>
        <div className="absolute bottom-20 right-20 w-28 h-28 bg-gradient-to-r from-yellow-200 to-orange-200 rounded-full opacity-20 blur-xl"></div>
      </div>

      {/* Main card */}
      <div className="relative w-full max-w-md">
        {/* Claymorphism container */}
        <div className="bg-white/40 backdrop-blur-sm rounded-[24px] p-8 shadow-[inset_0_2px_8px_rgba(255,255,255,0.6),0_8px_32px_rgba(0,0,0,0.1)] border border-white/20">
          
          {/* Ruby logo/header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full mb-4 shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),0_4px_16px_rgba(147,51,234,0.3)]">
              <span className="text-2xl font-bold text-white">R</span>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
              Ruby
            </h1>
            <p className="text-gray-600 text-sm">Your AI Coding Teacher</p>
          </div>

          {/* Toggle buttons */}
          <div className="flex bg-white/30 rounded-[16px] p-1 mb-6 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 px-4 rounded-[12px] text-sm font-medium transition-all duration-300 ${
                isLogin
                  ? 'bg-white/60 text-purple-600 shadow-[0_2px_8px_rgba(0,0,0,0.1),inset_0_1px_2px_rgba(255,255,255,0.8)]'
                  : 'text-gray-600 hover:text-purple-600'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 px-4 rounded-[12px] text-sm font-medium transition-all duration-300 ${
                !isLogin
                  ? 'bg-white/60 text-purple-600 shadow-[0_2px_8px_rgba(0,0,0,0.1),inset_0_1px_2px_rgba(255,255,255,0.8)]'
                  : 'text-gray-600 hover:text-purple-600'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Error/Success messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-100/60 border border-red-200 rounded-[16px] shadow-[inset_0_1px_2px_rgba(220,38,38,0.1)]">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-100/60 border border-green-200 rounded-[16px] shadow-[inset_0_1px_2px_rgba(34,197,94,0.1)]">
              <p className="text-green-600 text-sm">{success}</p>
            </div>
          )}

          {/* Login Form */}
          {isLogin ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={loginData.email}
                  onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                  className="w-full px-4 py-3 bg-white/50 border border-white/30 rounded-[16px] focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] placeholder:text-gray-400"
                  placeholder="Enter your email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  className="w-full px-4 py-3 bg-white/50 border border-white/30 rounded-[16px] focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] placeholder:text-gray-400 text-gray-800"
                  placeholder="Enter your password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-[16px] shadow-[0_4px_16px_rgba(147,51,234,0.3),inset_0_1px_2px_rgba(255,255,255,0.3)] hover:shadow-[0_6px_20px_rgba(147,51,234,0.4),inset_0_1px_2px_rgba(255,255,255,0.3)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>
          ) : (
            /* Sign Up Form */
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    required
                    value={signUpData.first_name}
                    onChange={(e) => setSignUpData({ ...signUpData, first_name: e.target.value })}
                    className="w-full px-3 py-2.5 bg-white/50 border border-white/30 rounded-[16px] focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] placeholder:text-gray-400 text-sm"
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    required
                    value={signUpData.last_name}
                    onChange={(e) => setSignUpData({ ...signUpData, last_name: e.target.value })}
                    className="w-full px-3 py-2.5 bg-white/50 border border-white/30 rounded-[16px] focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] placeholder:text-gray-400 text-sm"
                    placeholder="Last name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date of Birth (Optional)
                </label>
                <input
                  type="date"
                  value={signUpData.date_of_birth}
                  onChange={(e) => setSignUpData({ ...signUpData, date_of_birth: e.target.value })}
                  className="w-full px-4 py-3 bg-white/50 border border-white/30 rounded-[16px] focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] text-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Parent's Email
                </label>
                <input
                  type="email"
                  required
                  value={signUpData.parent_email}
                  onChange={(e) => setSignUpData({ ...signUpData, parent_email: e.target.value })}
                  className="w-full px-4 py-3 bg-white/50 border border-white/30 rounded-[16px] focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] placeholder:text-gray-400"
                  placeholder="Parent's email address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Email
                </label>
                <input
                  type="email"
                  required
                  value={signUpData.email}
                  onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                  className="w-full px-4 py-3 bg-white/50 border border-white/30 rounded-[16px] focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] placeholder:text-gray-400"
                  placeholder="Your email address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={signUpData.password}
                  onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                  className="w-full px-4 py-3 bg-white/50 border border-white/30 rounded-[16px] focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] placeholder:text-gray-400 text-gray-800"
                  placeholder="Create a password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  value={signUpData.confirmPassword}
                  onChange={(e) => setSignUpData({ ...signUpData, confirmPassword: e.target.value })}
                  className="w-full px-4 py-3 bg-white/50 border border-white/30 rounded-[16px] focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] placeholder:text-gray-400 text-gray-800"
                  placeholder="Confirm your password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-[16px] shadow-[0_4px_16px_rgba(147,51,234,0.3),inset_0_1px_2px_rgba(255,255,255,0.3)] hover:shadow-[0_6px_20px_rgba(147,51,234,0.4),inset_0_1px_2px_rgba(255,255,255,0.3)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>
          )}

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              By using Ruby, you agree to safe learning practices and parental supervision.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
