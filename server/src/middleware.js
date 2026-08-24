import { prisma } from './db.js'

function readToken(req) {
  const header = req.headers.authorization || ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null
}

export async function requireAuth(req, res, next) {
  try {
    const token = readToken(req)
    if (!token) {
      return res.status(401).json({ error: 'Missing auth token. Please log in.' })
    }
    const user = await prisma.user.findUnique({ where: { id: token } })
    if (!user) {
      return res.status(401).json({ error: 'Invalid session. Please log in again.' })
    }
    req.user = user
    next()
  } catch (err) {
    next(err)
  }
}