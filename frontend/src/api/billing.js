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

export const billingApi = {
  async getPlans() {
    const response = await axios.get(`${API_BASE}/billing/plans`)
    return response.data.plans
  },

  async createCheckout(token, tier, billingPeriod = 'monthly') {
    const client = createAuthClient(token)
    const response = await client.post('/billing/checkout', {
      tier,
      billing_period: billingPeriod
    })
    return response.data
  },

  async getSubscription(token) {
    const client = createAuthClient(token)
    const response = await client.get('/billing/subscription')
    return response.data
  },

  async cancelSubscription(token) {
    const client = createAuthClient(token)
    const response = await client.post('/billing/cancel')
    return response.data
  },

  async createPortalSession(token) {
    const client = createAuthClient(token)
    const response = await client.post('/billing/portal')
    return response.data
  },

  // Usage and limits
  async getUsageLimits(token) {
    const client = createAuthClient(token)
    const response = await client.get('/billing/limits')
    return response.data
  },

  async checkFeature(token, feature) {
    const client = createAuthClient(token)
    const response = await client.get(`/billing/feature/${feature}`)
    return response.data
  },

  async checkVideoDuration(token, durationMinutes) {
    const client = createAuthClient(token)
    const response = await client.get('/billing/check-video-duration', {
      params: { duration_minutes: durationMinutes }
    })
    return response.data
  },

  async getProfileStats(token) {
    const client = createAuthClient(token)
    const response = await client.get('/profile/stats')
    return response.data
  },

  async getExportFormats(token) {
    const client = createAuthClient(token)
    const response = await client.get('/billing/export-formats')
    return response.data.formats
  },

  // Credits
  async getCredits(token) {
    const client = createAuthClient(token)
    const response = await client.get('/billing/credits')
    return response.data
  },

  async getCreditCosts(token) {
    const client = createAuthClient(token)
    const response = await client.get('/billing/credit-costs')
    return response.data
  },

  // Top-ups
  async getTopupPacks(token) {
    const client = createAuthClient(token)
    const response = await client.get('/billing/topup-packs')
    return response.data
  },

  async purchaseTopup(token, packId) {
    const client = createAuthClient(token)
    const response = await client.post('/billing/topup', { pack_id: packId })
    return response.data
  }
}

export default billingApi
