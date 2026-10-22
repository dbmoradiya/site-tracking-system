import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, type User } from './api'

type AuthContextValue = {
  user: User | null
  loading: boolean
  login: (mobile: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const value = localStorage.getItem('sitetrack-user')
    if (!value) return null
    const stored = JSON.parse(value) as User & { role?: User['roles'][number] }
    if (!stored.roles && stored.role) {
      const migrated = { ...stored, roles: [stored.role] }
      delete migrated.role
      localStorage.setItem('sitetrack-user', JSON.stringify(migrated))
      return migrated
    }
    return stored
  })
  const [loading, setLoading] = useState(false)

  const logout = () => {
    localStorage.removeItem('sitetrack-token')
    localStorage.removeItem('sitetrack-user')
    setUser(null)
  }

  useEffect(() => {
    window.addEventListener('sitetrack:unauthorized', logout)
    return () => window.removeEventListener('sitetrack:unauthorized', logout)
  }, [])

  const login = async (mobile: string, password: string) => {
    setLoading(true)
    try {
      const result = await api<{ token: string; user: User }>('/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mobile, password }),
      })
      localStorage.setItem('sitetrack-token', result.token)
      localStorage.setItem('sitetrack-user', JSON.stringify(result.user))
      setUser(result.user)
    } finally { setLoading(false) }
  }

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be inside AuthProvider')
  return value
}
