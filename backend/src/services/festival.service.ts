import prisma from '../lib/prisma'
import type { CreateFestivalInput, UpdateFestivalInput } from '../schemas/festival.schema'

const FESTIVAL_INCLUDE = {
  _count: { select: { payments: true } },
} as const

type AgendaItem = { title: string; description?: string }

// Manual day-wise agenda rows — order follows the list position (Day 1, Day 2, …).
function agendaRows(festivalId: number, agenda: AgendaItem[]) {
  return agenda.map((a, i) => ({
    festivalId,
    order: i + 1,
    title: a.title,
    description: a.description ?? null,
  }))
}

export async function listFestivals(templeId: number) {
  return prisma.festival.findMany({
    where: { templeId },
    include: { ...FESTIVAL_INCLUDE, agenda: { orderBy: { order: 'asc' } } },
    orderBy: { startDate: 'desc' },
  })
}

export async function getFestival(templeId: number, id: number) {
  const festival = await prisma.festival.findFirst({
    where: { id, templeId },
    include: { ...FESTIVAL_INCLUDE, agenda: { orderBy: { order: 'asc' } } },
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
      contacts: data.contacts ?? [],
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      fixedAmount: data.fixedAmount,
      isActive: data.isActive ?? true,
    },
    include: FESTIVAL_INCLUDE,
  })
  if (data.agenda?.length) {
    await prisma.festivalAgenda.createMany({ data: agendaRows(festival.id, data.agenda) })
  }
  return festival
}

export async function updateFestival(templeId: number, id: number, data: UpdateFestivalInput) {
  const existing = await prisma.festival.findFirst({ where: { id, templeId } })
  if (!existing) {
    const err = new Error('Festival not found')
    ;(err as NodeJS.ErrnoException).code = 'NOT_FOUND'
    throw err
  }
  const { startDate, endDate, fixedAmount, agenda, ...rest } = data
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
  // Agenda is edited as a whole list — replace it when provided.
  if (agenda !== undefined) {
    await prisma.festivalAgenda.deleteMany({ where: { festivalId: id } })
    if (agenda.length > 0) {
      await prisma.festivalAgenda.createMany({ data: agendaRows(id, agenda) })
    }
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
