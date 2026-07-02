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
    templeIds: z.array(z.number().int().positive()).optional(),
  })
  .refine((data) => data.role !== 'admin' || (data.templeIds?.length ?? 0) > 0, {
    message: 'At least one temple is required for admin role',
    path: ['templeIds'],
  })

export const updateUserSchema = z
  .object({
    name: z.string().max(100).optional(),
    phone: z
      .string()
      .regex(/^\+91\d{10}$/, 'Phone must be in +91XXXXXXXXXX format')
      .optional(),
    role: z.enum(['super_admin', 'admin']).optional(),
    templeIds: z.array(z.number().int().positive()).optional(),
  })
  .refine(
    (data) => {
      if (data.role === 'admin' && (data.templeIds?.length ?? 0) === 0) return false
      return true
    },
    { message: 'At least one temple is required for admin role', path: ['templeIds'] }
  )

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
