import axios from 'axios'
import toast from 'react-hot-toast'

const api = axios.create({
  baseURL:         import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  timeout:         30_000,
  withCredentials: true,   // ← sends the httpOnly JWT cookie on every request
  headers:         { 'Content-Type': 'application/json' },
})

// No request interceptor needed — cookie is sent automatically by the browser
// when withCredentials: true is set above.

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status  = error.response?.status
    const message = error.response?.data?.error || error.message

    if (status === 401) {
      // Token expired or missing — redirect to login
      window.location.href = '/auth'
    }
    if (status === 429) toast.error('Too many requests. Please slow down.')
    if (status >= 500) toast.error('Server error. Please try again.')

    return Promise.reject({ ...error, message })
  }
)

export default api