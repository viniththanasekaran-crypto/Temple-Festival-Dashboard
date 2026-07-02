import type { JwtPayload } from '../middleware/auth.middleware'

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
      templeId?: number // active temple resolved by resolveTemple middleware
    }
  }
}
