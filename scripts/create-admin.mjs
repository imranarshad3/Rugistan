#!/usr/bin/env node
/** Promotes an existing verified Clerk identity. Never creates users or resets passwords. */
import { existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
for (const file of ['.env.local', '.env']) if (existsSync(file)) process.loadEnvFile(file)
const [email, clerkId] = process.argv.slice(2)
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const clerkKey = process.env.CLERK_SECRET_KEY
if (!email || !/^user_[A-Za-z0-9]+$/.test(clerkId || ''))
  throw new Error('Usage: node scripts/create-admin.mjs <email> <existing-clerk-user-id>')
if (!url || !key || !clerkKey)
  throw new Error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and CLERK_SECRET_KEY are required.')
const response = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(clerkId)}`, {
  headers: { Authorization: `Bearer ${clerkKey}` },
  signal: AbortSignal.timeout(15000),
})
if (!response.ok)
  throw new Error('Could not verify the Clerk identity. Check the server credential and user ID.')
const identity = await response.json()
const verified = identity.email_addresses?.some(
  (address) =>
    address.email_address.toLowerCase() === email.trim().toLowerCase() &&
    address.verification?.status === 'verified',
)
if (!verified) throw new Error('That email is not verified on this Clerk identity.')
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
const { data: existing, error: lookupError } = await admin
  .from('profiles')
  .select('id')
  .eq('id', clerkId)
  .maybeSingle()
if (lookupError) throw new Error('Could not read the store profile.')
const payload = { email: email.trim().toLowerCase(), role: 'admin' }
const { error } = existing
  ? await admin.from('profiles').update(payload).eq('id', clerkId)
  : await admin
      .from('profiles')
      .insert({
        id: clerkId,
        ...payload,
        first_name: identity.first_name || '',
        last_name: identity.last_name || '',
      })
if (error)
  throw new Error('Could not grant the store administrator role. Check the schema and server credential.')
console.log('Verified Clerk identity promoted. Sign in at /admin/login and refresh access.')
