import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { loginSchema } from '../schemas/auth.schema'

describe('bcrypt', () => {
  it('hashes and verifies a correct password', async () => {
    const hash = await bcrypt.hash('Test@1234', 10)
    expect(await bcrypt.compare('Test@1234', hash)).toBe(true)
  })

  it('rejects a wrong password', async () => {
    const hash = await bcrypt.hash('Test@1234', 10)
    expect(await bcrypt.compare('Wrong@1234', hash)).toBe(false)
  })

  it('produces a different hash each time (salt)', async () => {
    const h1 = await bcrypt.hash('same', 10)
    const h2 = await bcrypt.hash('same', 10)
    expect(h1).not.toBe(h2)
  })
})

describe('JWT', () => {
  const SECRET = 'test_jwt_secret'
  const payload = {
    userId: 1,
    username: 'testuser',
    roleId: 2,
    roleName: 'admin',
    permissions: ['festivals:create', 'families:read'],
    templeId: 5,
  }

  it('signs and verifies a token', () => {
    const token = jwt.sign(payload, SECRET, { expiresIn: '15m' })
    const decoded = jwt.verify(token, SECRET) as typeof payload
    expect(decoded.userId).toBe(1)
    expect(decoded.username).toBe('testuser')
    expect(decoded.roleName).toBe('admin')
    expect(decoded.permissions).toEqual(['festivals:create', 'families:read'])
    expect(decoded.templeId).toBe(5)
  })

  it('rejects a token signed with the wrong secret', () => {
    const token = jwt.sign(payload, SECRET)
    expect(() => jwt.verify(token, 'wrong_secret')).toThrow()
  })

  it('rejects an expired token', async () => {
    const token = jwt.sign(payload, SECRET, { expiresIn: '1ms' })
    await new Promise((r) => setTimeout(r, 10))
    expect(() => jwt.verify(token, SECRET)).toThrow(/expired/)
  })
})

describe('loginSchema (Zod)', () => {
  it('passes with valid username and password', () => {
    expect(loginSchema.safeParse({ username: 'admin', password: 'pass' }).success).toBe(true)
  })

  it('fails when username is empty', () => {
    expect(loginSchema.safeParse({ username: '', password: 'pass' }).success).toBe(false)
  })

  it('fails when password is empty', () => {
    expect(loginSchema.safeParse({ username: 'admin', password: '' }).success).toBe(false)
  })

  it('fails when both fields are missing', () => {
    expect(loginSchema.safeParse({}).success).toBe(false)
  })
})
