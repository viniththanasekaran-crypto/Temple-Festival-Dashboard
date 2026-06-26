import { z } from 'zod'

const phoneE164 = z.string().regex(/^\+91\d{10}$/, 'Phone must be in +91XXXXXXXXXX format')

export const createFestivalSchema = z.object({
  name: z.string().min(2).max(150),
  description: z.string().max(1000).optional(),
  headName: z.string().max(100).optional(),
  headPhone: phoneE164.optional(),
  phone2: phoneE164.optional(),
  phone3: phoneE164.optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  fixedAmount: z.number().positive(),
  isActive: z.boolean().optional(),
})

export const updateFestivalSchema = createFestivalSchema.partial()

export type CreateFestivalInput = z.infer<typeof createFestivalSchema>
export type UpdateFestivalInput = z.infer<typeof updateFestivalSchema>
