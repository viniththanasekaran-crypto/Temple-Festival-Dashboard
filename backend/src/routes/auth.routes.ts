import { Router } from 'express'
import { loginHandler, refreshHandler, logoutHandler } from '../controllers/auth.controller'
import { authenticate } from '../middleware/auth.middleware'

const router = Router()

router.post('/login', loginHandler)
router.post('/refresh', refreshHandler)
router.post('/logout', authenticate, logoutHandler)

export default router
