import type { Request, Response } from 'express'
import { createUserSchema, updateUserSchema } from '../schemas/user.schema'
import * as userService from '../services/user.service'

export async function listUsersHandler(req: Request, res: Response) {
  const users = await userService.listUsers()
  res.json({ success: true, data: { users } })
}

export async function createUserHandler(req: Request, res: Response) {
  const parsed = createUserSchema.safeParse(req.body)
  if (!parsed.success) {
    res
      .status(400)
      .json({ success: false, message: 'Validation error', errors: parsed.error.issues })
    return
  }
  try {
    const { user, password } = await userService.createUser(parsed.data)
    res.status(201).json({ success: true, data: { user, password } })
  } catch (err) {
    const msg = (err as Error).message ?? ''
    if (msg.includes('Unique constraint') || msg.includes('unique')) {
      res.status(409).json({ success: false, message: 'Username already exists' })
    } else {
      throw err
    }
  }
}

export async function updateUserHandler(req: Request, res: Response) {
  const id = Number(req.params.id)
  if (isNaN(id)) {
    res.status(400).json({ success: false, message: 'Invalid user id' })
    return
  }
  const parsed = updateUserSchema.safeParse(req.body)
  if (!parsed.success) {
    res
      .status(400)
      .json({ success: false, message: 'Validation error', errors: parsed.error.issues })
    return
  }
  try {
    const user = await userService.updateUser(id, parsed.data)
    res.json({ success: true, data: { user } })
  } catch {
    res.status(404).json({ success: false, message: 'User not found' })
  }
}

export async function deactivateUserHandler(req: Request, res: Response) {
  const id = Number(req.params.id)
  if (isNaN(id)) {
    res.status(400).json({ success: false, message: 'Invalid user id' })
    return
  }
  try {
    const user = await userService.deactivateUser(id)
    res.json({ success: true, data: { user } })
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'NOT_FOUND') {
      res.status(404).json({ success: false, message: 'User not found' })
    } else {
      throw err
    }
  }
}
