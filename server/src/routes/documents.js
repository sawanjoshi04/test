import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth } from '../middleware.js'
import { publicUser } from './auth.js'

const router = Router()

async function findDocumentFor(documentId) {
  return prisma.document.findUnique({
    where: { id: documentId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      access: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  })
}

function roleFor(doc, userId) {
  if (doc.ownerId === userId) return 'owner'
  return doc.access.find((a) => a.userId === userId)?.role ?? null
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const owned = await prisma.document.findMany({
      where: { ownerId: req.user.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, updatedAt: true },
    })

    const sharedRows = await prisma.documentAccess.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            updatedAt: true,
            owner: { select: { id: true, name: true, email: true } },
          },
        },
      },
    })
    const shared = sharedRows.map((row) => ({
      id: row.document.id,
      title: row.document.title,
      updatedAt: row.document.updatedAt,
      owner: row.document.owner,
    }))

    res.json({ owned, shared })
  } catch (err) {
    next(err)
  }
})

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const title = req.body?.title
    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Title is required and cannot be empty.' })
    }
    const doc = await prisma.document.create({
      data: { title: title.trim(), ownerId: req.user.id },
      select: { id: true, title: true, updatedAt: true },
    })
    res.status(201).json({ document: doc })
  } catch (err) {
    next(err)
  }
})

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const doc = await findDocumentFor(req.params.id)
    if (!doc) return res.status(404).json({ error: 'Document not found.' })

    const role = roleFor(doc, req.user.id)
    if (!role) return res.status(404).json({ error: 'Document not found.' })

    res.json({
      id: doc.id,
      title: doc.title,
      content: doc.content,
      role,
      owner: doc.owner,
      shares: doc.access
        .filter((a) => a.userId !== req.user.id)
        .map((a) => ({ role: a.role, user: publicUser(a.user) })),
    })
  } catch (err) {
    next(err)
  }
})

router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const doc = await findDocumentFor(req.params.id)
    if (!doc) return res.status(404).json({ error: 'Document not found.' })

    const role = roleFor(doc, req.user.id)
    if (!role) return res.status(403).json({ error: 'You do not have access to this document.' })

    const data = {}
    if (req.body?.title !== undefined) {
      if (typeof req.body.title !== 'string' || !req.body.title.trim()) {
        return res.status(400).json({ error: 'Title cannot be empty.' })
      }
      if (role !== 'owner') {
        return res.status(403).json({ error: 'Only the owner can rename this document.' })
      }
      data.title = req.body.title.trim()
    }
    if (req.body?.content !== undefined) {
      if (typeof req.body.content !== 'string') {
        return res.status(400).json({ error: 'Content must be a string.' })
      }
      data.content = req.body.content
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Nothing to update.' })
    }

    const updated = await prisma.document.update({
      where: { id: doc.id },
      data,
      select: { id: true, title: true, updatedAt: true },
    })
    res.json({ document: updated })
  } catch (err) {
    next(err)
  }
})

router.post('/:id/share', requireAuth, async (req, res, next) => {
  try {
    const doc = await findDocumentFor(req.params.id)
    if (!doc) return res.status(404).json({ error: 'Document not found.' })
    if (doc.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Only the owner can share this document.' })
    }

    const email = req.body?.email
    if (typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'Email is required.' })
    }
    let target = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    })
    let createdNewUser = false
    if (!target) {
      const local = email.trim().toLowerCase().split('@')[0]
      const name = local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      target = await prisma.user.create({ data: { email: email.trim().toLowerCase(), name } })
      createdNewUser = true
    }
    if (target.id === req.user.id) {
      return res.status(400).json({ error: 'This document already belongs to you.' })
    }

    const existing = await prisma.documentAccess.findUnique({
      where: { documentId_userId: { documentId: doc.id, userId: target.id } },
    })

    const access =
      existing ??
      (await prisma.documentAccess.create({
        data: { documentId: doc.id, userId: target.id, role: 'editor' },
      }))

    res.status(201).json({
      sharedWith: publicUser(target),
      alreadyShared: Boolean(existing),
      createdNewUser,
    })
  } catch (err) {
    next(err)
  }
})

