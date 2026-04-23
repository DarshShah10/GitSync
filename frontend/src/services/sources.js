import api from './api.js'

export const sourcesApi = {
  list: () =>
    api.get('/api/sources').then(r => r.data),

  get: (id) =>
    api.get(`/api/sources/${id}`).then(r => r.data),

  create: (body) =>
    api.post('/api/sources', body).then(r => r.data),

  initiateAutomated: (body) =>
    api.post('/api/sources/github/initiate', body).then(r => r.data),

  update: ({ id, ...body }) =>
    api.patch(`/api/sources/${id}`, body).then(r => r.data),

  remove: (id) =>
    api.delete(`/api/sources/${id}`).then(r => r.data),
}
