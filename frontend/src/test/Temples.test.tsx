import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'
import Temples from '../pages/Temples'
import { AuthContext } from '../context/AuthContext'
import type { Temple } from '../api/temples'

vi.mock('../api/temples', () => ({
  getTemples: vi.fn(),
  getDistricts: vi.fn().mockResolvedValue([]),
  createTemple: vi.fn(),
  updateTemple: vi.fn(),
  deleteTemple: vi.fn(),
}))

import * as templesApi from '../api/temples'

const SUPER_ADMIN = {
  id: 1,
  username: 'superadmin',
  role: 'super_admin' as const,
  templeIds: [],
  temples: [],
}

function renderTemples() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <AuthContext.Provider
      value={{
        user: SUPER_ADMIN,
        loading: false,
        activeTempleId: null,
        setUser: vi.fn(),
        setActiveTempleId: vi.fn(),
        logout: vi.fn(),
      }}
    >
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Temples />
        </MemoryRouter>
      </QueryClientProvider>
    </AuthContext.Provider>
  )
}

const SAMPLE_TEMPLE: Temple = {
  id: 10,
  name: 'Arulmigu Murugan Temple',
  deity: 'Murugan',
  village: 'Palani',
  address: null,
  about: null,
  phone: null,
  phone2: null,
  phone3: null,
  contacts: [],
  districtId: 1,
  district: { id: 1, name: 'Dindigul' },
  _count: { festivals: 0, families: 0, users: 0 },
  createdAt: '2026-01-01T00:00:00.000Z',
}

describe('Temples page', () => {
  it('renders a temple card with name, deity and village', async () => {
    vi.mocked(templesApi.getTemples).mockResolvedValueOnce([SAMPLE_TEMPLE])
    renderTemples()

    expect(await screen.findByText('Arulmigu Murugan Temple')).toBeInTheDocument()
    expect(screen.getByText('Murugan')).toBeInTheDocument()
    // village + district are rendered together as "Palani, Dindigul"
    expect(screen.getByText(/Palani/)).toBeInTheDocument()
  })

  it('shows an error when submitting the Add Temple form without a district', async () => {
    vi.mocked(templesApi.getTemples).mockResolvedValueOnce([])
    const { container } = renderTemples()

    fireEvent.click(screen.getByRole('button', { name: '+ Add Temple' }))

    fireEvent.change(screen.getByLabelText(/Temple Name/), {
      target: { value: 'New Temple' },
    })
    // submit the form directly — bypasses jsdom's HTML5 required-field guard so
    // the app-level "district required" validation runs
    fireEvent.submit(container.querySelector('form')!)

    await waitFor(() => {
      expect(screen.getByText('Please select a district')).toBeInTheDocument()
    })
    expect(templesApi.createTemple).not.toHaveBeenCalled()
  })
})