function inlineToMd(nodes) {
  if (!nodes) return ''
  if (Array.isArray(nodes)) return nodes.map(inlineToMd).join('')
  if (nodes.type === 'text') {
    let t = nodes.text || ''
    for (const m of nodes.marks || []) {
      if (m.type === 'bold') t = `**${t}**`
      else if (m.type === 'italic') t = `*${t}*`
      else if (m.type === 'code') t = `\`${t}\``
      else if (m.type === 'strike') t = `~~${t}~~`
      else if (m.type === 'underline') t = `<u>${t}</u>`
    }
    return t
  }
  return inlineToMd(nodes.content)
}

function blocksToMd(node, depth) {
  const pad = '  '.repeat(depth || 0)
  if (!node || typeof node !== 'object') return []
  switch (node.type) {
    case 'heading':
      return [`${'#'.repeat(node.attrs?.level || 1)} ${inlineToMd(node.content)}`]
    case 'paragraph':
      return [inlineToMd(node.content)]
    case 'blockquote': {
      const lines = (node.content || []).flatMap((c) => blocksToMd(c, depth))
      return lines.map((l) => `> ${l}`)
    }
    case 'codeBlock':
      return ['```', node.content?.map(inlineToMd).join('') || '', '```']
    case 'horizontalRule':
      return ['---']
    case 'bulletList':
      return (node.content || []).flatMap((li) => {
        const inner = blocksFromListItem(li, depth + 1)
        return inner.map((l, i) => (i === 0 ? `${pad}- ${l}` : `${pad}  ${l}`))
      })
    case 'orderedList':
      return (node.content || []).flatMap((li, idx) => {
        const inner = blocksFromListItem(li, depth + 1)
        return inner.map((l, i) => (i === 0 ? `${pad}${idx + 1}. ${l}` : `${pad}   ${l}`))
      })
    case 'listItem':
      return (node.content || []).flatMap((c) => blocksToMd(c, depth))
    default:
      return (node.content || []).flatMap((c) => blocksToMd(c, depth))
  }
}

function blocksFromListItem(li, depth) {
  const parts = (li.content || []).flatMap((c) => blocksToMd(c, depth))
  return parts.length ? parts : ['']
}

function docToMarkdown(json) {
  return (json.content || []).flatMap((n) => blocksToMd(n, 0)).join('\n\n')
}

function htmlToMarkdown(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li>/gi, '- ')
    .replace(/<\/(p|h1|h2|h3|h4|li|blockquote)>/gi, '\n')
    .replace(/<(strong|b)>(.*?)<\/\1>/gi, '**$2**')
    .replace(/<(em|i)>(.*?)<\/\1>/gi, '*$2*')
    .replace(/<h1>(.*?)<\/h1>/gi, '# $1\n')
    .replace(/<h2>(.*?)<\/h2>/gi, '## $1\n')
    .replace(/<h3>(.*?)<\/h3>/gi, '### $1\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

router.get('/:id/export', requireAuth, async (req, res, next) => {
  try {
    const doc = await findDocumentFor(req.params.id)
    if (!doc) return res.status(404).json({ error: 'Document not found.' })
    const role = roleFor(doc, req.user.id)
    if (!role) return res.status(404).json({ error: 'Document not found.' })

    let markdown = ''
    const raw = doc.content || ''
    if (raw.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(raw)
        markdown = parsed?.type === 'doc' ? docToMarkdown(parsed) : raw
      } catch {
        markdown = raw
      }
    } else {
      markdown = htmlToMarkdown(raw)
    }

    res.json({ title: doc.title, markdown: `${markdown.trim()}\n` })
  } catch (err) {
    next(err)
  }
})

export default router