import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

/** "Every publish action is logged (who, when)" — one call site, used by every admin route
 * in the Results flow that publishes, unpublishes, sends invites, or announces winners. */
export async function logAdminAction(
  admin: SupabaseClient,
  actorId: string,
  action: string,
  hackathonId: string,
  details?: Record<string, unknown>
) {
  const { error } = await admin.from('admin_audit_log').insert({ actor_id: actorId, action, hackathon_id: hackathonId, details: details ?? null })
  if (error) console.error(`[auditLog] failed to log "${action}" for hackathon ${hackathonId}:`, error)
}
