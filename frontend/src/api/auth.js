import axios from 'axios'

import { API_BASE } from '../lib/apiBase'

// Create axios instance with auth header
const createAuthClient = (token) => {
  return axios.create({
    baseURL: API_BASE,
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
}

export const authApi = {
  async register(email, password, fullName = null, referralCode = null) {
    const payload = { email, password, full_name: fullName }
    if (referralCode) payload.referral_code = referralCode
    const response = await axios.post(`${API_BASE}/auth/register`, payload)
    return response.data
  },

  async login(email, password) {
    const response = await axios.post(`${API_BASE}/auth/login`, {
      email,
      password
    })
    return response.data
  },

  async getMe(token) {
    const client = createAuthClient(token)
    const response = await client.get('/auth/me')
    return response.data
  },

  async logout(token) {
    const client = createAuthClient(token)
    const response = await client.post('/auth/logout')
    return response.data
  },

  async forgotPassword(email) {
    const response = await axios.post(`${API_BASE}/auth/forgot-password`, { email })
    return response.data
  },

  async resetPassword(token, newPassword) {
    const response = await axios.post(`${API_BASE}/auth/reset-password`, {
      token,
      new_password: newPassword
    })
    return response.data
  },

  async googleLogin(credential, referralCode = null) {
    const payload = { credential }
    if (referralCode) payload.referral_code = referralCode
    const response = await axios.post(`${API_BASE}/auth/google`, payload)
    return response.data
  },

  async updateProfile(token, data) {
    const client = createAuthClient(token)
    const response = await client.put('/users/profile', data)
    return response.data
  },

  async changePassword(token, currentPassword, newPassword) {
    const client = createAuthClient(token)
    const response = await client.put('/users/password', {
      current_password: currentPassword,
      new_password: newPassword
    })
    return response.data
  },

  async deleteAccount(token) {
    const client = createAuthClient(token)
    const response = await client.delete('/users/account')
    return response.data
  },

  async uploadAvatar(token, file) {
    const formData = new FormData()
    formData.append('file', file)
    const response = await axios.post(`${API_BASE}/users/avatar`, formData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      }
    })
    return response.data
  },

  async getPreferences(token) {
    const client = createAuthClient(token)
    const response = await client.get('/users/preferences')
    return response.data
  },

  async updatePreferences(token, prefs) {
    const client = createAuthClient(token)
    const response = await client.put('/users/preferences', prefs)
    return response.data
  }
}

export default authApi
