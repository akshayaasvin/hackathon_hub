import type { ZodError } from 'zod'

/**
 * Turns every failing field into one readable message, e.g. "title: Title is required;
 * seatsTotal: Number must be greater than 0" — instead of only the first issue (which can
 * read as a generic "Invalid input" for a field with no custom .min()/.email() message,
 * leaving no way to tell which field actually failed).
 */
export function formatZodError(error: ZodError): string {
  const parts = error.issues.map((issue) => {
    const path = issue.path.join('.')
    return path ? `${path}: ${issue.message}` : issue.message
  })
  return parts.join('; ') || 'Invalid input.'
}
