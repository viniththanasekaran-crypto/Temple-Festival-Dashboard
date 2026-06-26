import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1',
  withCredentials: true, // send/receive HTTP-only cookies
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
