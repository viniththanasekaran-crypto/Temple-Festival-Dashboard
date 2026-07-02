import type { Request, Response } from 'express'
import { createFestivalSchema, updateFestivalSchema } from '../schemas/festival.schema'
import * as festivalService from '../services/festival.service'

function templeId(req: Request): number {
  return req.user!.templeId!
}

export async function listFestivalsHandler(req: Request, res: Response) {
  const festivals = await festivalService.listFestivals(templeId(req))
  res.json({ success: true, data: { festivals } })
}

export async function getFestivalHandler(req: Request, res: Response) {
  const id = Number(req.params.id)
  if (isNaN(id)) {
    res.status(400).json({ success: false, message: 'Invalid festival id' })
    return
  }
  try {
    const festival = await festivalService.getFestival(templeId(req), id)
    res.json({ success: true, data: { festival } })
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'NOT_FOUND') {
      res.status(404).json({ success: false, message: 'Festival not found' })
    } else throw err
  }
}

export async function createFestivalHandler(req: Request, res: Response) {
  const parsed = createFestivalSchema.safeParse(req.body)
  if (!parsed.success) {
    res
      .status(400)
      .json({ success: false, message: 'Validation error', errors: parsed.error.issues })
    return
  }
  const festival = await festivalService.createFestival(templeId(req), parsed.data)
  res.status(201).json({ success: true, data: { festival } })
}

export async function updateFestivalHandler(req: Request, res: Response) {
  const id = Number(req.params.id)
  if (isNaN(id)) {
    res.status(400).json({ success: false, message: 'Invalid festival id' })
    return
  }
  const parsed = updateFestivalSchema.safeParse(req.body)
  if (!parsed.success) {
    res
      .status(400)
      .json({ success: false, message: 'Validation error', errors: parsed.error.issues })
    return
  }
  try {
    const festival = await festivalService.updateFestival(templeId(req), id, parsed.data)
    res.json({ success: true, data: { festival } })
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'NOT_FOUND')
      res.status(404).json({ success: false, message: 'Festival not found' })
    else throw err
  }
}

export async function deleteFestivalHandler(req: Request, res: Response) {
  const id = Number(req.params.id)
  if (isNaN(id)) {
    res.status(400).json({ success: false, message: 'Invalid festival id' })
    return
  }
  try {
    await festivalService.deleteFestival(templeId(req), id)
    res.json({ success: true, message: 'Festival deleted' })
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'NOT_FOUND')
      res.status(404).json({ success: false, message: 'Festival not found' })
    else if (code === 'HAS_DEPENDENCIES')
      res.status(409).json({ success: false, message: (err as Error).message })
    else throw err
  }
}
