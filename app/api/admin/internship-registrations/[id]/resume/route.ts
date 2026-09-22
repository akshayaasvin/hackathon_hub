import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/requireAdmin'
import { apiSuccess, apiError } from '@/lib/apiResponse'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Admin-only: a short-lived signed URL to view/download one applicant's resume from the
// private 'internship-resumes' bucket (section 18: "secure resume/file uploads" — nothing
// in that bucket is ever public or browser-writable; this is the only way in).
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    if (!(await requireAdmin())) return apiError('Forbidden — admin access required.', 403)
    if (!UUID_RE.test(params.id)) return apiError('Registration not found.', 404)

    const admin = createAdminClient()
    const { data: registration, error } = await admin
      .from('internship_registrations')
      .select('resume_path')
      .eq('id', params.id)
      .maybeSingle()
    if (error) throw error
    if (!registration?.resume_path) return apiError('No resume on file for this registration.', 404)

    const { data: signed, error: signError } = await admin.storage
      .from('internship-resumes')
      .createSignedUrl(registration.resume_path, 300) // 5 minutes
    if (signError || !signed) throw signError || new Error('Could not sign URL.')

    return apiSuccess({ url: signed.signedUrl }, 'OK')
  } catch (err) {
    console.error('[admin internship resume] failed:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
