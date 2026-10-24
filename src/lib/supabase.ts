import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !publishableKey) {
  throw new Error(
    'Supabase is not configured. Copy .env.example to .env.local and fill in ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.',
  )
}

let tokenProvider: (() => Promise<string | null>) | null = null
export function setSupabaseTokenProvider(provider: (() => Promise<string | null>) | null) {
  tokenProvider = provider
}

export async function getStoreAccessToken() { return tokenProvider ? tokenProvider() : null }

export const supabase = createClient<Database>(url, publishableKey, {
  accessToken: async () => tokenProvider ? tokenProvider() : null,
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

/** Turns a Postgres/PostgREST error into something a shopper can read. */
export function readableError(error: unknown, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback
  const message = typeof error === 'string' ? error : (error as { message?: string }).message
  if (!message) return fallback
  if (/duplicate key|already exists/i.test(message)) return 'That value is already in use.'
  if (/violates row-level security/i.test(message)) return 'You do not have permission to do that.'
  if (/JWT|not authenticated/i.test(message)) return 'Please sign in and try again.'
  if (/Failed to fetch|NetworkError/i.test(message)) return 'Cannot reach the server. Check your connection.'
  return message
}
