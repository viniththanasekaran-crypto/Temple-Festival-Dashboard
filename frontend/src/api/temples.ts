import api from './axios'

export interface District {
  id: number
  name: string
}

export interface Temple {
  id: number
  name: string
  deity: string | null
  village: string | null
  address: string | null
  districtId: number
  district: District
  _count: { festivals: number; families: number; users: number }
  createdAt: string
}

export interface CreateTemplePayload {
  name: string
  deity?: string
  village?: string
  address?: string
  districtId: number
}

export async function getTemples(): Promise<Temple[]> {
  const res = await api.get<{ success: boolean; data: { temples: Temple[] } }>('/temples')
  return res.data.data.temples
}

export async function createTemple(payload: CreateTemplePayload): Promise<Temple> {
  const res = await api.post<{ success: boolean; data: { temple: Temple } }>('/temples', payload)
  return res.data.data.temple
}

export async function updateTemple(
  id: number,
  payload: Partial<CreateTemplePayload>
): Promise<Temple> {
  const res = await api.put<{ success: boolean; data: { temple: Temple } }>(
    `/temples/${id}`,
    payload
  )
  return res.data.data.temple
}

export async function deleteTemple(id: number): Promise<void> {
  await api.delete(`/temples/${id}`)
}

export async function getDistricts(): Promise<District[]> {
  const res = await api.get<{ success: boolean; data: { districts: District[] } }>('/districts')
  return res.data.data.districts
}
