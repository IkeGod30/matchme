import react from '@vitejs/plugin-react'
import type { ProxyOptions } from 'vite'
import { defineConfig } from 'vite'

// The API server (npm run dev:api) runs on port 3001 (or API_PORT). `npm run dev` starts both.
const api: ProxyOptions = {
  target: `http://localhost:${process.env.API_PORT ?? 3001}`,
  configure(proxy) {
    // When the API isn't running, answer with a clear JSON error instead of a bare 502.
    proxy.on('error', (_error, _req, res) => {
      if (!('writeHead' in res) || res.headersSent) return
      res.writeHead(503, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          error:
            'The MatchMe API server isn’t running, so nothing was saved. In your terminal, stop the dev server (Ctrl+C) and start everything with `npm run dev`, then try again.',
        }),
      )
    })
  },
}

// MatchMe always uses port 5175 (other local projects use 5173/5174). strictPort makes Vite
// stop with an error instead of silently moving to another port, which made it easy to
// open the wrong app. Override with WEB_PORT if needed (also set APP_URL for email links).
const WEB_PORT = Number(process.env.WEB_PORT ?? 5175)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { port: WEB_PORT, strictPort: true, open: !process.env.CI && !process.env.WEB_PORT, proxy: { '/api': api } },
  preview: { proxy: { '/api': api } },
})
