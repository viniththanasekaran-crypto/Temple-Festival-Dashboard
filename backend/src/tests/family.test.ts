import request from 'supertest'
import app from '../app'
import prisma from '../lib/prisma'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

let adminToken: string
let templeId: number
let family1Id: number
let family2Id: number
let viewerToken: string

const FAMILY1_PHONE = '+919000000001'
const FAMILY2_PHONE = '+919000000002' // already has an account before the family is added
const USERNAMES = ['fam_admin', 'existing_member', FAMILY1_PHONE, FAMILY2_PHONE]

beforeAll(async () => {
  const district = await prisma.district.findFirstOrThrow()
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'admin' } })
  const viewerRole = await prisma.role.findUniqueOrThrow({ where: { name: 'viewer' } })

  await prisma.user.deleteMany({ where: { username: { in: USERNAMES } } })
  await prisma.temple.deleteMany({ where: { name: 'Family Test Temple' } })

  const temple = await prisma.temple.create({
    data: { name: 'Family Test Temple', districtId: district.id },
  })
  templeId = temple.id

  const hash = await bcrypt.hash('Test@1234', 10)
  await prisma.user.create({
    data: {
      username: 'fam_admin',
      password: hash,
      roleId: adminRole.id,
      temples: { connect: { id: templeId } },
    },
  })
  adminToken = jwt.sign(
    {
      userId: 9101,
      username: 'fam_admin',
      roleId: adminRole.id,
      roleName: 'admin',
      permissions: ['families:create', 'families:read', 'families:update', 'families:delete'],
      templeIds: [templeId],
    },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  )

  // An account that already exists for FAMILY2_PHONE (should be linked, not recreated).
  await prisma.user.create({
    data: {
      username: 'existing_member',
      phone: FAMILY2_PHONE,
      password: hash,
      roleId: viewerRole.id,
    },
  })
})

afterAll(async () => {
  await prisma.family.deleteMany({ where: { templeId } })
  await prisma.user.deleteMany({ where: { username: { in: USERNAMES } } })
  await prisma.temple.deleteMany({ where: { id: templeId } })
  await prisma.$disconnect()
})

describe('Family management', () => {
  it('POST /families — creates a family and auto-creates a viewer login', async () => {
    const res = await request(app)
      .post('/api/v1/families')
      .set('Cookie', `access_token=${adminToken}`)
      .send({
        headName: 'Kumar',
        primaryPhone: FAMILY1_PHONE,
        children: [{ name: 'Asha', age: 8 }],
      })

    expect(res.status).toBe(201)
    expect(res.body.data.family.headName).toBe('Kumar')
    expect(res.body.data.credentials.username).toBe(FAMILY1_PHONE)
    expect(res.body.data.credentials.password).toEqual(expect.any(String))
    family1Id = res.body.data.family.id

    const viewer = await prisma.user.findFirstOrThrow({ where: { username: FAMILY1_PHONE } })
    expect(viewer.familyId).toBe(family1Id)

    viewerToken = jwt.sign(
      {
        userId: viewer.id,
        username: FAMILY1_PHONE,
        roleId: viewer.roleId,
        roleName: 'viewer',
        permissions: ['families:read'],
        templeIds: [templeId],
      },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' }
    )
  })

  it('POST /families — links an existing account instead of creating a new one', async () => {
    const res = await request(app)
      .post('/api/v1/families')
      .set('Cookie', `access_token=${adminToken}`)
      .send({ headName: 'Ravi', primaryPhone: FAMILY2_PHONE })

    expect(res.status).toBe(201)
    expect(res.body.data.credentials).toBeNull() // no new account, no SMS
    family2Id = res.body.data.family.id

    const linked = await prisma.user.findFirstOrThrow({ where: { username: 'existing_member' } })
    expect(linked.familyId).toBe(family2Id)
  })

  it('POST /families — rejects a duplicate phone in the same temple (409)', async () => {
    const res = await request(app)
      .post('/api/v1/families')
      .set('Cookie', `access_token=${adminToken}`)
      .send({ headName: 'Dup', primaryPhone: FAMILY1_PHONE })

    expect(res.status).toBe(409)
  })

  it('GET /families — admin lists all families in the active temple', async () => {
    const res = await request(app)
      .get('/api/v1/families')
      .set('Cookie', `access_token=${adminToken}`)

    expect(res.status).toBe(200)
    const templeIds: number[] = res.body.data.families.map((f: { templeId: number }) => f.templeId)
    expect(templeIds.length).toBeGreaterThanOrEqual(2)
    expect(templeIds.every((t) => t === templeId)).toBe(true)
  })

  it('GET /families — a viewer sees only their own family', async () => {
    const res = await request(app)
      .get('/api/v1/families')
      .set('Cookie', `access_token=${viewerToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data.families).toHaveLength(1)
    expect(res.body.data.families[0].id).toBe(family1Id)
  })

  it("GET /families/:id — a viewer cannot read another family's record (404)", async () => {
    const res = await request(app)
      .get(`/api/v1/families/${family2Id}`)
      .set('Cookie', `access_token=${viewerToken}`)

    expect(res.status).toBe(404)
  })

  it('PUT /families/:id — admin updates head name and children', async () => {
    const res = await request(app)
      .put(`/api/v1/families/${family1Id}`)
      .set('Cookie', `access_token=${adminToken}`)
      .send({ headName: 'Kumar S', children: [{ name: 'Asha', age: 9 }] })

    expect(res.status).toBe(200)
    expect(res.body.data.family.headName).toBe('Kumar S')
  })

  it('DELETE /families/:id — removes the family and its linked viewer account', async () => {
    const res = await request(app)
      .delete(`/api/v1/families/${family1Id}`)
      .set('Cookie', `access_token=${adminToken}`)

    expect(res.status).toBe(200)
    const viewer = await prisma.user.findFirst({ where: { username: FAMILY1_PHONE } })
    expect(viewer).toBeNull()
  })
})
