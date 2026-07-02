import { Router } from 'express'
import { authenticate, requirePermission, resolveTemple } from '../middleware/auth.middleware'
import {
  listFestivalsHandler,
  getFestivalHandler,
  createFestivalHandler,
  updateFestivalHandler,
  deleteFestivalHandler,
} from '../controllers/festival.controller'

const router = Router()

// Resolve the active temple (from the X-Temple-Id header) and verify membership.
router.use(authenticate, resolveTemple)

router.get('/', requirePermission('festivals:read'), listFestivalsHandler)
router.post('/', requirePermission('festivals:create'), createFestivalHandler)
router.get('/:id', requirePermission('festivals:read'), getFestivalHandler)
router.put('/:id', requirePermission('festivals:update'), updateFestivalHandler)
router.delete('/:id', requirePermission('festivals:delete'), deleteFestivalHandler)

export default router
