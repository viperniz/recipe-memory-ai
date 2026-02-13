import axios from 'axios'

const API_BASE = '/api'

// Create axios instance with auth header
const createAuthClient = (token) => {
  return axios.create({
    baseURL: API_BASE,
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
}

export const notesApi = {
  // Notes
  async createNote(token, contentId, noteText, timestampSeconds = null) {
    const client = createAuthClient(token)
    const response = await client.post('/notes', {
      content_id: contentId,
      note_text: noteText,
      timestamp_seconds: timestampSeconds
    })
    return response.data
  },

  async getNotes(token, contentId = null) {
    const client = createAuthClient(token)
    const params = contentId ? { content_id: contentId } : {}
    const response = await client.get('/notes', { params })
    return response.data
  },

  async updateNote(token, noteId, noteText, timestampSeconds = null) {
    const client = createAuthClient(token)
    const data = {}
    if (noteText !== null) data.note_text = noteText
    if (timestampSeconds !== null) data.timestamp_seconds = timestampSeconds
    const response = await client.put(`/notes/${noteId}`, data)
    return response.data
  },

  async deleteNote(token, noteId) {
    const client = createAuthClient(token)
    const response = await client.delete(`/notes/${noteId}`)
    return response.data
  },

  // Bookmarks
  async createBookmark(token, contentId, timestampSeconds, label = null) {
    const client = createAuthClient(token)
    const response = await client.post('/bookmarks', {
      content_id: contentId,
      timestamp_seconds: timestampSeconds,
      label
    })
    return response.data
  },

  async getBookmarks(token, contentId = null) {
    const client = createAuthClient(token)
    const params = contentId ? { content_id: contentId } : {}
    const response = await client.get('/bookmarks', { params })
    return response.data
  },

  async deleteBookmark(token, bookmarkId) {
    const client = createAuthClient(token)
    const response = await client.delete(`/bookmarks/${bookmarkId}`)
    return response.data
  },

  // Get all annotations for content
  async getContentAnnotations(token, contentId) {
    const client = createAuthClient(token)
    const response = await client.get(`/content/${contentId}/annotations`)
    return response.data
  }
}

export default notesApi
