import type { Request, Response } from 'express'
import { createFamilySchema, updateFamilySchema } from '../schemas/family.schema'
import * as familyService from '../services/family.service'

function templeId(req: Request): number {
  return req.templeId!
}

function isViewer(req: Request): boolean {
  return req.user!.roleName === 'viewer'
}

export async function listFamiliesHandler(req: Request, res: Response) {
  const families = isViewer(req)
    ? await familyService.listOwnFamily(templeId(req), req.user!.userId)
    : await familyService.listFamilies(templeId(req))
  res.json({ success: true, data: { families } })
}

export async function getFamilyHandler(req: Request, res: Response) {
  const id = Number(req.params.id)
  if (isNaN(id)) {
    res.status(400).json({ success: false, message: 'Invalid family id' })
    return
  }
  try {
    const family = await familyService.getFamily(templeId(req), id)
    // A viewer may only read the family linked to their own account.
    if (isViewer(req) && family.user?.id !== req.user!.userId) {
      res.status(404).json({ success: false, message: 'Family not found' })
      return
    }
    res.json({ success: true, data: { family } })
  } catch {
    res.status(404).json({ success: false, message: 'Family not found' })
  }
}

export async function createFamilyHandler(req: Request, res: Response) {
  const parsed = createFamilySchema.safeParse(req.body)
  if (!parsed.success) {
    res
      .status(400)
      .json({ success: false, message: 'Validation error', errors: parsed.error.issues })
    return
  }
  try {
    const { family, credentials } = await familyService.createFamily(templeId(req), parsed.data)
    res.status(201).json({ success: true, data: { family, credentials } })
  } catch (err) {
    const msg = (err as Error).message ?? ''
    if (msg.includes('Unique constraint') || msg.includes('unique')) {
      res
        .status(409)
        .json({ success: false, message: 'A family with this phone already exists in this temple' })
    } else {
      throw err
    }
  }
}

export async function updateFamilyHandler(req: Request, res: Response) {
  const id = Number(req.params.id)
  if (isNaN(id)) {
    res.status(400).json({ success: false, message: 'Invalid family id' })
    return
  }
  const parsed = updateFamilySchema.safeParse(req.body)
  if (!parsed.success) {
    res
      .status(400)
      .json({ success: false, message: 'Validation error', errors: parsed.error.issues })
    return
  }
  try {
    const family = await familyService.updateFamily(templeId(req), id, parsed.data)
    res.json({ success: true, data: { family } })
  } catch {
    res.status(404).json({ success: false, message: 'Family not found' })
  }
}

export async function deleteFamilyHandler(req: Request, res: Response) {
  const id = Number(req.params.id)
  if (isNaN(id)) {
    res.status(400).json({ success: false, message: 'Invalid family id' })
    return
  }
  try {
    await familyService.deleteFamily(templeId(req), id)
    res.json({ success: true })
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'HAS_DEPENDENCIES') {
      res.status(409).json({ success: false, message: (err as Error).message })
    } else {
      res.status(404).json({ success: false, message: 'Family not found' })
    }
  }
}
