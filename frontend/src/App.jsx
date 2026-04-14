import { Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import MeetingsPage from './pages/MeetingsPage'
import DashboardPage from './pages/DashboardPage'
import GlobalDashboardPage from './pages/GlobalDashboardPage'
import AnalyticsPage from './pages/AnalyticsPage'
import SettingsPage from './pages/SettingsPage'
import AuthGuard from './components/AuthGuard'
import ToastContainer from './components/Toast'
import ThemeLayout from './components/landing/ThemeLayout'
import { GoogleOAuthProvider } from '@react-oauth/google'

export default function App() {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <ThemeLayout>
        <ToastContainer />
      <Routes>
      <Route path="/"              element={<LandingPage />} />
      <Route path="/login"         element={<LoginPage />} />
      <Route path="/register"      element={<RegisterPage />} />
      
      {/* Protected Routes */}
      <Route path="/dashboard"     element={<AuthGuard><GlobalDashboardPage /></AuthGuard>} />
      <Route path="/meetings"      element={<AuthGuard><MeetingsPage /></AuthGuard>} />
      <Route path="/analytics"     element={<AuthGuard><AnalyticsPage /></AuthGuard>} />
      <Route path="/meeting/:id"   element={<AuthGuard><DashboardPage /></AuthGuard>} />
      <Route path="/settings"      element={<AuthGuard><SettingsPage /></AuthGuard>} />
      
      <Route path="*"              element={<Navigate to="/" replace />} />
    </Routes>
      </ThemeLayout>
    </GoogleOAuthProvider>
  )
}
