import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth } from '../middleware.js'

const router = Router()

export function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name }
}

router.post('/login', async (req, res, next) => {
  try {
    const email = req.body?.email
    if (typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'Email is required.' })
    }
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    })
    if (!user) {
      return res.status(401).json({
        error: 'Unknown user. Use one of the seeded demo accounts.',
      })
    }
    res.json({ token: user.id, user: publicUser(user) })
  } catch (err) {
    next(err)
  }
})

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) })
})

export default router