import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { getMe } from '../utils/api'

export default function AuthGuard({ children }) {
  const [loading, setLoading] = useState(true)
  const [auth, setAuth] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setAuth(false)
      setLoading(false)
      return
    }

    getMe()
      .then(() => {
        setAuth(true)
      })
      .catch((err) => {
        console.error("Auth failed:", err)
        localStorage.removeItem('token')
        setAuth(false)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0c10', color: '#e8eaf0' }}>
        Loading...
      </div>
    )
  }

  if (!auth) {
    return <Navigate to="/login" replace />
  }

  return children
}
