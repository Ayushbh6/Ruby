import { useState, useEffect } from 'react'
import { supabase, type AuthState } from '../lib/supabase'
import { Session, User } from '@supabase/supabase-js'

export function useAuth(): AuthState & {
  signUp: (email: string, password: string, userData: any) => Promise<any>
  signIn: (email: string, password: string) => Promise<any>
  signOut: () => Promise<any>
} {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email: string, password: string, userData: {
    first_name: string
    last_name: string
    date_of_birth?: string
    parent_email: string
  }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: `${userData.first_name.toLowerCase()}_${userData.last_name.toLowerCase()}_${Math.random().toString(36).substr(2, 4)}`,
          display_name: `${userData.first_name} ${userData.last_name}`,
          parent_email: userData.parent_email,
          date_of_birth: userData.date_of_birth
        }
      }
    })

    if (!error && data.user) {
      // Create user profile in our custom users table
      const { error: profileError } = await supabase
        .from('users')
        .insert([
          {
            id: data.user.id,
            username: `${userData.first_name.toLowerCase()}_${userData.last_name.toLowerCase()}_${Math.random().toString(36).substr(2, 4)}`,
            display_name: `${userData.first_name} ${userData.last_name}`,
            parent_email: userData.parent_email,
            date_of_birth: userData.date_of_birth || null,
            age: userData.date_of_birth ? new Date().getFullYear() - new Date(userData.date_of_birth).getFullYear() : null,
            parental_consent: false,
            account_verified_by_parent: false,
            supervised_mode: true,
            content_filter_level: 'strict',
            learning_style: 'visual',
            attention_span_minutes: 15,
            profile_visibility: 'private',
            allow_data_for_research: false
          }
        ])

      if (profileError) {
        console.error('Error creating user profile:', profileError)
        return { data, error: profileError }
      }
    }

    return { data, error }
  }

  const signIn = async (email: string, password: string) => {
    return await supabase.auth.signInWithPassword({ email, password })
  }

  const signOut = async () => {
    return await supabase.auth.signOut()
  }

  return {
    user,
    loading,
    signUp,
    signIn,
    signOut
  }
}
