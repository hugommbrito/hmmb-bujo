import axios from 'axios'

// Instância base. JWT interceptor single-flight será adicionado na Story 2.2.
const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '',
  headers: { 'Content-Type': 'application/json' },
})

export default client
