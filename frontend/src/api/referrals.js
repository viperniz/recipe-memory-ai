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

export const referralsApi = {
  async getStats(token) {
    const client = createAuthClient(token)
    const response = await client.get('/referrals/stats')
    return response.data
  }
}

export default referralsApi
