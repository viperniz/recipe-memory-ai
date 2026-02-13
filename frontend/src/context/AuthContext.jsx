import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authApi } from '../api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Check if user is authenticated on mount
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token')
      if (storedToken) {
        try {
          const userData = await authApi.getMe(storedToken)
          if (userData) {
            setUser(userData)
            setToken(storedToken)
          } else {
            // Invalid response, clear token
            localStorage.removeItem('token')
            setToken(null)
            setUser(null)
          }
        } catch (err) {
          console.warn('Token validation failed on init:', err)
          // Token invalid, clear it
          localStorage.removeItem('token')
          setToken(null)
          setUser(null)
        }
      }
      setLoading(false)
    }
    initAuth()
  }, [])

  const login = useCallback(async (email, password) => {
    setError(null)
    try {
      const response = await authApi.login(email, password)
      if (!response || !response.access_token) {
        throw new Error('Invalid login response: missing access token')
      }
      if (!response.user) {
        throw new Error('Invalid login response: missing user data')
      }
      
      // Store token and update state atomically
      const token = response.access_token
      localStorage.setItem('token', token)
      setToken(token)
      setUser(response.user)
      
      return response.user
    } catch (err) {
      const message = err.response?.data?.detail || err.message || 'Login failed'
      setError(message)
      // Clear any partial state on error
      localStorage.removeItem('token')
      setToken(null)
      setUser(null)
      throw new Error(message)
    }
  }, [])

  const register = useCallback(async (email, password, fullName) => {
    setError(null)
    try {
      const response = await authApi.register(email, password, fullName)
      localStorage.setItem('token', response.access_token)
      setToken(response.access_token)
      setUser(response.user)
      return response.user
    } catch (err) {
      const message = err.response?.data?.detail || 'Registration failed'
      setError(message)
      throw new Error(message)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      if (token) {
        await authApi.logout(token)
      }
    } catch (err) {
      // Ignore logout errors
    } finally {
      localStorage.removeItem('token')
      setToken(null)
      setUser(null)
    }
  }, [token])

  const googleLogin = useCallback(async (credential) => {
    setError(null)
    try {
      const response = await authApi.googleLogin(credential)
      if (!response || !response.access_token || !response.user) {
        throw new Error('Invalid Google login response')
      }
      localStorage.setItem('token', response.access_token)
      setToken(response.access_token)
      setUser(response.user)
      return response.user
    } catch (err) {
      const message = err.response?.data?.detail || err.message || 'Google login failed'
      setError(message)
      throw new Error(message)
    }
  }, [])

  const refreshUser = useCallback(async () => {
    if (!token) return
    try {
      const userData = await authApi.getMe(token)
      setUser(userData)
    } catch (err) {
      // Token might be invalid
      logout()
    }
  }, [token, logout])

  const value = {
    user,
    token,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    register,
    googleLogin,
    logout,
    refreshUser,
    clearError: () => setError(null)
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
