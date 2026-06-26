import type { Request, Response } from 'express'
import { loginSchema } from '../schemas/auth.schema'
import * as authService from '../services/auth.service'

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
}

export async function loginHandler(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, message: 'Invalid input', errors: parsed.error.issues })
    return
  }

  const result = await authService.login(parsed.data)

  if ('error' in result) {
    res.status(result.status ?? 500).json({ success: false, message: result.error })
    return
  }

  res.cookie('access_token', result.accessToken, { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 })
  res.cookie('refresh_token', result.refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })

  res.json({ success: true, data: { user: result.user } })
}

export async function refreshHandler(req: Request, res: Response) {
  const token = req.cookies?.refresh_token
  if (!token) {
    res.status(401).json({ success: false, message: 'No refresh token' })
    return
  }

  const result = await authService.refresh(token)

  if ('error' in result) {
    res.status(result.status ?? 500).json({ success: false, message: result.error })
    return
  }

  res.cookie('access_token', result.accessToken, { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 })
  res.json({ success: true })
}

export async function logoutHandler(req: Request, res: Response) {
  const token = req.cookies?.refresh_token
  if (token) await authService.logout(token)

  res.clearCookie('access_token')
  res.clearCookie('refresh_token')
  res.json({ success: true })
}
