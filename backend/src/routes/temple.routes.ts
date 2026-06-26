import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth.middleware'
import {
  listTemplesHandler,
  createTempleHandler,
  updateTempleHandler,
  deleteTempleHandler,
} from '../controllers/temple.controller'

const router = Router()

router.use(authenticate, requireRole('super_admin'))

router.get('/', listTemplesHandler)
router.post('/', createTempleHandler)
router.put('/:id', updateTempleHandler)
router.delete('/:id', deleteTempleHandler)

export default router
