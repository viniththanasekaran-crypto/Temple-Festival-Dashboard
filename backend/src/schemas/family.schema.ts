import { z } from 'zod'

const childSchema = z.object({
  name: z.string().min(1).max(100),
  age: z.number().int().min(0).max(150),
})

export const createFamilySchema = z.object({
  headName: z.string().min(2).max(150),
  primaryPhone: z.string().regex(/^\+91\d{10}$/, 'Phone must be in +91XXXXXXXXXX format'),
  address: z.string().max(500).optional(),
  children: z.array(childSchema).optional(),
})

// Phone is intentionally omitted — changing it would desync the linked viewer login.
export const updateFamilySchema = z.object({
  headName: z.string().min(2).max(150).optional(),
  address: z.string().max(500).optional(),
  children: z.array(childSchema).optional(),
})

export type CreateFamilyInput = z.infer<typeof createFamilySchema>
export type UpdateFamilyInput = z.infer<typeof updateFamilySchema>
