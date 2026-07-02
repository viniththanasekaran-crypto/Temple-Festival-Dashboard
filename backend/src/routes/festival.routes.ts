import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { authenticate, requirePermission } from '../middleware/auth.middleware'
import {
  listFestivalsHandler,
  getFestivalHandler,
  createFestivalHandler,
  updateFestivalHandler,
  deleteFestivalHandler,
} from '../controllers/festival.controller'

const router = Router()

router.use(authenticate)

// Reject users without a temple assignment (super_admin has templeId = null)
router.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.templeId) {
    res.status(403).json({ success: false, message: 'No temple assigned to this account' })
    return
  }
  next()
})

router.get('/', requirePermission('festivals:read'), listFestivalsHandler)
router.post('/', requirePermission('festivals:create'), createFestivalHandler)
router.get('/:id', requirePermission('festivals:read'), getFestivalHandler)
router.put('/:id', requirePermission('festivals:update'), updateFestivalHandler)
router.delete('/:id', requirePermission('festivals:delete'), deleteFestivalHandler)

export default router
