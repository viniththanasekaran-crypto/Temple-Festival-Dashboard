import request from 'supertest'
import app from '../app'
import prisma from '../lib/prisma'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'

let superAdminToken: string
let districtId: number
let templeId: number
let createdUserId: number

beforeAll(async () => {
  const district = await prisma.district.findFirst()
  if (!district) throw new Error('No districts seeded')
  districtId = district.id

  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'super_admin' } })
  const hash = await bcrypt.hash('Test@1234', 10)
  await prisma.user.deleteMany({ where: { username: 'test_superadmin2' } })
  await prisma.user.create({
    data: { username: 'test_superadmin2', password: hash, roleId: superAdminRole.id },
  })

  const temple = await prisma.temple.create({
    data: { name: 'User Test Temple', districtId },
  })
  templeId = temple.id

  superAdminToken = jwt.sign(
    {
      userId: 997,
      username: 'test_superadmin2',
      roleId: superAdminRole.id,
      roleName: 'super_admin',
      permissions: ['users:create', 'users:read', 'users:update', 'users:deactivate'],
      templeIds: [],
    },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  )
})

afterAll(async () => {
  if (createdUserId) await prisma.user.deleteMany({ where: { id: createdUserId } })
  await prisma.user.deleteMany({
    where: { username: { in: ['test_superadmin2', 'new_admin_user'] } },
  })
  await prisma.temple.deleteMany({ where: { id: templeId } })
  await prisma.$disconnect()
})

describe('User management', () => {
  it('POST /users — creates admin with generated password', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Cookie', `access_token=${superAdminToken}`)
      .send({
        username: 'new_admin_user',
        name: 'Test Admin',
        role: 'admin',
        templeIds: [templeId],
      })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.user.role.name).toBe('admin')
    expect(res.body.data.user.temples.map((t: { id: number }) => t.id)).toEqual([templeId])
    expect(typeof res.body.data.password).toBe('string')
    expect(res.body.data.password.length).toBeGreaterThanOrEqual(12)
    createdUserId = res.body.data.user.id
  })

  it('POST /users — creates super_admin without templeId', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Cookie', `access_token=${superAdminToken}`)
      .send({ username: 'new_sa_temp', role: 'super_admin' })

    expect(res.status).toBe(201)
    expect(res.body.data.user.role.name).toBe('super_admin')
    expect(res.body.data.user.temples).toEqual([])

    await prisma.user.deleteMany({ where: { username: 'new_sa_temp' } })
  })

  it('POST /users — rejects admin without templeId', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Cookie', `access_token=${superAdminToken}`)
      .send({ username: 'bad_admin', role: 'admin' })

    expect(res.status).toBe(400)
  })

  it('POST /users — rejects duplicate username', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Cookie', `access_token=${superAdminToken}`)
      .send({ username: 'new_admin_user', role: 'admin', templeIds: [templeId] })

    expect(res.status).toBe(409)
  })

  it('GET /users — lists super_admin and admin accounts', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set('Cookie', `access_token=${superAdminToken}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data.users)).toBe(true)
    const roles = res.body.data.users.map((u: { role: { name: string } }) => u.role.name)
    expect(roles.every((r: string) => ['super_admin', 'admin'].includes(r))).toBe(true)
  })

  it('PUT /users/:id/deactivate — deactivates the user', async () => {
    const res = await request(app)
      .put(`/api/v1/users/${createdUserId}/deactivate`)
      .set('Cookie', `access_token=${superAdminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data.user.isActive).toBe(false)
  })
})
