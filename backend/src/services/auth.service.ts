import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import prisma from '../lib/prisma'
import type { LoginInput } from '../schemas/auth.schema'

const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15

const ROLE_INCLUDE = {
  include: {
    permissions: {
      include: { permission: true },
    },
  },
}

type RoleWithPermissions = {
  id: number
  name: string
  permissions: { permission: { resource: string; action: string } }[]
}

function buildPermissions(role: RoleWithPermissions): string[] {
  return role.permissions.map((rp) => `${rp.permission.resource}:${rp.permission.action}`)
}

function signAccessToken(
  userId: number,
  username: string,
  roleId: number,
  roleName: string,
  permissions: string[],
  templeIds: number[]
) {
  return jwt.sign(
    { userId, username, roleId, roleName, permissions, templeIds },
    process.env.JWT_SECRET!,
    { expiresIn: (process.env.JWT_ACCESS_EXPIRY || '15m') as jwt.SignOptions['expiresIn'] }
  )
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { username: input.username },
    include: { role: ROLE_INCLUDE, temples: { select: { id: true, name: true } } },
  })

  if (!user) {
    return { error: 'Invalid username or password', status: 401 }
  }

  if (!user.isActive) {
    return { error: 'Account deactivated. Contact your administrator.', status: 403 }
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { error: 'Account locked. Try again in 15 minutes.', status: 423 }
  }

  const passwordMatch = await bcrypt.compare(input.password, user.password)

  if (!passwordMatch) {
    const attempts = user.failedAttempts + 1
    const lockedUntil =
      attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null

    await prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: attempts, lockedUntil },
    })

    return { error: 'Invalid username or password', status: 401 }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedAttempts: 0, lockedUntil: null },
  })

  const permissions = buildPermissions(user.role as RoleWithPermissions)
  const templeIds = user.temples.map((t) => t.id)
  const accessToken = signAccessToken(
    user.id,
    user.username,
    user.roleId,
    user.role.name,
    permissions,
    templeIds
  )

  const rawRefreshToken = crypto.randomBytes(64).toString('hex')
  const tokenHash = await bcrypt.hash(rawRefreshToken, 10)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  })

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    user: {
      id: user.id,
      username: user.username,
      role: user.role.name,
      templeIds,
      temples: user.temples,
    },
  }
}

export async function refresh(rawToken: string) {
  const tokens = await prisma.refreshToken.findMany({
    where: { expiresAt: { gt: new Date() } },
    include: {
      user: {
        include: { role: ROLE_INCLUDE, temples: { select: { id: true } } },
      },
    },
  })

  for (const record of tokens) {
    const match = await bcrypt.compare(rawToken, record.tokenHash)
    if (match) {
      const { user } = record
      const permissions = buildPermissions(user.role as RoleWithPermissions)
      const accessToken = signAccessToken(
        user.id,
        user.username,
        user.roleId,
        user.role.name,
        permissions,
        user.temples.map((t) => t.id)
      )
      return { accessToken }
    }
  }

  return { error: 'Invalid or expired refresh token', status: 401 }
}

export async function logout(rawToken: string) {
  const tokens = await prisma.refreshToken.findMany({
    where: { expiresAt: { gt: new Date() } },
  })

  for (const record of tokens) {
    const match = await bcrypt.compare(rawToken, record.tokenHash)
    if (match) {
      await prisma.refreshToken.delete({ where: { id: record.id } })
      return { success: true }
    }
  }

  return { success: true }
}
