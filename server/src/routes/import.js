import { Router } from 'express'
import multer from 'multer'
import { marked } from 'marked'
import { requireAuth } from '../middleware.js'
import { prisma } from '../db.js'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
})

const SUPPORTED = ['.txt', '.md', '.markdown']

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function txtToHtml(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  return lines
    .map((line) => (line.trim() ? `<p>${escapeHtml(line)}</p>` : ''))
    .filter(Boolean)
    .join('\n')
}

router.post('/', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file was uploaded. Pick a .txt or .md file.' })
    }

    const original = req.file.originalname || ''
    const lower = original.toLowerCase()
    const ext = lower.slice(lower.lastIndexOf('.'))
    if (!SUPPORTED.includes(ext)) {
      return res.status(400).json({ error: 'Unsupported file type. Please upload a .txt or .md file.' })
    }

    const text = new TextDecoder().decode(req.file.buffer)
    const html =
      ext === '.md' || ext === '.markdown'
        ? String(await marked.parse(text))
        : txtToHtml(text)

    const title = (original.replace(/\.[^.]*$/, '') || 'Imported document').trim()

    const doc = await prisma.document.create({
      data: { title, content: html, ownerId: req.user.id },
      select: { id: true, title: true, updatedAt: true },
    })

    res.status(201).json({ document: { ...doc, content: html } })
  } catch (err) {
    next(err)
  }
})

export default router