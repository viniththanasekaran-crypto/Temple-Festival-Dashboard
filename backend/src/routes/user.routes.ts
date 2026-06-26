import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth.middleware'
import {
  listUsersHandler,
  createUserHandler,
  updateUserHandler,
  deactivateUserHandler,
} from '../controllers/user.controller'

const router = Router()

router.use(authenticate, requireRole('super_admin'))

router.get('/', listUsersHandler)
router.post('/', createUserHandler)
router.put('/:id', updateUserHandler)
router.put('/:id/deactivate', deactivateUserHandler)

export default router
