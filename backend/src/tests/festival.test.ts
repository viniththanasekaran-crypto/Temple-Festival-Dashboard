import request from 'supertest'
import app from '../app'
import prisma from '../lib/prisma'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

let adminToken: string
let superAdminToken: string
let templeId: number
let createdFestivalId: number

beforeAll(async () => {
  const district = await prisma.district.findFirst()
  if (!district) throw new Error('No districts seeded')

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'admin' } })
  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'super_admin' } })

  await prisma.temple.deleteMany({ where: { name: 'Festival Test Temple' } })
  const temple = await prisma.temple.create({
    data: { name: 'Festival Test Temple', districtId: district.id },
  })
  templeId = temple.id

  const hash = await bcrypt.hash('Test@1234', 10)
  await prisma.user.deleteMany({ where: { username: { in: ['fest_admin', 'fest_sa'] } } })
  await prisma.user.create({
    data: {
      username: 'fest_admin',
      password: hash,
      roleId: adminRole.id,
      temples: { connect: { id: templeId } },
    },
  })

  adminToken = jwt.sign(
    {
      userId: 9001,
      username: 'fest_admin',
      roleId: adminRole.id,
      roleName: 'admin',
      permissions: ['festivals:create', 'festivals:read', 'festivals:update', 'festivals:delete'],
      templeIds: [templeId],
    },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  )

  superAdminToken = jwt.sign(
    {
      userId: 9002,
      username: 'fest_sa',
      roleId: superAdminRole.id,
      roleName: 'super_admin',
      permissions: ['festivals:read'],
      templeIds: [],
    },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  )
})

afterAll(async () => {
  if (createdFestivalId) {
    await prisma.festivalAgenda.deleteMany({ where: { festivalId: createdFestivalId } })
    await prisma.festival.deleteMany({ where: { id: createdFestivalId } })
  }
  await prisma.temple.deleteMany({ where: { name: 'Festival Test Temple' } })
  await prisma.user.deleteMany({ where: { username: { in: ['fest_admin', 'fest_sa'] } } })
  await prisma.$disconnect()
})

