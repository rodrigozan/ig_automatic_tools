import { api } from './api'

// Populated from the API before mounting React; APP_NAME stays on the server.
export let APP_NAME = ''

export async function loadAppConfig() {
  const { data } = await api.get<{ appName: string }>('/config')
  if (typeof data.appName !== 'string' || !data.appName.trim()) {
    throw new Error('Nome do aplicativo não configurado.')
  }
  APP_NAME = data.appName
  document.title = APP_NAME
}
