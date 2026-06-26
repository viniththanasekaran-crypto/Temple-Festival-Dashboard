import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import prisma from '../lib/prisma'

const router = Router()

router.get('/', authenticate, async (_req, res) => {
  const districts = await prisma.district.findMany({ orderBy: { name: 'asc' } })
  res.json({ success: true, data: { districts } })
})

export default router
