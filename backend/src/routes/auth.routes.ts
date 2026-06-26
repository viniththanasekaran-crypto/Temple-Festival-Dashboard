import { Router } from 'express'
import { loginHandler, refreshHandler, logoutHandler, meHandler } from '../controllers/auth.controller'
import { authenticate } from '../middleware/auth.middleware'

const router = Router()

router.post('/login', loginHandler)
router.post('/refresh', refreshHandler)
router.get('/me', authenticate, meHandler)
router.post('/logout', authenticate, logoutHandler)

export default router
