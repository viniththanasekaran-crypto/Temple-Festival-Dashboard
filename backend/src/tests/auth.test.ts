import request from 'supertest'
import bcrypt from 'bcrypt'
import app from '../app'
import prisma from '../lib/prisma'

const TEST_USER = {
  username: 'test_admin',
  password: 'Test@1234',
  role: 'admin' as const,
  templeId: null,
}

beforeAll(async () => {
  await prisma.refreshToken.deleteMany()
  await prisma.user.deleteMany({ where: { username: TEST_USER.username } })

  await prisma.user.create({
    data: {
      username: TEST_USER.username,
      password: await bcrypt.hash(TEST_USER.password, 10),
      role: TEST_USER.role,
    },
  })
})

afterAll(async () => {
  await prisma.refreshToken.deleteMany()
  await prisma.user.deleteMany({ where: { username: TEST_USER.username } })
  await prisma.$disconnect()
})

describe('POST /api/v1/auth/login', () => {
  it('returns 200 and sets cookies on valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: TEST_USER.username, password: TEST_USER.password })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.user.username).toBe(TEST_USER.username)
    expect(res.headers['set-cookie']).toBeDefined()
  })

  it('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: TEST_USER.username, password: 'wrongpassword' })

    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
  })

  it('returns 401 on unknown username', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'nobody', password: 'anything' })

    expect(res.status).toBe(401)
  })

  it('returns 400 on missing fields', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ username: '' })

    expect(res.status).toBe(400)
  })
})

describe('POST /api/v1/auth/refresh', () => {
  it('returns 401 when no refresh token cookie', async () => {
    const res = await request(app).post('/api/v1/auth/refresh')
    expect(res.status).toBe(401)
  })

  it('issues a new access token with valid refresh token', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: TEST_USER.username, password: TEST_USER.password })

    const cookies = loginRes.headers['set-cookie'] as unknown as string[]
    const refreshCookie = cookies.find((c: string) => c.startsWith('refresh_token='))

    const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', refreshCookie!)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})

describe('POST /api/v1/auth/logout', () => {
  it('clears cookies and returns success', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: TEST_USER.username, password: TEST_USER.password })

    const cookies = loginRes.headers['set-cookie'] as unknown as string[]

    const res = await request(app).post('/api/v1/auth/logout').set('Cookie', cookies.join('; '))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})
