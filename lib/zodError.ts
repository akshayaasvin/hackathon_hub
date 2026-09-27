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

/**
 * Same issues, keyed by each one's top-level field name instead of joined into one string —
 * for forms that show an error inline under the field it belongs to (see apiError's
 * fieldErrors argument) rather than only in a generic top-of-form banner. Only the first
 * issue per field is kept; a path-less issue (rare — a refinement on the whole object) is
 * dropped, since there's no single field to attach it to and the caller's plain `message`
 * already covers that case as a fallback banner.
 */
export function zodFieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key !== 'string' || key in out) continue
    out[key] = issue.message
  }
  return out
}
