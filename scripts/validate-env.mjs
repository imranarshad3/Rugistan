import { loadEnv } from 'vite'
const env = { ...loadEnv('production', process.cwd(), ''), ...process.env }
const problems = []
for (const name of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_CLERK_PUBLISHABLE_KEY']) {
  if (!env[name] && !(name === 'VITE_SUPABASE_PUBLISHABLE_KEY' && env.VITE_SUPABASE_ANON_KEY))
    problems.push(`${name} is missing`)
}
for (const [name, value] of Object.entries(env)) {
  if (!name.startsWith('VITE_') || !value) continue
  if (/SECRET|SERVICE_ROLE|PRIVATE|PASSWORD/i.test(name) || /^(sk_|sb_secret_)/.test(value))
    problems.push(`${name} must not contain a server credential`)
  if (value.split('.').length === 3) {
    try {
      if (JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString()).role === 'service_role')
        problems.push(`${name} contains a privileged JWT`)
    } catch {
      /* Non-JWT public values. */
    }
  }
}
try {
  if (
    new URL(env.VITE_SUPABASE_URL).protocol !== 'https:' &&
    !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(env.VITE_SUPABASE_URL)
  )
    problems.push('Supabase URL must use HTTPS outside localhost')
} catch {
  problems.push('Supabase URL is invalid')
}
if (process.argv.includes('--production') && !env.VITE_CLERK_PUBLISHABLE_KEY?.startsWith('pk_live_'))
  problems.push('A live Clerk publishable key is required for production release')
if (problems.length) {
  console.error(problems.join('\n'))
  process.exitCode = 1
} else console.log('Public build environment validated; no credentials printed.')
