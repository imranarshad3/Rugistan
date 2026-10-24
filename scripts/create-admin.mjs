#!/usr/bin/env node
/**
 * Creates (or promotes) a Rugistan admin account.
 *
 *   node scripts/create-admin.mjs <email> <password> [first] [last]
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment
 * (.env.local is read automatically). The service role key must never be
 * shipped to the browser.
 */
import { readFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

for (const file of ['.env.local', '.env']) {
  if (!existsSync(file)) continue
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const [email, password, first = 'Store', last = 'Administrator'] = process.argv.slice(2)

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}
if (!email || !password) {
  console.error('Usage: node scripts/create-admin.mjs <email> <password> [first] [last]')
  process.exit(1)
}
if (password.length < 8) {
  console.error('Choose a password of at least 8 characters.')
  process.exit(1)
}

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const { data: created, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { first_name: first, last_name: last },
})

let userId = created?.user?.id
if (error) {
  if (!/already/i.test(error.message)) {
    console.error('Could not create the user:', error.message)
    process.exit(1)
  }
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
  userId = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id
  if (!userId) {
    console.error('That email already exists but could not be located.')
    process.exit(1)
  }
  await admin.auth.admin.updateUserById(userId, { password })
  console.log('Existing account found — password updated.')
}

const { error: roleError } = await admin
  .from('profiles')
  .upsert({ id: userId, email, first_name: first, last_name: last, role: 'admin' })

if (roleError) {
  console.error('Could not grant the admin role:', roleError.message)
  process.exit(1)
}

console.log(`\n  Admin ready: ${email}\n  Sign in at /admin/login\n`)
