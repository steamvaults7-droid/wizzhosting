import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from './supabase'
import type { DatabaseUser, UserRole } from '../types'

interface AuthContextValue {
  user: DatabaseUser | null
  loading: boolean
  signUp: (email: string, password: string, username: string) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signInAsGuest: () => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  updateUser: (updates: Partial<DatabaseUser>) => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DatabaseUser | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadUser(userId: string): Promise<DatabaseUser | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error || !data) return null
    return {
      id: data.id,
      username: data.username,
      email: data.email,
      avatar: data.avatar,
      email_verified: data.email_verified ?? false,
      role: (data.role as UserRole) ?? 'user',
      suspended: data.suspended ?? false,
      created_at: data.created_at,
      updated_at: data.updated_at,
      last_login: data.last_login,
    }
  }

  useEffect(() => {
    let mounted = true

    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const u = await loadUser(session.user.id)
        if (mounted) setUser(u)
      }
      if (mounted) setLoading(false)
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      ;(async () => {
        if (session?.user) {
          const u = await loadUser(session.user.id)
          if (mounted) setUser(u)
        } else {
          if (mounted) setUser(null)
        }
        if (mounted) setLoading(false)
      })()
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function signUp(email: string, password: string, username: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    })
    if (error) return { error: error.message }
    if (data.user) {
      // The handle_new_user trigger creates the profile automatically,
      // but we update it here in case the trigger hasn't fired yet.
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        username,
        email,
        role: 'user',
        suspended: false,
        email_verified: false,
      }, { onConflict: 'id' })
      if (profileError) return { error: profileError.message }
    }
    return { error: null }
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    if (data.user) {
      const u = await loadUser(data.user.id)
      if (u?.suspended) {
        await supabase.auth.signOut()
        return { error: 'Your account has been suspended.' }
      }
      setUser(u)
      await supabase.from('profiles').update({ last_login: new Date().toISOString() }).eq('id', data.user.id)
    }
    return { error: null }
  }

  async function signInAsGuest() {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'guest@cubeforge.local',
      password: 'GuestCubeForge2026!',
    })
    if (error) return { error: error.message }
    if (data.user) {
      const u = await loadUser(data.user.id)
      setUser(u)
    }
    return { error: null }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
  }

  function updateUser(updates: Partial<DatabaseUser>) {
    setUser((prev) => (prev ? { ...prev, ...updates } : null))
  }

  async function refreshUser() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const u = await loadUser(session.user.id)
      setUser(u)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signInAsGuest, signOut, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
