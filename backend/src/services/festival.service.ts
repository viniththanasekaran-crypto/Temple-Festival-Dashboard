import prisma from '../lib/prisma'
import type { CreateFestivalInput, UpdateFestivalInput } from '../schemas/festival.schema'

const FESTIVAL_INCLUDE = {
  _count: { select: { payments: true } },
} as const

function buildAgendaRows(festivalId: number, startDate: Date, endDate: Date) {
  const rows: { festivalId: number; date: Date }[] = []
  const cur = new Date(startDate)
  cur.setUTCHours(0, 0, 0, 0)
  const end = new Date(endDate)
  end.setUTCHours(0, 0, 0, 0)
  while (cur <= end && rows.length <= 365) {
    rows.push({ festivalId, date: new Date(cur) })
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return rows
}

export async function listFestivals(templeId: number) {
  return prisma.festival.findMany({
    where: { templeId },
    include: FESTIVAL_INCLUDE,
    orderBy: { startDate: 'desc' },
  })
}

export async function getFestival(templeId: number, id: number) {
  const festival = await prisma.festival.findFirst({
    where: { id, templeId },
    include: { ...FESTIVAL_INCLUDE, agenda: { orderBy: { date: 'asc' } } },
  })
  if (!festival) {
    const err = new Error('Festival not found')
    ;(err as NodeJS.ErrnoException).code = 'NOT_FOUND'
    throw err
  }
  return festival
}

export async function createFestival(templeId: number, data: CreateFestivalInput) {
  const festival = await prisma.festival.create({
    data: {
      templeId,
      name: data.name,
      description: data.description,
      headName: data.headName,
      headPhone: data.headPhone,
      phone2: data.phone2,
      phone3: data.phone3,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      fixedAmount: data.fixedAmount,
      isActive: data.isActive ?? true,
    },
    include: FESTIVAL_INCLUDE,
  })
  const rows = buildAgendaRows(festival.id, new Date(data.startDate), new Date(data.endDate))
  if (rows.length > 0) await prisma.festivalAgenda.createMany({ data: rows })
  return festival
}

export async function updateFestival(templeId: number, id: number, data: UpdateFestivalInput) {
  const existing = await prisma.festival.findFirst({ where: { id, templeId } })
  if (!existing) {
    const err = new Error('Festival not found')
    ;(err as NodeJS.ErrnoException).code = 'NOT_FOUND'
    throw err
  }
  const { startDate, endDate, fixedAmount, ...rest } = data
  const updated = await prisma.festival.update({
    where: { id },
    data: {
      ...rest,
      ...(startDate !== undefined && { startDate: new Date(startDate) }),
      ...(endDate !== undefined && { endDate: new Date(endDate) }),
      ...(fixedAmount !== undefined && { fixedAmount }),
    },
    include: FESTIVAL_INCLUDE,
  })
  if (startDate !== undefined || endDate !== undefined) {
    await prisma.festivalAgenda.deleteMany({ where: { festivalId: id } })
    const s = new Date(startDate ?? existing.startDate)
    const e = new Date(endDate ?? existing.endDate)
    const rows = buildAgendaRows(id, s, e)
    if (rows.length > 0) await prisma.festivalAgenda.createMany({ data: rows })
  }
  return updated
}

export async function deleteFestival(templeId: number, id: number) {
  const festival = await prisma.festival.findFirst({
    where: { id, templeId },
    include: { _count: { select: { payments: true } } },
  })
  if (!festival) {
    const err = new Error('Festival not found')
    ;(err as NodeJS.ErrnoException).code = 'NOT_FOUND'
    throw err
  }
  if (festival._count.payments > 0) {
    const err = new Error('Cannot delete a festival that has payments')
    ;(err as NodeJS.ErrnoException).code = 'HAS_DEPENDENCIES'
    throw err
  }
  return prisma.festival.delete({ where: { id } })
}
