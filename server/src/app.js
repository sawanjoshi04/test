import express from 'express'
import cors from 'cors'
import { MulterError } from 'multer'
import authRoutes from './routes/auth.js'
import documentRoutes from './routes/documents.js'
import importRoutes from './routes/import.js'
import userRoutes from './routes/users.js'

export default function createApp() {
  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '2mb' }))

  app.use((req, res, next) => {
    const started = Date.now()
    res.on('finish', () => {
      const ms = Date.now() - started
      const tag = res.statusCode >= 400 ? '✖' : '✔'
      console.log(`[API] ${tag} ${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`)
    })
    next()
  })

  app.get('/api/health', (_req, res) => res.json({ ok: true }))
  app.use('/api/auth', authRoutes)
  app.use('/api/users', userRoutes)
  app.use('/api/documents', documentRoutes)
  app.use('/api/import', importRoutes)

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }))

  app.use((err, _req, res, _next) => {
    if (err instanceof MulterError) {
      return res.status(400).json({ error: 'Upload failed. Max file size is 2MB.' })
    }
    console.error(err)
    res.status(500).json({ error: 'Unexpected server error.' })
  })

  return app
}