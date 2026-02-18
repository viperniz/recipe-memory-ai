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

export const teamApi = {
  // Teams
  async createTeam(token, name, description = null) {
    const client = createAuthClient(token)
    const response = await client.post('/teams', { name, description })
    return response.data
  },

  async getTeams(token) {
    const client = createAuthClient(token)
    const response = await client.get('/teams')
    return response.data
  },

  async getTeam(token, teamId) {
    const client = createAuthClient(token)
    const response = await client.get(`/teams/${teamId}`)
    return response.data
  },

  async updateTeam(token, teamId, name = null, description = null) {
    const client = createAuthClient(token)
    const data = {}
    if (name !== null) data.name = name
    if (description !== null) data.description = description
    const response = await client.put(`/teams/${teamId}`, data)
    return response.data
  },

  async deleteTeam(token, teamId) {
    const client = createAuthClient(token)
    const response = await client.delete(`/teams/${teamId}`)
    return response.data
  },

  // Members
  async getMembers(token, teamId) {
    const client = createAuthClient(token)
    const response = await client.get(`/teams/${teamId}/members`)
    return response.data
  },

  async updateMemberRole(token, teamId, userId, role) {
    const client = createAuthClient(token)
    const response = await client.put(`/teams/${teamId}/members/${userId}`, { role })
    return response.data
  },

  async removeMember(token, teamId, userId) {
    const client = createAuthClient(token)
    const response = await client.delete(`/teams/${teamId}/members/${userId}`)
    return response.data
  },

  // Invitations
  async inviteMember(token, teamId, email, role = 'member') {
    const client = createAuthClient(token)
    const response = await client.post(`/teams/${teamId}/invite`, { email, role })
    return response.data
  },

  async getInvitations(token) {
    const client = createAuthClient(token)
    const response = await client.get('/invitations')
    return response.data
  },

  async acceptInvitation(token, inviteToken) {
    const client = createAuthClient(token)
    const response = await client.post(`/invitations/${inviteToken}/accept`)
    return response.data
  },

  async declineInvitation(token, inviteToken) {
    const client = createAuthClient(token)
    const response = await client.post(`/invitations/${inviteToken}/decline`)
    return response.data
  },

  // Shared Content
  async shareContent(token, teamId, contentId) {
    const client = createAuthClient(token)
    const response = await client.post(`/teams/${teamId}/content`, { content_id: contentId })
    return response.data
  },

  async unshareContent(token, teamId, contentId) {
    const client = createAuthClient(token)
    const response = await client.delete(`/teams/${teamId}/content/${contentId}`)
    return response.data
  },

  async getTeamContent(token, teamId) {
    const client = createAuthClient(token)
    const response = await client.get(`/teams/${teamId}/content`)
    return response.data
  }
}

export default teamApi
