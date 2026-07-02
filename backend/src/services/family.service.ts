import bcrypt from 'bcrypt'
import prisma from '../lib/prisma'
import { generatePassword } from '../utils/password'
import type { CreateFamilyInput, UpdateFamilyInput } from '../schemas/family.schema'

const FAMILY_INCLUDE = {
  _count: { select: { payments: true } },
  user: { select: { id: true, username: true } },
} as const

function notFound() {
  const err = new Error('Family not found')
  ;(err as NodeJS.ErrnoException).code = 'NOT_FOUND'
  return err
}

export async function listFamilies(templeId: number) {
  return prisma.family.findMany({
    where: { templeId },
    include: FAMILY_INCLUDE,
    orderBy: { headName: 'asc' },
  })
}

// A viewer only ever sees the family their account is linked to.
export async function listOwnFamily(templeId: number, userId: number) {
  return prisma.family.findMany({
    where: { templeId, user: { id: userId } },
    include: FAMILY_INCLUDE,
  })
}

export async function getFamily(templeId: number, id: number) {
  const family = await prisma.family.findFirst({ where: { id, templeId }, include: FAMILY_INCLUDE })
  if (!family) throw notFound()
  return family
}

export async function createFamily(templeId: number, data: CreateFamilyInput) {
  const family = await prisma.family.create({
    data: {
      templeId,
      headName: data.headName,
      primaryPhone: data.primaryPhone,
      address: data.address,
      children: data.children ?? [],
    },
    include: FAMILY_INCLUDE,
  })

  // Link an existing account with this phone, or auto-create a viewer login.
  let credentials: { username: string; password: string } | null = null
  const existing = await prisma.user.findFirst({ where: { phone: data.primaryPhone } })

  if (existing) {
    if (!existing.familyId) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { familyId: family.id, temples: { connect: { id: templeId } } },
      })
    }
  } else {
    const viewerRole = await prisma.role.findUniqueOrThrow({ where: { name: 'viewer' } })
    const plainPassword = generatePassword()
    const hash = await bcrypt.hash(plainPassword, 10)
    await prisma.user.create({
      data: {
        username: data.primaryPhone,
        phone: data.primaryPhone,
        password: hash,
        roleId: viewerRole.id,
        familyId: family.id,
        temples: { connect: { id: templeId } },
      },
    })
    // TODO Phase 7: replace console.log with MSG91 SMS
    console.log(
      `[DEV] New viewer credentials — username: ${data.primaryPhone}, password: ${plainPassword}`
    )
    credentials = { username: data.primaryPhone, password: plainPassword }
  }

  return { family, credentials }
}

export async function updateFamily(templeId: number, id: number, data: UpdateFamilyInput) {
  const existing = await prisma.family.findFirst({ where: { id, templeId } })
  if (!existing) throw notFound()
  return prisma.family.update({ where: { id }, data, include: FAMILY_INCLUDE })
}

export async function deleteFamily(templeId: number, id: number) {
  const family = await prisma.family.findFirst({
    where: { id, templeId },
    include: { _count: { select: { payments: true } }, user: { select: { id: true } } },
  })
  if (!family) throw notFound()
  if (family._count.payments > 0) {
    const err = new Error('Cannot delete a family that has payments')
    ;(err as NodeJS.ErrnoException).code = 'HAS_DEPENDENCIES'
    throw err
  }
  // Remove the family and its linked viewer account (personal data) together.
  await prisma.$transaction([
    ...(family.user ? [prisma.user.delete({ where: { id: family.user.id } })] : []),
    prisma.family.delete({ where: { id } }),
  ])
}
