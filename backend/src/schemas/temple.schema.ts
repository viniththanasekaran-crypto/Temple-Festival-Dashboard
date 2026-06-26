import { z } from 'zod'

export const createTempleSchema = z.object({
  name: z.string().min(2).max(100),
  deity: z.string().max(100).optional(),
  village: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  districtId: z.number().int().positive(),
})

export const updateTempleSchema = createTempleSchema.partial()

export type CreateTempleInput = z.infer<typeof createTempleSchema>
export type UpdateTempleInput = z.infer<typeof updateTempleSchema>
