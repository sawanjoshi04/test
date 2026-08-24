import 'dotenv/config'
import { prisma } from './db.js'

const USERS = [
  { email: 'sawan@ajaia.local', name: 'Sawan Marre' },
  { email: 'reviewer@ajaia.local', name: 'Alias Reviewer' },
  { email: 'teammate@ajaia.local', name: 'Marco Merkel' },
]

async function main() {
  const created = []
  for (const u of USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: u,
    })
    created.push(user)
    console.log(`✓ user ${u.email} → ${user.id}`)
  }

  const existing = await prisma.document.count()
  if (existing === 0) {
    const [sawan] = created
    const reviewer = created.find((u) => u.email === 'reviewer@ajaia.local')

    const gettingStarted = await prisma.document.create({
      data: {
        title: 'Getting started',
        ownerId: sawan.id,
        content: JSON.stringify({
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Welcome to Docs Collab' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'A small collaborative markdown editor built for evaluation. Pick a demo user to sign in, then create or edit documents.' }] },
            { type: 'bulletList', content: [
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bold, italic, underline' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Headings, bullet and numbered lists' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Import .md / .txt files' }] }] },
            ] },
          ],
        }),
      },
    })

    await prisma.documentAccess.create({
      data: { documentId: gettingStarted.id, userId: reviewer.id, role: 'editor' },
    })
    console.log(`✓ seeded "Getting started" (shared with ${reviewer.email})`)
  } else {
    console.log('Found existing documents; skipping demo data.')
  }

  console.log('Seeding complete.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })