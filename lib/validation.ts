import { z } from 'zod'

const phone = z
  .string()
  .trim()
  .min(7, 'Enter a valid phone number')
  .max(20, 'Enter a valid phone number')
  .regex(/^[0-9+\-\s()]+$/, 'Enter a valid phone number')

export const participantRegisterSchema = z.object({
  role: z.literal('participant'),
  full_name: z.string().trim().min(2, 'Full name is required'),
  email: z.email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  college_name: z.string().trim().min(2, 'College name is required'),
  passout_year: z.coerce.number().int().min(1990).max(2100),
  degree: z.string().trim().min(2, 'Degree is required'),
  domain: z.string().trim().min(2, 'Domain / branch is required'),
  experience_level: z.enum(['fresher', 'experienced']),
  contact_number: phone,
  address: z.string().trim().min(5, 'Address is required'),
})
export type ParticipantRegisterInput = z.infer<typeof participantRegisterSchema>

export const collegeRegisterSchema = z.object({
  role: z.literal('college'),
  college_name: z.string().trim().min(2, 'College name is required'),
  representative_name: z.string().trim().min(2, "Representative's name is required"),
  position_in_college: z.string().trim().min(2, 'Position is required'),
  date_of_birth: z.string().trim().optional().or(z.literal('')),
  official_email: z.email('Enter a valid official email address'),
  personal_email: z.email('Enter a valid personal email address').optional().or(z.literal('')),
  contact_number: phone,
  department: z.string().trim().optional().or(z.literal('')),
  college_address: z.string().trim().min(5, 'College address is required'),
})
export type CollegeRegisterInput = z.infer<typeof collegeRegisterSchema>

export const juryRegisterSchema = z.object({
  role: z.literal('jury'),
  full_name: z.string().trim().min(2, 'Full name is required'),
  contact_number: phone,
  email: z.email('Enter a valid email address'),
  official_email: z.email('Enter a valid official email address').optional().or(z.literal('')),
  organization_name: z.string().trim().optional().or(z.literal('')),
  portfolio_url: z.url('Enter a valid URL').optional().or(z.literal('')),
  occupation: z.string().trim().min(2, 'Occupation is required'),
  experience_years: z.coerce.number().int().min(0).max(60).optional(),
  date_of_birth: z.string().trim().optional().or(z.literal('')),
  location: z.string().trim().min(2, 'Location is required'),
})
export type JuryRegisterInput = z.infer<typeof juryRegisterSchema>

export const registerSchema = z.discriminatedUnion('role', [
  participantRegisterSchema,
  collegeRegisterSchema,
  juryRegisterSchema,
])
export type RegisterInput = z.infer<typeof registerSchema>

// Used by the admin "manual create" flow (admin/colleges, admin/jury) — same
// profile fields as self-serve registration, plus a password the admin sets directly.
export const adminCreateCollegeSchema = collegeRegisterSchema.extend({
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
export type AdminCreateCollegeInput = z.infer<typeof adminCreateCollegeSchema>

export const adminCreateJurySchema = juryRegisterSchema.extend({
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
export type AdminCreateJuryInput = z.infer<typeof adminCreateJurySchema>

export const adminCreateSchema = z.discriminatedUnion('role', [
  adminCreateCollegeSchema,
  adminCreateJurySchema,
])
export type AdminCreateInput = z.infer<typeof adminCreateSchema>
