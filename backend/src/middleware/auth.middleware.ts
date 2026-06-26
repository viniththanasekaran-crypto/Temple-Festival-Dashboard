import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface JwtPayload {
  userId: number
  roleId: number
  roleName: string
  permissions: string[] // e.g. ["festivals:create", "families:read"]
  templeId: number | null
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.access_token

  if (!token) {
    res.status(401).json({ success: false, message: 'Not authenticated' })
    return
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload
    req.user = payload
    next()
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' })
  }
}

export function requireRole(...roleNames: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roleNames.includes(req.user.roleName)) {
      res.status(403).json({ success: false, message: 'Forbidden' })
      return
    }
    next()
  }
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.permissions.includes(permission)) {
      res.status(403).json({ success: false, message: 'Forbidden' })
      return
    }
    next()
  }
}
