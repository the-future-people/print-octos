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

  /**
 * Judges artwork against a size, and commits nothing.
 *
 * Comes back with a signed verdict that the commit will check against
 * the file and the size it was judged at — so a customer cannot pass a
 * good file and then send something else.
 */
export const checkArtwork = (file, serviceId, specifications, onProgress) => {
  const form = new FormData()
  form.append('file', file)
  form.append('service', serviceId)
  form.append('specifications', JSON.stringify(specifications))

  return axios.post(
    `${client.defaults.baseURL}/api/v1/storefront/check/`,
    form,
    {
      onUploadProgress: event => {
        if (!onProgress || !event.total) return
        onProgress(Math.round((event.loaded / event.total) * 100))
      },
    },
  )
}

/**
 * What a line would cost, without committing it.
 */
export const quoteLine = (serviceId, quantity, specifications) =>
  client.post('/api/v1/storefront/quote/', {
    service: serviceId,
    quantity,
    specifications,
  })

/**
 * Continue. The moment anything becomes real.
 *
 * The key makes a retry safe: a commit whose response is lost is a
 * normal event on mobile data, and pressing again must not buy the
 * banner twice.
 */
export const commitLine = ({
  key, orderNumber, token, serviceId, quantity, specifications, artworkToken,
}) =>
  client.post('/api/v1/storefront/commit/', {
    idempotency_key: key,
    ...(orderNumber ? { order: orderNumber, token } : {}),
    service: serviceId,
    quantity,
    specifications,
    ...(artworkToken ? { artwork_token: artworkToken } : {}),
  })

  /**
 * The way back in without the link. The order number and the phone
 * they gave — neither opens anything alone.
 */
export const findOrder = (orderNumber, phone) =>
  client.post('/api/v1/storefront/find/', { order: orderNumber, phone })

/**
 * The short code from a text message, traded for the real token.
 */
export const openShortLink = code =>
  client.get(`/api/v1/storefront/t/${code}/`)
/**
 * What to show somebody who has just paid, from the Paystack
 * reference alone. Needs nothing the browser has kept.
 */
export const confirmPayment = reference =>
  client.get(`/api/v1/storefront/confirm/${reference}/`)
  
export default client