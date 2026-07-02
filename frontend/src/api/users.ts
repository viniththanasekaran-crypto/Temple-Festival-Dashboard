import api from './axios'

export interface AdminUser {
  id: number
  username: string
  name: string | null
  phone: string | null
  isActive: boolean
  role: { name: string }
  temples: { id: number; name: string }[]
  createdAt: string
}

export interface CreateUserPayload {
  username: string
  name?: string
  phone?: string
  role: 'super_admin' | 'admin'
  templeIds?: number[]
}

export interface UpdateUserPayload {
  name?: string
  phone?: string
  role?: 'super_admin' | 'admin'
  templeIds?: number[]
}

export async function getUsers(): Promise<AdminUser[]> {
  const res = await api.get<{ success: boolean; data: { users: AdminUser[] } }>('/users')
  return res.data.data.users
}

export async function createUser(
  payload: CreateUserPayload
): Promise<{ user: AdminUser; password: string }> {
  const res = await api.post<{ success: boolean; data: { user: AdminUser; password: string } }>(
    '/users',
    payload
  )
  return res.data.data
}

export async function updateUser(id: number, payload: UpdateUserPayload): Promise<AdminUser> {
  const res = await api.put<{ success: boolean; data: { user: AdminUser } }>(
    `/users/${id}`,
    payload
  )
  return res.data.data.user
}

export async function deactivateUser(id: number): Promise<AdminUser> {
  const res = await api.put<{ success: boolean; data: { user: AdminUser } }>(
    `/users/${id}/deactivate`
  )
  return res.data.data.user
}
