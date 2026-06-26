import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from '../components/ProtectedRoute'
import { AuthContext } from '../context/AuthContext'
import type { User } from '../api/auth'

function renderProtected(user: User | null, loading = false) {
  return render(
    <AuthContext.Provider value={{ user, loading, setUser: () => {}, logout: async () => {} }}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div>Protected content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

describe('ProtectedRoute', () => {
  it('renders children when user is authenticated', () => {
    renderProtected({ id: 1, username: 'admin', role: 'admin', templeId: 1 })
    expect(screen.getByText('Protected content')).toBeInTheDocument()
  })

  it('redirects to /login when user is null', () => {
    renderProtected(null)
    expect(screen.getByText('Login page')).toBeInTheDocument()
  })

  it('renders nothing while loading (prevents flash redirect)', () => {
    const { container } = renderProtected(null, true)
    expect(container.firstChild).toBeNull()
  })
})
