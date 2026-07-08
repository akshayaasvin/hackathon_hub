import { z } from 'zod'

const phone = z
  .string()
  .trim()
  .min(7, 'Enter a valid phone number')
  .max(20, 'Enter a valid phone number')
  .regex(/^[0-9+\-\s()]+$/, 'Enter a valid phone number')

// Minimum registrable age, in years. Confirmed with the platform owner.
export const MIN_PARTICIPANT_AGE_YEARS = 13

function isAtLeastAge(value: string, years: number): boolean {
  const dob = new Date(value)
  if (Number.isNaN(dob.getTime())) return false
  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - years)
  cutoff.setHours(0, 0, 0, 0)
  return dob.getTime() <= cutoff.getTime()
}

const dateOfBirth = z
  .string()
  .trim()
  .min(1, 'Date of birth is required')
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Enter a valid date')
  .refine((value) => new Date(value).getTime() <= Date.now(), 'Date of birth cannot be in the future')
  .refine(
    (value) => isAtLeastAge(value, MIN_PARTICIPANT_AGE_YEARS),
    `You must be at least ${MIN_PARTICIPANT_AGE_YEARS} years old to register`
  )

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
  date_of_birth: dateOfBirth,
})
export type ParticipantRegisterInput = z.infer<typeof participantRegisterSchema>

export const collegeRegisterSchema = z.object({
  role: z.literal('college'),
  college_name: z.string().trim().min(2, 'College name is required'),
  representative_name: z.string().trim().min(2, "Representative's name is required"),
  position_in_college: z.string().trim().min(2, 'Position is required'),
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
// profile fields as self-serve registration. No password field: the server
// generates one and returns it once so the admin can copy/share it, instead
// of the admin choosing (and potentially reusing/weak-ing) a password.
export const adminCreateCollegeSchema = collegeRegisterSchema
export type AdminCreateCollegeInput = z.infer<typeof adminCreateCollegeSchema>

export const adminCreateJurySchema = juryRegisterSchema
export type AdminCreateJuryInput = z.infer<typeof adminCreateJurySchema>

export const adminCreateSchema = z.discriminatedUnion('role', [
  adminCreateCollegeSchema,
  adminCreateJurySchema,
])
export type AdminCreateInput = z.infer<typeof adminCreateSchema>
