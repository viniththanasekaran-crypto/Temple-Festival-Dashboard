import api from './axios'

export interface TempleRef {
  id: number
  name: string
}

export interface User {
  id: number
  username: string
  role: 'super_admin' | 'admin' | 'viewer'
  templeIds: number[]
  temples: TempleRef[] // id + name of temples this user can act on
}

export async function getMe(): Promise<User> {
  const res = await api.get<{ success: boolean; data: { user: User } }>('/auth/me')
  return res.data.data.user
}

export async function login(username: string, password: string): Promise<User> {
  const res = await api.post<{ success: boolean; data: { user: User } }>('/auth/login', {
    username,
    password,
  })
  return res.data.data.user
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout')
}
