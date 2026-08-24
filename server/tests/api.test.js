import { describe, it, expect, afterAll } from 'vitest'
import request from 'supertest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import createApp from '../src/app.js'
import { prisma } from '../src/db.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const app = createApp()

const SEED_USERS = [
  { email: 'sawan@ajaia.local', name: 'Sawan Marre' },
  { email: 'reviewer@ajaia.local', name: 'As reviewer' },
  { email: 'teammate@ajaia.local', name: 'Marco Merkel' },
]

async function seedUsers() {
  for (const u of SEED_USERS) {
    await prisma.user.upsert({ where: { email: u.email }, update: {}, create: u })
  }
}

async function login(email) {
  const res = await request(app).post('/api/auth/login').send({ email })
  return res.body.token
}

describe('auth', () => {
  it('logs in a seeded user and returns the current identity', async () => {
    await seedUsers()
    const token = await login('sawan@ajaia.local')
    expect(token).toBeTruthy()

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)
    expect(me.status).toBe(200)
    expect(me.body.user.email).toBe('sawan@ajaia.local')
  })

  it('rejects unknown emails and missing tokens', async () => {
    const bad = await request(app).post('/api/auth/login').send({ email: 'nobody@ajaia.local' })
    expect(bad.status).toBe(401)

    const noToken = await request(app).get('/api/documents')
    expect(noToken.status).toBe(401)
  })
})

describe('document lifecycle and persistence', () => {
  it('creates, renames, edits and reopens a document with content intact', async () => {
    const token = await login('sawan@ajaia.local')
    const auth = { Authorization: `Bearer ${token}` }

    const created = await request(app).post('/api/documents').set(auth).send({ title: 'Trip plan' })
    expect(created.status).toBe(201)
    const id = created.body.document.id

    const renamed = await request(app)
      .patch(`/api/documents/${id}`)
      .set(auth)
      .send({ title: 'Road trip plan' })
    expect(renamed.status).toBe(200)
    expect(renamed.body.document.title).toBe('Road trip plan')

    const content = JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Pack water.' }] }],
    })
    const saved = await request(app).patch(`/api/documents/${id}`).set(auth).send({ content })
    expect(saved.status).toBe(200)

    const reopened = await request(app).get(`/api/documents/${id}`).set(auth)
    expect(reopened.status).toBe(200)
    expect(reopened.body.content).toBe(content)
    expect(reopened.body.title).toBe('Road trip plan')
    expect(reopened.body.role).toBe('owner')
  })

  it('validates empty titles', async () => {
    const token = await login('sawan@ajaia.local')
    const bad = await request(app)
      .post('/api/documents')
      .set({ Authorization: `Bearer ${token}` })
      .send({ title: '   ' })
    expect(bad.status).toBe(400)
  })
})

