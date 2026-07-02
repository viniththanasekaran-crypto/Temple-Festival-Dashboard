import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { User } from '../api/auth'
import { getMe, logout as apiLogout } from '../api/auth'
import { getActiveTempleId, setActiveTempleId as persistActiveTemple } from '../api/activeTemple'

interface AuthContextValue {
  user: User | null
  loading: boolean
  activeTempleId: number | null
  setUser: (user: User | null) => void
  setActiveTempleId: (id: number | null) => void
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

// Keep the persisted active temple if it's still one the user can access,
// otherwise fall back to their first temple (null when they have none).
function defaultActiveTemple(user: User | null): number | null {
  if (!user || user.templeIds.length === 0) return null
  const persisted = getActiveTempleId()
  return persisted && user.templeIds.includes(persisted) ? persisted : user.templeIds[0]
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTempleId, setActiveTempleIdState] = useState<number | null>(null)

  const setActiveTempleId = useCallback((id: number | null) => {
    persistActiveTemple(id)
    setActiveTempleIdState(id)
  }, [])

  const setUser = useCallback(
    (next: User | null) => {
      setUserState(next)
      setActiveTempleId(defaultActiveTemple(next))
    },
    [setActiveTempleId]
  )

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [setUser])

  const logout = useCallback(async () => {
    await apiLogout()
    setUser(null)
  }, [setUser])

  return (
    <AuthContext.Provider
      value={{ user, loading, activeTempleId, setUser, setActiveTempleId, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
