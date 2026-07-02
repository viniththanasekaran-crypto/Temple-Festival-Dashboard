import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'
import Users from '../pages/Users'
import { AuthContext } from '../context/AuthContext'
import type { AdminUser } from '../api/users'
import type { Temple } from '../api/temples'

vi.mock('../api/users', () => ({
  getUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deactivateUser: vi.fn(),
}))

vi.mock('../api/temples', () => ({
  getTemples: vi.fn(),
}))

import * as usersApi from '../api/users'
import * as templesApi from '../api/temples'

const SUPER_ADMIN = { id: 1, username: 'superadmin', role: 'super_admin' as const, templeId: null }

const SAMPLE_TEMPLE = {
  id: 5,
  name: 'Palani Temple',
  district: { id: 1, name: 'Dindigul' },
  _count: { festivals: 0, families: 0, users: 0 },
} as unknown as Temple

const CREATED_ADMIN: AdminUser = {
  id: 42,
  username: 'admin_palani',
  name: 'Test Admin',
  phone: null,
  isActive: true,
  role: { name: 'admin' },
  temple: { id: 5, name: 'Palani Temple' },
  createdAt: '2026-01-01T00:00:00.000Z',
}

function renderUsers() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <AuthContext.Provider
      value={{ user: SUPER_ADMIN, loading: false, setUser: vi.fn(), logout: vi.fn() }}
    >
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Users />
        </MemoryRouter>
      </QueryClientProvider>
    </AuthContext.Provider>
  )
}

describe('Users page', () => {
  it('creates an admin and closes the form modal on submit', async () => {
    vi.mocked(usersApi.getUsers).mockResolvedValue([])
    vi.mocked(templesApi.getTemples).mockResolvedValue([SAMPLE_TEMPLE])
    vi.mocked(usersApi.createUser).mockResolvedValueOnce({
      user: CREATED_ADMIN,
      password: 'Gen3rated!pwd',
    })

    const { container } = renderUsers()

    fireEvent.click(screen.getByRole('button', { name: '+ Add User' }))

    fireEvent.change(screen.getByLabelText(/Username/), {
      target: { value: 'admin_palani' },
    })
    // role defaults to "admin" → temple selector is shown and required.
    // wait for the option (from the async temples query) before selecting it,
    // otherwise the select value won't stick to a not-yet-rendered option
    await screen.findByRole('option', { name: 'Palani Temple' })
    fireEvent.change(screen.getByLabelText(/Temple/), {
      target: { value: '5' },
    })
    // submit the form directly to bypass jsdom's HTML5 required-field guard
    fireEvent.submit(container.querySelector('form')!)

    // TanStack Query passes a mutation-context 2nd arg, so assert on the payload only
    await waitFor(() => {
      expect(vi.mocked(usersApi.createUser).mock.calls[0]?.[0]).toEqual({
        username: 'admin_palani',
        role: 'admin',
        templeId: 5,
      })
    })

    // form modal closed; success modal with generated password shown
    expect(screen.queryByRole('button', { name: 'Create User' })).not.toBeInTheDocument()
    expect(await screen.findByText('Gen3rated!pwd')).toBeInTheDocument()
  })
})
