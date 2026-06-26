import { z } from 'zod'

export const createUserSchema = z
  .object({
    username: z.string().min(3).max(50).regex(/^\S+$/, 'Username must not contain spaces'),
    name: z.string().max(100).optional(),
    phone: z
      .string()
      .regex(/^\+91\d{10}$/, 'Phone must be in +91XXXXXXXXXX format')
      .optional(),
    role: z.enum(['super_admin', 'admin']),
    templeId: z.number().int().positive().optional(),
  })
  .refine((data) => data.role !== 'admin' || data.templeId != null, {
    message: 'templeId is required for admin role',
    path: ['templeId'],
  })

export const updateUserSchema = z
  .object({
    name: z.string().max(100).optional(),
    phone: z
      .string()
      .regex(/^\+91\d{10}$/, 'Phone must be in +91XXXXXXXXXX format')
      .optional(),
    role: z.enum(['super_admin', 'admin']).optional(),
    templeId: z.number().int().positive().nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.role === 'admin' && data.templeId == null) return false
      return true
    },
    { message: 'templeId is required for admin role', path: ['templeId'] }
  )

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
