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

export const reportsApi = {
  async generateReport(token, config) {
    const client = createAuthClient(token)
    const response = await client.post('/reports/generate', config)
    return response.data
  },

  async listReports(token, params = {}) {
    const client = createAuthClient(token)
    const response = await client.get('/reports', { params })
    return response.data
  },

  async getReport(token, reportId) {
    const client = createAuthClient(token)
    const response = await client.get(`/reports/${reportId}`)
    return response.data
  },

  async deleteReport(token, reportId) {
    const client = createAuthClient(token)
    const response = await client.delete(`/reports/${reportId}`)
    return response.data
  }
}
