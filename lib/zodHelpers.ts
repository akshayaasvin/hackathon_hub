import { z } from 'zod'

/**
 * An optional text field: accepts a string, `null`, `undefined`, or a missing key, and
 * normalizes all of the empty cases to `''` before validating length. Replaces the fragile
 * `z.string().trim().max(n).optional().or(z.literal(''))` pattern, whose default error for
 * anything that isn't EXACTLY a string or exactly `''` is Zod v4's generic union-mismatch
 * message — literally the words "Invalid input", with no field name — e.g. for a value of
 * `null` (which came from a nullable database column being echoed straight back into a
 * form value with no normalization first, one real way this happened) `null` matches
 * neither branch of that union and fails with an unnamed error the admin (and anyone
 * debugging it) can't act on. This version can only fail on a real max-length violation,
 * which gets a specific message. See app/api/admin/internships/route.ts.
 */
export function optionalText(max: number) {
  return z.preprocess(
    (v) => (v === null || v === undefined ? '' : v),
    z.string().trim().max(max)
  )
}