describe('Festival CRUD', () => {
  it('POST /festivals — creates festival with the provided day-wise agenda', async () => {
    const res = await request(app)
      .post('/api/v1/festivals')
      .set('Cookie', `access_token=${adminToken}`)
      .send({
        name: 'Panguni Uthiram',
        description: 'Annual festival',
        contacts: [{ name: 'Murugesan', phone: '+919876543210' }],
        startDate: '2026-08-01T00:00:00.000Z',
        endDate: '2026-08-03T00:00:00.000Z',
        fixedAmount: 500,
        agenda: [{ title: 'Flag hoisting' }, { title: 'Procession' }, { title: 'Car festival' }],
      })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.festival.name).toBe('Panguni Uthiram')
    createdFestivalId = res.body.data.festival.id

    const agenda = await prisma.festivalAgenda.findMany({
      where: { festivalId: createdFestivalId },
      orderBy: { order: 'asc' },
    })
    expect(agenda).toHaveLength(3)
    expect(agenda.map((a) => a.order)).toEqual([1, 2, 3])
    expect(agenda[0].title).toBe('Flag hoisting')
  })

  it('GET /festivals — lists temple festivals', async () => {
    const res = await request(app)
      .get('/api/v1/festivals')
      .set('Cookie', `access_token=${adminToken}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data.festivals)).toBe(true)
    expect(res.body.data.festivals.length).toBeGreaterThan(0)
  })

  it('GET /festivals/:id — returns festival with agenda', async () => {
    const res = await request(app)
      .get(`/api/v1/festivals/${createdFestivalId}`)
      .set('Cookie', `access_token=${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data.festival.agenda).toHaveLength(3)
  })

  it('PUT /festivals/:id — replaces the agenda when a new list is provided', async () => {
    const res = await request(app)
      .put(`/api/v1/festivals/${createdFestivalId}`)
      .set('Cookie', `access_token=${adminToken}`)
      .send({
        agenda: [{ title: 'Opening' }, { title: 'Closing' }],
      })

    expect(res.status).toBe(200)

    const agenda = await prisma.festivalAgenda.findMany({
      where: { festivalId: createdFestivalId },
      orderBy: { order: 'asc' },
    })
    expect(agenda.map((a) => a.title)).toEqual(['Opening', 'Closing'])
  })

  it('POST /festivals — rejects endDate before startDate', async () => {
    const res = await request(app)
      .post('/api/v1/festivals')
      .set('Cookie', `access_token=${adminToken}`)
      .send({
        name: 'Bad Festival',
        startDate: '2026-08-10T00:00:00.000Z',
        endDate: '2026-08-05T00:00:00.000Z',
        fixedAmount: 100,
      })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('POST /festivals — rejects missing name', async () => {
    const res = await request(app)
      .post('/api/v1/festivals')
      .set('Cookie', `access_token=${adminToken}`)
      .send({
        startDate: '2026-08-01T00:00:00.000Z',
        endDate: '2026-08-03T00:00:00.000Z',
        fixedAmount: 100,
      })

    expect(res.status).toBe(400)
  })

  it('DELETE /festivals/:id — deletes festival with no payments', async () => {
    const res = await request(app)
      .delete(`/api/v1/festivals/${createdFestivalId}`)
      .set('Cookie', `access_token=${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    createdFestivalId = 0
  })

  it('GET /festivals — super_admin without templeId gets 403', async () => {
    const res = await request(app)
      .get('/api/v1/festivals')
      .set('Cookie', `access_token=${superAdminToken}`)

    expect(res.status).toBe(403)
  })
})

describe('Multi-temple scoping (X-Temple-Id)', () => {
  let temple2Id: number
  let multiToken: string

  beforeAll(async () => {
    const district = await prisma.district.findFirstOrThrow()
    const t2 = await prisma.temple.create({
      data: { name: 'Second Festival Temple', districtId: district.id },
    })
    temple2Id = t2.id

    const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'admin' } })
    multiToken = jwt.sign(
      {
        userId: 9003,
        username: 'multi_admin',
        roleId: adminRole.id,
        roleName: 'admin',
        permissions: ['festivals:read', 'festivals:create'],
        templeIds: [templeId, temple2Id],
      },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' }
    )
  })

  afterAll(async () => {
    await prisma.festivalAgenda.deleteMany({ where: { festival: { templeId: temple2Id } } })
    await prisma.festival.deleteMany({ where: { templeId: temple2Id } })
    await prisma.temple.deleteMany({ where: { id: temple2Id } })
  })

  it('rejects a multi-temple admin when no X-Temple-Id header is sent (400)', async () => {
    const res = await request(app)
      .get('/api/v1/festivals')
      .set('Cookie', `access_token=${multiToken}`)

    expect(res.status).toBe(400)
  })

  it('rejects a temple the admin is not a member of (403)', async () => {
    const res = await request(app)
      .get('/api/v1/festivals')
      .set('Cookie', `access_token=${multiToken}`)
      .set('X-Temple-Id', '999999')

    expect(res.status).toBe(403)
  })

  it('scopes festivals to the temple chosen via X-Temple-Id', async () => {
    const create = await request(app)
      .post('/api/v1/festivals')
      .set('Cookie', `access_token=${multiToken}`)
      .set('X-Temple-Id', String(temple2Id))
      .send({
        name: 'Temple2 Fest',
        startDate: '2026-09-01T00:00:00.000Z',
        endDate: '2026-09-02T00:00:00.000Z',
        fixedAmount: 100,
        contacts: [{ name: 'Organiser' }],
      })
    expect(create.status).toBe(201)
    expect(create.body.data.festival.templeId).toBe(temple2Id)

    const list = await request(app)
      .get('/api/v1/festivals')
      .set('Cookie', `access_token=${multiToken}`)
      .set('X-Temple-Id', String(temple2Id))

    expect(list.status).toBe(200)
    const templeIds: number[] = list.body.data.festivals.map(
      (f: { templeId: number }) => f.templeId
    )
    expect(templeIds.every((tid) => tid === temple2Id)).toBe(true)
  })
})
