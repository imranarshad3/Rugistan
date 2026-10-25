import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests',
  testMatch: 'browser.spec.ts',
  fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:5175', headless: true, trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5175 --strictPort',
    url: 'http://127.0.0.1:5175',
    reuseExistingServer: false,
  },
})
