import { getStoreAccessToken } from './supabase'

/** Public writes go through the server; browser credentials never gain privileged write access. */
export async function storeWrite(action: 'checkout' | 'contact' | 'newsletter' | 'view', payload: unknown) {
  try {
    const token = await getStoreAccessToken()
    const response = await fetch('/api/store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ action, payload }),
      signal: AbortSignal.timeout(20000),
    })
    const result = await response.json() as { data?: unknown; error?: string }
    if (!response.ok || result.error) return { data: null, error: { message: result.error || 'Please try again later.' } }
    return { data: result.data, error: null }
  } catch {
    return { data: null, error: { message: 'Cannot reach the server. Please try again.' } }
  }
}
