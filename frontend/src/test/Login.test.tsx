import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import Login from '../pages/Login'
import { AuthContext } from '../context/AuthContext'

vi.mock('../api/auth', () => ({
  login: vi.fn(),
  getMe: vi.fn().mockResolvedValue(null),
  logout: vi.fn(),
}))

import * as authApi from '../api/auth'

function renderLogin(setUser = vi.fn()) {
  return render(
    <AuthContext.Provider value={{ user: null, loading: false, setUser, logout: vi.fn() }}>
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

describe('Login page', () => {
  it('renders username and password fields', () => {
    renderLogin()
    expect(screen.getByLabelText('Username')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows error message on failed login', async () => {
    vi.mocked(authApi.login).mockRejectedValueOnce({
      response: { data: { message: 'Invalid username or password' } },
    })
    renderLogin()

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'bad' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid username or password')).toBeInTheDocument()
    })
  })

  it('calls login with entered credentials', async () => {
    vi.mocked(authApi.login).mockResolvedValueOnce({
      id: 1,
      username: 'superadmin',
      role: 'super_admin',
      templeId: null,
    })
    renderLogin()

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'superadmin' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Admin@1234' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith('superadmin', 'Admin@1234')
    })
  })
})
