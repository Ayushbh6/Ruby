import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

// Types for our database tables
export interface User {
  id: string
  username: string
  display_name: string | null
  grade_level: string | null
  parent_email: string
  parent_auth_user_id: string | null
  parental_consent: boolean
  parental_consent_date: string | null
  account_verified_by_parent: boolean
  supervised_mode: boolean
  restricted_features: string[]
  content_filter_level: 'strict' | 'moderate' | 'relaxed'
  preferences: any
  timezone: string
  language: string
  created_at: string
  last_active_at: string
  total_learning_time: string
  is_active: boolean
  subscription_status: 'free' | 'premium' | 'family' | 'school'
  subscription_expires_at: string | null
  learning_style: 'visual' | 'auditory' | 'kinesthetic' | 'mixed'
  attention_span_minutes: number
  profile_visibility: 'private' | 'friends' | 'public'
  allow_data_for_research: boolean
  date_of_birth: string | null
  age: number | null
}

export interface AuthState {
  user: any | null
  loading: boolean
}
