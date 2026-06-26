import type { Request, Response } from 'express'
import { createTempleSchema, updateTempleSchema } from '../schemas/temple.schema'
import * as templeService from '../services/temple.service'

export async function listTemplesHandler(req: Request, res: Response) {
  const temples = await templeService.listTemples()
  res.json({ success: true, data: { temples } })
}

export async function createTempleHandler(req: Request, res: Response) {
  const parsed = createTempleSchema.safeParse(req.body)
  if (!parsed.success) {
    res
      .status(400)
      .json({ success: false, message: 'Validation error', errors: parsed.error.issues })
    return
  }
  const temple = await templeService.createTemple(parsed.data)
  res.status(201).json({ success: true, data: { temple } })
}

export async function updateTempleHandler(req: Request, res: Response) {
  const id = Number(req.params.id)
  if (isNaN(id)) {
    res.status(400).json({ success: false, message: 'Invalid temple id' })
    return
  }
  const parsed = updateTempleSchema.safeParse(req.body)
  if (!parsed.success) {
    res
      .status(400)
      .json({ success: false, message: 'Validation error', errors: parsed.error.issues })
    return
  }
  try {
    const temple = await templeService.updateTemple(id, parsed.data)
    res.json({ success: true, data: { temple } })
  } catch {
    res.status(404).json({ success: false, message: 'Temple not found' })
  }
}

export async function deleteTempleHandler(req: Request, res: Response) {
  const id = Number(req.params.id)
  if (isNaN(id)) {
    res.status(400).json({ success: false, message: 'Invalid temple id' })
    return
  }
  try {
    await templeService.deleteTemple(id)
    res.json({ success: true, message: 'Temple deleted' })
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'NOT_FOUND') {
      res.status(404).json({ success: false, message: 'Temple not found' })
    } else if (code === 'HAS_DEPENDENCIES') {
      res.status(409).json({ success: false, message: (err as Error).message })
    } else {
      throw err
    }
  }
}
