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

export default client