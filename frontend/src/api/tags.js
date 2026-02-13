import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

// Create axios instance with auth header
const createAuthClient = (token) => {
  return axios.create({
    baseURL: API_BASE,
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
}

export const tagsApi = {
  // Tag CRUD
  async createTag(token, name, color = '#3B82F6') {
    const client = createAuthClient(token)
    const response = await client.post('/tags', { name, color })
    return response.data
  },

  async getTags(token) {
    const client = createAuthClient(token)
    const response = await client.get('/tags')
    return response.data
  },

  async updateTag(token, tagId, name = null, color = null) {
    const client = createAuthClient(token)
    const data = {}
    if (name !== null) data.name = name
    if (color !== null) data.color = color
    const response = await client.put(`/tags/${tagId}`, data)
    return response.data
  },

  async deleteTag(token, tagId) {
    const client = createAuthClient(token)
    const response = await client.delete(`/tags/${tagId}`)
    return response.data
  },

  // Content tagging
  async addTagsToContent(token, contentId, tagIds) {
    const client = createAuthClient(token)
    const response = await client.post(`/content/${contentId}/tags`, {
      tag_ids: tagIds
    })
    return response.data
  },

  async removeTagFromContent(token, contentId, tagId) {
    const client = createAuthClient(token)
    const response = await client.delete(`/content/${contentId}/tags/${tagId}`)
    return response.data
  },

  async getContentTags(token, contentId) {
    const client = createAuthClient(token)
    const response = await client.get(`/content/${contentId}/tags`)
    return response.data
  },

  // Search
  async search(token, query = null, tagIds = null, contentType = null, hasNotes = null, nResults = 20) {
    const client = createAuthClient(token)
    const response = await client.post('/search', {
      query,
      tag_ids: tagIds,
      content_type: contentType,
      has_notes: hasNotes,
      n_results: nResults
    })
    return response.data
  },

  async getSearchStats(token) {
    const client = createAuthClient(token)
    const response = await client.get('/search/stats')
    return response.data
  }
}

export default tagsApi
