import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, useSearchParams, useLocation } from 'react-router-dom'
import { initGA, trackPageView } from './utils/analytics'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import { ThemeProvider } from './context/ThemeContext'
import { Toaster } from './components/ui/toaster'
import ErrorBoundary from './components/ErrorBoundary'
import HomePage from './pages/HomePage'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import ProfilePage from './pages/ProfilePage'
import PricingPage from './pages/PricingPage'
import HelpPage from './pages/HelpPage'
import TermsPage from './pages/TermsPage'
import PrivacyPage from './pages/PrivacyPage'
import ExtensionCallbackPage from './pages/ExtensionCallbackPage'
import TeamPage from './pages/TeamPage'
import ComingSoonPage from './pages/ComingSoonPage'
import NotFoundPage from './pages/NotFoundPage'
import './App.css'

// Initialize GA4 (no-op if VITE_GA_MEASUREMENT_ID is not set)
initGA()

function RouteTracker() {
  const location = useLocation()
  React.useEffect(() => {
    trackPageView(location.pathname, document.title)
  }, [location.pathname])
  return null
}

// Protected route wrapper
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

// Public route - redirects to app if already authenticated
function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const [searchParams] = useSearchParams()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    )
  }

  if (isAuthenticated) {
    const dest = searchParams.get('source') === 'extension' ? '/extension-callback' : '/app'
    return <Navigate to={dest} replace />
  }

  return children
}

// Coming soon page — guests see ComingSoonPage, authenticated users go to /app
function ComingSoonRoute() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/app" replace />
  }

  return <ComingSoonPage />
}

// Admin-only route — requires is_superuser, otherwise redirects to /
function AdminRoute({ children }) {
  const { isAuthenticated, user, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    )
  }

  if (!isAuthenticated || !user?.is_superuser) {
    return <Navigate to="/" replace />
  }

  return children
}

function AppRoutes() {
  return (
    <Routes>
      {/* Coming soon page (replaces landing for pre-launch) */}
      <Route path="/" element={<ComingSoonRoute />} />
      <Route path="/landing" element={<AdminRoute><LandingPage /></AdminRoute>} />

      {/* Auth routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <ForgotPasswordPage />
          </PublicRoute>
        }
      />
      <Route
        path="/reset-password"
        element={
          <PublicRoute>
            <ResetPasswordPage />
          </PublicRoute>
        }
      />

      {/* Semi-public routes */}
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/help" element={<HelpPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />

      {/* Protected routes */}
      <Route
        path="/extension-callback"
        element={
          <ProtectedRoute>
            <ExtensionCallbackPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/team"
        element={
          <ProtectedRoute>
            <TeamPage />
          </ProtectedRoute>
        }
      />

      {/* Catch all - 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <RouteTracker />
          <AuthProvider>
            <DataProvider>
              <a href="#main-content" className="skip-nav">Skip to main content</a>
              <AppRoutes />
              <Toaster />
            </DataProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
