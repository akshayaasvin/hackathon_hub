import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export const MAX_RESUME_BYTES = 3 * 1024 * 1024 // 3MB raw (base64 inflates ~33% over the wire)
const ALLOWED_EXT = new Set(['pdf', 'doc', 'docx'])

/**
 * Uploads a resume the browser sent as a data URL (`data:<mime>;base64,<data>`) to the
 * private `internship-resumes` bucket, using the SERVICE-ROLE client — this is what makes a
 * secure file upload possible on a public, unauthenticated registration route: the bucket
 * has no storage policy allowing a browser to write directly, only this server code can.
 * Returns the storage path, or throws with a message safe to show the applicant.
 */
export async function uploadResume(
  admin: SupabaseClient,
  dataUrl: string,
  internshipId: string,
  registrationId: string
): Promise<string> {
  const match = /^data:([\w./+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim())
  if (!match) throw new Error('Resume file could not be read. Please re-upload it.')
  const [, mime, base64] = match

  const extByMime: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  }
  const ext = extByMime[mime]
  if (!ext || !ALLOWED_EXT.has(ext)) throw new Error('Resume must be a PDF or Word document.')

  const buffer = Buffer.from(base64, 'base64')
  if (buffer.length === 0) throw new Error('Resume file appears to be empty.')
  if (buffer.length > MAX_RESUME_BYTES) throw new Error(`Resume must be under ${Math.floor(MAX_RESUME_BYTES / (1024 * 1024))}MB.`)

  const path = `${internshipId}/${registrationId}.${ext}`
  const { error } = await admin.storage.from('internship-resumes').upload(path, buffer, { contentType: mime, upsert: true })
  if (error) throw new Error('Could not upload resume. Please try again.')
  return path
}
