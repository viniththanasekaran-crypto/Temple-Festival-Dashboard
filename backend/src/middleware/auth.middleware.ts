import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface JwtPayload {
  userId: number
  username: string
  roleId: number
  roleName: string
  permissions: string[] // e.g. ["festivals:create", "families:read"]
  templeIds: number[] // temples this user may act on (admins can manage many)
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

// Resolves the temple a temple-scoped request acts on and sets req.templeId.
// The client picks the active temple via the `X-Temple-Id` header; when a user
// has exactly one temple it is auto-selected. Membership is always verified.
export function resolveTemple(req: Request, res: Response, next: NextFunction) {
  const templeIds = req.user?.templeIds ?? []
  if (templeIds.length === 0) {
    res.status(403).json({ success: false, message: 'No temple assigned to this account' })
    return
  }

  const header = req.header('X-Temple-Id')
  if (header) {
    const requested = Number(header)
    if (!Number.isInteger(requested) || !templeIds.includes(requested)) {
      res.status(403).json({ success: false, message: 'Not a member of the selected temple' })
      return
    }
    req.templeId = requested
  } else if (templeIds.length === 1) {
    req.templeId = templeIds[0]
  } else {
    res.status(400).json({
      success: false,
      message: 'No temple selected — set the X-Temple-Id header',
    })
    return
  }
  next()
}
