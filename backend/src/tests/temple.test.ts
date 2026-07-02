import request from 'supertest'
import app from '../app'
import prisma from '../lib/prisma'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

let superAdminToken: string
let districtId: number
let createdTempleId: number

beforeAll(async () => {
  // get a district to use
  const district = await prisma.district.findFirst()
  if (!district) throw new Error('No districts seeded — run npm run db:seed on test DB')
  districtId = district.id

  // create super_admin cookie for auth
  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'super_admin' } })
  const hash = await bcrypt.hash('Test@1234', 10)
  await prisma.user.deleteMany({ where: { username: 'test_superadmin' } })
  await prisma.user.create({
    data: { username: 'test_superadmin', password: hash, roleId: superAdminRole.id },
  })

  superAdminToken = jwt.sign(
    {
      userId: 999,
      username: 'test_superadmin',
      roleId: superAdminRole.id,
      roleName: 'super_admin',
      permissions: ['temples:create', 'temples:read', 'temples:update', 'temples:delete'],
      templeIds: [],
    },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  )
})

afterAll(async () => {
  if (createdTempleId) {
    await prisma.temple.deleteMany({ where: { id: createdTempleId } })
  }
  await prisma.user.deleteMany({ where: { username: 'test_superadmin' } })
  await prisma.$disconnect()
})

describe('Temple CRUD', () => {
  it('POST /temples — creates a temple', async () => {
    const res = await request(app)
      .post('/api/v1/temples')
      .set('Cookie', `access_token=${superAdminToken}`)
      .send({ name: 'Test Temple', deity: 'Murugan', village: 'Test Village', districtId })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.temple.name).toBe('Test Temple')
    expect(res.body.data.temple.deity).toBe('Murugan')
    expect(res.body.data.temple.district.id).toBe(districtId)
    createdTempleId = res.body.data.temple.id
  })

  it('GET /temples — lists all temples', async () => {
    const res = await request(app)
      .get('/api/v1/temples')
      .set('Cookie', `access_token=${superAdminToken}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data.temples)).toBe(true)
    expect(res.body.data.temples.length).toBeGreaterThan(0)
  })

  it('PUT /temples/:id — updates a temple', async () => {
    const res = await request(app)
      .put(`/api/v1/temples/${createdTempleId}`)
      .set('Cookie', `access_token=${superAdminToken}`)
      .send({ deity: 'Shiva' })

    expect(res.status).toBe(200)
    expect(res.body.data.temple.deity).toBe('Shiva')
  })

  it('POST /temples — rejects missing name', async () => {
    const res = await request(app)
      .post('/api/v1/temples')
      .set('Cookie', `access_token=${superAdminToken}`)
      .send({ districtId })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('DELETE /temples/:id — deletes temple with no festivals/families', async () => {
    const res = await request(app)
      .delete(`/api/v1/temples/${createdTempleId}`)
      .set('Cookie', `access_token=${superAdminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    createdTempleId = 0
  })

  it('GET /temples — non-super_admin gets 403', async () => {
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'admin' } })
    const adminToken = jwt.sign(
      {
        userId: 998,
        username: 'test_admin',
        roleId: adminRole.id,
        roleName: 'admin',
        permissions: [],
        templeIds: [1],
      },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' }
    )

    const res = await request(app)
      .get('/api/v1/temples')
      .set('Cookie', `access_token=${adminToken}`)

    expect(res.status).toBe(403)
  })
})
