import { Router } from 'express'
import { authenticate, requirePermission, resolveTemple } from '../middleware/auth.middleware'
import {
  listFamiliesHandler,
  getFamilyHandler,
  createFamilyHandler,
  updateFamilyHandler,
  deleteFamilyHandler,
} from '../controllers/family.controller'

const router = Router()

// Resolve the active temple (from the X-Temple-Id header) and verify membership.
router.use(authenticate, resolveTemple)

router.get('/', requirePermission('families:read'), listFamiliesHandler)
router.post('/', requirePermission('families:create'), createFamilyHandler)
router.get('/:id', requirePermission('families:read'), getFamilyHandler)
router.put('/:id', requirePermission('families:update'), updateFamilyHandler)
router.delete('/:id', requirePermission('families:delete'), deleteFamilyHandler)

export default router
