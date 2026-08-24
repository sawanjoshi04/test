import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth } from '../middleware.js'

const router = Router()

router.get('/', requireAuth, async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { email: 'asc' },
    })
    res.json({ users })
  } catch (err) {
    next(err)
  }
})

export default router