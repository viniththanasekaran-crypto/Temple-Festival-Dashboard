import { z } from 'zod'

const phoneE164 = z.string().regex(/^\+91\d{10}$/, 'Phone must be in +91XXXXXXXXXX format')

const contactSchema = z.object({
  name: z.string().min(1).max(100),
  phone: phoneE164.optional(),
})

// Day-wise agenda entries (order = list position). Consolidated for WhatsApp
// and shown on the viewer's festival dashboard.
const agendaItemSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
})

export const createFestivalSchema = z
  .object({
    name: z.string().min(2).max(150),
    description: z.string().max(1000).optional(),
    headName: z.string().max(100).optional(),
    headPhone: phoneE164.optional(),
    phone2: phoneE164.optional(),
    phone3: phoneE164.optional(),
    contacts: z.array(contactSchema).optional(),
    agenda: z.array(agendaItemSchema).optional(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    fixedAmount: z.number().positive(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => new Date(d.endDate) >= new Date(d.startDate), {
    message: 'End date must be on or after start date',
    path: ['endDate'],
  })

export const updateFestivalSchema = z
  .object({
    name: z.string().min(2).max(150).optional(),
    description: z.string().max(1000).optional(),
    headName: z.string().max(100).optional(),
    headPhone: phoneE164.optional(),
    phone2: phoneE164.optional(),
    phone3: phoneE164.optional(),
    contacts: z.array(contactSchema).optional(),
    agenda: z.array(agendaItemSchema).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    fixedAmount: z.number().positive().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (d) => {
      if (d.startDate && d.endDate) return new Date(d.endDate) >= new Date(d.startDate)
      return true
    },
    { message: 'End date must be on or after start date', path: ['endDate'] }
  )

export type CreateFestivalInput = z.infer<typeof createFestivalSchema>
export type UpdateFestivalInput = z.infer<typeof updateFestivalSchema>
