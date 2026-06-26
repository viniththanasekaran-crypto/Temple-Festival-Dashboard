import bcrypt from 'bcrypt'
import prisma from '../lib/prisma'
import { generatePassword } from '../utils/password'
import type { CreateUserInput, UpdateUserInput } from '../schemas/user.schema'

const USER_INCLUDE = {
  role: { select: { name: true } },
  temple: { select: { id: true, name: true } },
} as const

export async function listUsers() {
  const [superAdminRole, adminRole] = await Promise.all([
    prisma.role.findUnique({ where: { name: 'super_admin' } }),
    prisma.role.findUnique({ where: { name: 'admin' } }),
  ])
  const roleIds = [superAdminRole?.id, adminRole?.id].filter(Boolean) as number[]

  return prisma.user.findMany({
    where: { roleId: { in: roleIds } },
    include: USER_INCLUDE,
    orderBy: { createdAt: 'desc' },
  })
}

export async function createUser(data: CreateUserInput) {
  const role = await prisma.role.findUniqueOrThrow({ where: { name: data.role } })
  const plainPassword = generatePassword()
  const hash = await bcrypt.hash(plainPassword, 10)

  const user = await prisma.user.create({
    data: {
      username: data.username,
      name: data.name,
      phone: data.phone,
      password: hash,
      roleId: role.id,
      templeId: data.templeId ?? null,
    },
    include: USER_INCLUDE,
  })

  // TODO Phase 7: replace console.log with MSG91 SMS
  console.log(`[DEV] New user credentials — username: ${data.username}, password: ${plainPassword}`)

  return { user, password: plainPassword }
}

export async function updateUser(id: number, data: UpdateUserInput) {
  const updates: Record<string, unknown> = {}
  if (data.name !== undefined) updates.name = data.name
  if (data.phone !== undefined) updates.phone = data.phone
  if (data.templeId !== undefined) updates.templeId = data.templeId

  if (data.role) {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: data.role } })
    updates.roleId = role.id
    if (data.role === 'super_admin') updates.templeId = null
  }

  return prisma.user.update({ where: { id }, data: updates, include: USER_INCLUDE })
}

export async function deactivateUser(id: number) {
  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) {
    const err = new Error('User not found')
    ;(err as NodeJS.ErrnoException).code = 'NOT_FOUND'
    throw err
  }
  return prisma.user.update({ where: { id }, data: { isActive: false }, include: USER_INCLUDE })
}
