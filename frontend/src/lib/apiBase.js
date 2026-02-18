// Shared API base URL — avoids circular dependency TDZ issues when each module defines its own const
export const API_BASE = import.meta.env.VITE_API_URL || '/api'