describe('sharing access control', () => {
  it('grants a second user access, blocks a third, and enforces ownership rules', async () => {
    const ownerToken = await login('sawan@ajaia.local')
    const ownerAuth = { Authorization: `Bearer ${ownerToken}` }

    const created = await request(app).post('/api/documents').set(ownerAuth).send({ title: 'Shared doc' })
    const id = created.body.document.id

    const share = await request(app)
      .post(`/api/documents/${id}/share`)
      .set(ownerAuth)
      .send({ email: 'reviewer@ajaia.local' })
    expect(share.status).toBe(201)

    const reviewerToken = await login('reviewer@ajaia.local')
    const reviewerAuth = { Authorization: `Bearer ${reviewerToken}` }

    const reviewerList = await request(app).get('/api/documents').set(reviewerAuth)
    const sharedTitles = reviewerList.body.shared.map((d) => d.title)
    expect(sharedTitles).toContain('Shared doc')
    expect(reviewerList.body.owned.find((d) => d.title === 'Shared doc')).toBeUndefined()

    const access = await request(app).get(`/api/documents/${id}`).set(reviewerAuth)
    expect(access.status).toBe(200)
    expect(access.body.role).toBe('editor')

    const editorPatch = await request(app)
      .patch(`/api/documents/${id}`)
      .set(reviewerAuth)
      .send({ content: 'edited by reviewer' })
    expect(editorPatch.status).toBe(200)

    const ownerOnlyRename = await request(app)
      .patch(`/api/documents/${id}`)
      .set(reviewerAuth)
      .send({ title: 'Hijacked' })
    expect(ownerOnlyRename.status).toBe(403)

    const outsiderToken = await login('teammate@ajaia.local')
    const outsider = await request(app)
      .get(`/api/documents/${id}`)
      .set({ Authorization: `Bearer ${outsiderToken}` })
    expect(outsider.status).toBe(404)

    const ownerSeesShare = await request(app).get(`/api/documents/${id}`).set(ownerAuth)
    expect(ownerSeesShare.body.shares).toHaveLength(1)
  })

  it('rejects sharing without ownership', async () => {
    const reviewer = await login('reviewer@ajaia.local')
    const owner = await login('sawan@ajaia.local')
    const doc = await request(app)
      .post('/api/documents')
      .set({ Authorization: `Bearer ${owner}` })
      .send({ title: 'Ours' })

    const forbidden = await request(app)
      .post(`/api/documents/${doc.body.document.id}/share`)
      .set({ Authorization: `Bearer ${reviewer}` })
      .send({ email: 'teammate@ajaia.local' })
    expect(forbidden.status).toBe(403)
  })

  it('auto-creates a user when sharing to an unknown email, who can then sign in', async () => {
    const ownerToken = await login('sawan@ajaia.local')
    const ownerAuth = { Authorization: `Bearer ${ownerToken}` }

    const doc = await request(app).post('/api/documents').set(ownerAuth).send({ title: 'Guest doc' })
    const id = doc.body.document.id

    const share = await request(app)
      .post(`/api/documents/${id}/share`)
      .set(ownerAuth)
      .send({ email: 'newperson@gmail.com' })
    expect(share.status).toBe(201)
    expect(share.body.createdNewUser).toBe(true)

    // the newly created user can now log in and sees the shared document
    const guestToken = await login('newperson@gmail.com')
    const guestList = await request(app)
      .get('/api/documents')
      .set({ Authorization: `Bearer ${guestToken}` })
    expect(guestList.body.shared.map((d) => d.title)).toContain('Guest doc')

    const guestView = await request(app)
      .get(`/api/documents/${id}`)
      .set({ Authorization: `Bearer ${guestToken}` })
    expect(guestView.status).toBe(200)
    expect(guestView.body.role).toBe('editor')
  })
  it('exports a document to markdown with formatting preserved', async () => {
    const token = await login('sawan@ajaia.local')
    const auth = { Authorization: `Bearer ${token}` }

    const doc = await request(app).post('/api/documents').set(auth).send({ title: 'Export me' })
    const id = doc.body.document.id

    const content = JSON.stringify({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Plan' }] },
        { type: 'paragraph', content: [
          { type: 'text', text: 'plain ' },
          { type: 'text', marks: [{ type: 'bold' }], text: 'bold' },
        ] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'item one' }] }] },
        ] },
      ],
    })
    await request(app).patch(`/api/documents/${id}`).set(auth).send({ content })

    const res = await request(app).get(`/api/documents/${id}/export`).set(auth)
    expect(res.status).toBe(200)
    expect(res.body.title).toBe('Export me')
    expect(res.body.markdown).toContain('## Plan')
    expect(res.body.markdown).toContain('plain **bold**')
    expect(res.body.markdown).toContain('- item one')

    const outsider = await login('teammate@ajaia.local')
    const denied = await request(app)
      .get(`/api/documents/${id}/export`)
      .set({ Authorization: `Bearer ${outsider}` })
    expect(denied.status).toBe(404)
  })
})

describe('import', () => {
  it('creates a new document from an uploaded .md file', async () => {
    const token = await login('sawan@ajaia.local')
    const res = await request(app)
      .post('/api/import')
      .set({ Authorization: `Bearer ${token}` })
      .attach('file', Buffer.from('# Hello\n\n- one\n- two'), 'notes.md')

    expect(res.status).toBe(201)
    expect(res.body.document.title).toBe('notes')
    expect(res.body.document.content).toContain('<h1>Hello</h1>')
    expect(res.body.document.content).toContain('<li>one</li>')
  })

  it('rejects unsupported file types', async () => {
    const token = await login('sawan@ajaia.local')
    const res = await request(app)
      .post('/api/import')
      .set({ Authorization: `Bearer ${token}` })
      .attach('file', Buffer.from('x'), 'photo.png')
    expect(res.status).toBe(400)
  })
})

afterAll(async () => {
  await prisma.$disconnect()
  fs.rmSync(path.join(here, '..', 'prisma', 'test.db'), { force: true })
})