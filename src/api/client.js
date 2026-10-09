import axios from 'axios'

// No auth header, ever. The storefront is unauthenticated by design:
// what stands in for a login is the token on each order, passed with
// the requests that need it.
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
})

export const getCatalogue = () =>
  client.get('/api/v1/storefront/catalogue/')

export const createOrder = () =>
  client.post('/api/v1/storefront/orders/', {})

export const getOrder = (orderNumber, token) =>
  client.get(`/api/v1/storefront/orders/${orderNumber}/`, { params: { token } })

export const updateOrder = (orderNumber, token, changes) =>
  client.patch(`/api/v1/storefront/orders/${orderNumber}/`, { token, ...changes })

export const identify = (orderNumber, token, details) =>
  client.post(`/api/v1/storefront/orders/${orderNumber}/identify/`, { token, ...details })

export const setCode = (orderNumber, token) =>
  client.post(`/api/v1/storefront/orders/${orderNumber}/code/`, { token })

export const startPayment = (orderNumber, token, callbackUrl) =>
  client.post(`/api/v1/storefront/orders/${orderNumber}/pay/`, {
    token,
    callback_url: callbackUrl,
  })

export const uploadFile = (orderNumber, token, file, lineId, onProgress) => {
  const form = new FormData()
  form.append('token', token)
  form.append('file', file)
  // Which item this artwork is for. An order can hold a banner, flyers
  // and programmes at once, and the banner's file is not the flyer's.
  if (lineId) form.append('line_id', lineId)
  // A bare axios call rather than the shared client. That one sets a
  // JSON content type on every request, and a multipart body sent as
  // JSON arrives at the server with no fields in it — no token, so the
  // order is not found, and the error says nothing about the cause.
  return axios.post(
    `${client.defaults.baseURL}/api/v1/storefront/orders/${orderNumber}/file/`,
    form,
    {
      // Real progress, not a guess. On a slow connection most of the
      // wait is the bytes leaving the phone, and that is worth showing
      // rather than pretending.
      onUploadProgress: event => {
        if (!onProgress || !event.total) return
        onProgress(Math.round((event.loaded / event.total) * 100))
      },
    },
  )
}

export const getFile = (orderNumber, token, lineId) =>
  client.get(`/api/v1/storefront/orders/${orderNumber}/file/`, {
    params: { token, ...(lineId ? { line_id: lineId } : {}) },
  })

export const acceptWarning = (orderNumber, token, lineId) =>
  client.patch(`/api/v1/storefront/orders/${orderNumber}/file/`, {
    token,
    line_id: lineId,
    warning_accepted: true,
  })

export const getBranchOptions = (orderNumber, token, location) =>
  client.get(`/api/v1/storefront/orders/${orderNumber}/branches/`, {
    params: {
      token,
      ...(location ? {
        latitude: location.latitude,
        longitude: location.longitude,
      } : {}),
    },
  })

export default client