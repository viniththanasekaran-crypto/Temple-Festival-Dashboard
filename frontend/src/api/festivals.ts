import api from './axios'

export interface FestivalAgenda {
  id: number
  order: number // day number (1-based)
  title: string | null
  description: string | null
}

export interface FestivalContact {
  name: string
  phone?: string // +91XXXXXXXXXX
}

export interface Festival {
  id: number
  templeId: number
  name: string
  description: string | null
  headName: string | null
  headPhone: string | null
  phone2: string | null
  phone3: string | null
  contacts: FestivalContact[]
  agenda: FestivalAgenda[]
  startDate: string
  endDate: string
  fixedAmount: string // Prisma Decimal → string in JSON
  isActive: boolean
  _count: { payments: number }
  createdAt: string
}

export type FestivalDetail = Festival

export interface CreateFestivalPayload {
  name: string
  description?: string
  contacts?: FestivalContact[]
  agenda?: { title: string; description?: string }[]
  startDate: string // ISO datetime
  endDate: string // ISO datetime
  fixedAmount: number
  isActive?: boolean
}

export async function getFestivals(): Promise<Festival[]> {
  const res = await api.get<{ success: boolean; data: { festivals: Festival[] } }>('/festivals')
  return res.data.data.festivals
}

export async function getFestival(id: number): Promise<FestivalDetail> {
  const res = await api.get<{ success: boolean; data: { festival: FestivalDetail } }>(
    `/festivals/${id}`
  )
  return res.data.data.festival
}

export async function createFestival(payload: CreateFestivalPayload): Promise<Festival> {
  const res = await api.post<{ success: boolean; data: { festival: Festival } }>(
    '/festivals',
    payload
  )
  return res.data.data.festival
}

export async function updateFestival(
  id: number,
  payload: Partial<CreateFestivalPayload>
): Promise<Festival> {
  const res = await api.put<{ success: boolean; data: { festival: Festival } }>(
    `/festivals/${id}`,
    payload
  )
  return res.data.data.festival
}

export async function deleteFestival(id: number): Promise<void> {
  await api.delete(`/festivals/${id}`)
}
