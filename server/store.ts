import { createHmac } from 'node:crypto'
import { isIP } from 'node:net'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createClient } from '@supabase/supabase-js'
import { verifyToken } from '@clerk/backend'

export type Env = Record<string, string | undefined>
type Result = { data: unknown; error: { code?: string; message?: string } | null }
type Dependencies = {
  env: () => Env
  rpc: (name: string, args: Record<string, unknown>, env: Env) => PromiseLike<Result>
  verify: (token: string, secret: string, origins: string[]) => Promise<{ sub: string; sid?: string }>
}
const MAX_BODY = 32768
const actions = new Set(['checkout', 'contact', 'newsletter', 'view'])
export class RequestError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}
export function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
export function header(req: IncomingMessage, key: string) {
  const value = req.headers[key]
  return typeof value === 'string' ? value : ''
}
export async function readBody(req: IncomingMessage & { body?: unknown }): Promise<unknown> {
  const length = header(req, 'content-length')
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BODY)) throw new RequestError(413, 'Submission is too large.')
  if (req.body !== undefined) {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    if (Buffer.byteLength(raw) > MAX_BODY) throw new RequestError(413, 'Submission is too large.')
    try { return JSON.parse(raw) } catch { throw new RequestError(400, 'Invalid JSON.') }
  }
  const raw = await new Promise<string>((resolve, reject) => {
    let size = 0
    let rejected = false
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY) {
        if (!rejected) { rejected = true; chunks.length = 0; reject(new RequestError(413, 'Submission is too large.')) }
      } else if (!rejected) chunks.push(chunk)
    })
    req.on('end', () => { if (!rejected) resolve(Buffer.concat(chunks).toString('utf8')) })
    req.on('error', () => reject(new RequestError(400, 'Incomplete submission.')))
  })
  try { return JSON.parse(raw) } catch { throw new RequestError(400, 'Invalid JSON.') }
}
const defaults: Dependencies = {
  env: () => process.env,
  rpc: (name, args, env) => createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) },
  }).rpc(name, args),
  verify: async (token, secretKey, authorizedParties) => {
    const claims = await verifyToken(token, { secretKey, authorizedParties })
    if (!claims.sid || !claims.sub.startsWith('user_')) throw new Error('Not a session token')
    return { sub: claims.sub, sid: claims.sid }
  },
}
export function allowedOrigins(env: Env) {
  const origins=['https://rugistan.vercel.app']
  if(env.VERCEL_URL)origins.push('https://'+env.VERCEL_URL)
  if(!env.VERCEL)for(const port of [5173,5174,5175])origins.push(`http://localhost:${port}`,`http://127.0.0.1:${port}`)
  return origins
}
export function createStoreHandler(deps: Dependencies = defaults) {
  return async (req: IncomingMessage & { body?: unknown }, res: ServerResponse) => {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Vary', 'Origin')
    const send = (status: number, value: unknown) => { res.statusCode = status; res.end(JSON.stringify(value)) }
    try {
      if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); throw new RequestError(405, 'Method not allowed.') }
      const env = deps.env()
      const origins = allowedOrigins(env)
      const origin = header(req, 'origin')
      if (!origin || !origins.includes(origin)) throw new RequestError(403, 'Origin not allowed.')
      if (header(req, 'sec-fetch-site') === 'cross-site') throw new RequestError(403, 'Cross-site submission denied.')
      if (!/^application\/json(?:\s*;|$)/i.test(header(req, 'content-type'))) throw new RequestError(415, 'Use application/json.')
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.RATE_LIMIT_SECRET || env.RATE_LIMIT_SECRET.length < 32) {
        throw new RequestError(503, 'Service temporarily unavailable.')
      }
      const body = await readBody(req)
      if (!object(body) || typeof body.action !== 'string' || !actions.has(body.action) || !object(body.payload)) throw new RequestError(400, 'Invalid submission.')
      // Only the Vercel-overwritten header is trusted in deployment. Local proxies cannot choose an IP.
      const ip = env.VERCEL ? header(req, 'x-vercel-forwarded-for') : req.socket.remoteAddress || ''
      if (!isIP(ip)) throw new RequestError(503, 'Service temporarily unavailable.')
      const key = createHmac('sha256', env.RATE_LIMIT_SECRET).update(ip).digest('hex')
      const quota = await deps.rpc('consume_store_quota', { p_action: body.action, p_key: key }, env)
      if (quota.error || !object(quota.data) || typeof quota.data.allowed !== 'boolean') throw new RequestError(503, 'Service temporarily unavailable.')
      if (!quota.data.allowed) {
        res.setHeader('Retry-After', String(Math.max(1, Number(quota.data.retry_after) || 60)))
        throw new RequestError(429, 'Too many submissions. Please try again later.')
      }
      let userId: string | null = null
      const authorization = header(req, 'authorization')
      if (authorization) {
        if (!env.CLERK_SECRET_KEY) throw new RequestError(503, 'Service temporarily unavailable.')
        if (!/^Bearer [^\s]+$/.test(authorization)) throw new RequestError(401, 'Please sign in again.')
        try { userId = (await deps.verify(authorization.slice(7), env.CLERK_SECRET_KEY, origins)).sub }
        catch { throw new RequestError(401, 'Please sign in again.') }
      }
      const result = await deps.rpc('store_write', { p_action: body.action, p_payload: body.payload, p_user_id: userId }, env)
      if (result.error) {
        // Only explicitly raised business-validation errors are safe to disclose.
        const message = result.error.code === 'P0001' ? result.error.message : 'Please check your submission and try again.'
        throw new RequestError(400, message || 'Invalid submission.')
      }
      send(200, { data: result.data })
    } catch (error) {
      if (error instanceof RequestError) send(error.status, { error: error.message })
      else { console.error('store_api_request_failed'); send(503, { error: 'Service temporarily unavailable.' }) }
    }
  }
}
export default createStoreHandler()
