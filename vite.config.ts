import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import {createTeamHandler} from './server/team.ts'
import { productAi } from './server/admin-ai.ts'
import { createStoreHandler } from './server/store.ts'

export default defineConfig(({ mode }) => ({
  plugins: [react(), {
    name: 'store-api-development',
    configureServer(server) {
      const env = { ...process.env, ...loadEnv(mode, process.cwd(), '') }
      const handler = createStoreHandler({
        // Secrets stay in the Node process; nothing is assigned to Vite's define/client config.
        env: () => env,
        rpc: async (name, args, config) => {
          const { createClient } = await import('@supabase/supabase-js')
          return createClient(config.SUPABASE_URL!, config.SUPABASE_SERVICE_ROLE_KEY!, {
            auth: { persistSession: false, autoRefreshToken: false },
          }).rpc(name, args)
        },
        verify: async (token, secretKey, authorizedParties) => {
          const { verifyToken } = await import('@clerk/backend')
          const claims = await verifyToken(token, { secretKey, authorizedParties })
          if (!claims.sid || !claims.sub.startsWith('user_')) throw new Error('Not a session token')
          return { sub: claims.sub, sid: claims.sid }
        },
      })
      const teamHandler = createTeamHandler({env:()=>env})
      server.middlewares.use('/api/team',(req,res)=>{void teamHandler(req,res)})
      server.middlewares.use('/api/admin-product-ai', (req, res) => { void productAi(req, res, env) })
      server.middlewares.use('/api/store', (req, res) => { void handler(req, res) })
    },
  }],
}))
