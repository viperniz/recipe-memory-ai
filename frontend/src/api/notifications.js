import axios from 'axios'

import { API_BASE } from '../lib/apiBase'

const createAuthClient = (token) => {
  return axios.create({
    baseURL: API_BASE,
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
}

export const notificationsApi = {
  async list(token, limit = 30, offset = 0) {
    const client = createAuthClient(token)
    const response = await client.get('/notifications', { params: { limit, offset } })
    return response.data
  },

  async getUnreadCount(token) {
    const client = createAuthClient(token)
    const response = await client.get('/notifications/unread-count')
    return response.data
  },

  async markRead(token, notificationId) {
    const client = createAuthClient(token)
    const response = await client.put(`/notifications/${notificationId}/read`)
    return response.data
  },

  async markAllRead(token) {
    const client = createAuthClient(token)
    const response = await client.put('/notifications/read-all')
    return response.data
  },
}

export default notificationsApi
