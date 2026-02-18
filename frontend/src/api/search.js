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

export const searchApi = {
  async search(token, { query = null, tag_ids = null, content_type = null, has_notes = null, n_results = 20 } = {}) {
    const client = createAuthClient(token)
    const response = await client.post('/search', {
      query,
      tag_ids,
      content_type,
      has_notes,
      n_results
    })
    return response.data
  },

  async getStats(token) {
    const client = createAuthClient(token)
    const response = await client.get('/search/stats')
    return response.data
  }
}

export default searchApi
