import { z } from 'zod'

const phoneE164 = z
  .string()
  .regex(/^\+91\d{10}$/, 'Phone must be in +91XXXXXXXXXX format')
  .optional()

export const createTempleSchema = z.object({
  name: z.string().min(2).max(100),
  deity: z.string().max(100).optional(),
  village: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  phone: phoneE164,
  districtId: z.number().int().positive(),
})

export const updateTempleSchema = createTempleSchema.partial()

export type CreateTempleInput = z.infer<typeof createTempleSchema>
export type UpdateTempleInput = z.infer<typeof updateTempleSchema>
