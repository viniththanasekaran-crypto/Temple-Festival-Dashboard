import axios from 'axios'
import { getActiveTempleId } from './activeTemple'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1',
  withCredentials: true, // send/receive HTTP-only cookies
})

// Attach the admin's active temple so temple-scoped endpoints know which temple to use.
api.interceptors.request.use((config) => {
  const templeId = getActiveTempleId()
  if (templeId != null) config.headers['X-Temple-Id'] = String(templeId)
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        await axios.post(
          `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1'}/auth/refresh`,
          {},
          { withCredentials: true }
        )
        return api(original)
      } catch {
        // Reject so callers handle it — ProtectedRoute redirects via React Router
        // (avoids hard reload → infinite loop when AuthContext calls getMe() on mount)
      }
    }
    return Promise.reject(err)
  }
)

export default api
