import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import createApp from './app.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, '../../client/dist')

const app = createApp()

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
  console.log(`Serving client build from ${distDir}`)
} else {
  console.log(
    `\n[setup] No ${distDir} build found.\n[setup] Run:\n[setup]   cd client\n[setup]   npm install\n[setup]   npm run build\n[setup] Restart the server after the build finishes.\n`
  )
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.status(503).send(`
      <h2>Docs Collab — client build missing</h2>
      <p>Run <code>cd client && npm install && npm run build</code> in the repo root,
      then restart this server.</p>
    `)
  })
}

const port = Number(process.env.PORT || 4000)
app.listen(port, () => {
  console.log(`Docs Collab API listening on http://localhost:${port}`)
})