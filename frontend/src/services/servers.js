import api from './api.js'

export const getServers = () => api.get('/api/servers').then(r => r.data)

export const serversApi = {
  list:           ()         => api.get('/api/servers').then(r => r.data.data),
  get:            (id)       => api.get(`/api/servers/${id}`).then(r => r.data.data),
  getStatus:      (id)       => api.get(`/api/servers/${id}/status`).then(r => r.data.data),
  create:         (payload)  => api.post('/api/servers', payload).then(r => r.data),
  update:         (id, data) => api.patch(`/api/servers/${id}`, data).then(r => r.data.data),
  remove:         (id)       => api.delete(`/api/servers/${id}`).then(r => r.data),
  reverify:       (id)       => api.post(`/api/servers/${id}/verify`).then(r => r.data),
  testConnection: (id)       => api.post(`/api/servers/${id}/test-connection`).then(r => r.data.data),
}