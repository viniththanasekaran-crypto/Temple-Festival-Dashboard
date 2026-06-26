import prisma from '../lib/prisma'
import type { CreateTempleInput, UpdateTempleInput } from '../schemas/temple.schema'

const TEMPLE_INCLUDE = {
  district: { select: { id: true, name: true } },
  _count: { select: { festivals: true, families: true, users: true } },
} as const

export async function listTemples() {
  return prisma.temple.findMany({
    include: TEMPLE_INCLUDE,
    orderBy: { createdAt: 'desc' },
  })
}

export async function getTemple(id: number) {
  return prisma.temple.findUnique({ where: { id }, include: TEMPLE_INCLUDE })
}

export async function createTemple(data: CreateTempleInput) {
  return prisma.temple.create({ data, include: TEMPLE_INCLUDE })
}

export async function updateTemple(id: number, data: UpdateTempleInput) {
  return prisma.temple.update({ where: { id }, data, include: TEMPLE_INCLUDE })
}

export async function deleteTemple(id: number) {
  const temple = await prisma.temple.findUnique({
    where: { id },
    include: { _count: { select: { festivals: true, families: true } } },
  })
  if (!temple) {
    const err = new Error('Temple not found')
    ;(err as NodeJS.ErrnoException).code = 'NOT_FOUND'
    throw err
  }
  if (temple._count.festivals > 0 || temple._count.families > 0) {
    const err = new Error('Cannot delete a temple that has festivals or families')
    ;(err as NodeJS.ErrnoException).code = 'HAS_DEPENDENCIES'
    throw err
  }
  return prisma.temple.delete({ where: { id } })
}
