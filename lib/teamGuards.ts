import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Whether a team's membership can still change at all: before hackathons.round1_deadline (if
 * one is set) AND the team has not submitted anything yet. Shared by every route that changes
 * who's on a team (invite accept, remove, leave, disband, transfer leadership) so "locked
 * after Round 1" (Phase 3, section 4) is enforced in exactly one place rather than re-checked
 * — and potentially re-implemented slightly differently — six times.
 */
// `message` is always present (empty when ok) rather than a `{ok:true} | {ok:false,message}`
// discriminated union — this project's tsconfig has strict:false and doesn't separately set
// strictNullChecks, and TypeScript's control-flow narrowing on a boolean-literal discriminant
// needs strictNullChecks to correctly exclude the non-matching branch; without it, `guard.ok
// === false` still leaves `guard` typed as the full union and `guard.message` fails to
// compile at every call site. Always having `message` sidesteps needing that narrowing at all.
export async function canModifyTeamMembership(
  admin: SupabaseClient,
  teamId: string,
  hackathonId: string
): Promise<{ ok: boolean; message: string }> {
  const { data: hackathon } = await admin.from('hackathons').select('round1_deadline').eq('id', hackathonId).maybeSingle()
  if (hackathon?.round1_deadline && new Date(hackathon.round1_deadline).getTime() < Date.now()) {
    return { ok: false, message: 'Team changes are locked — the Round 1 deadline has passed.' }
  }

  const { count } = await admin.from('submissions').select('id', { count: 'exact', head: true }).eq('team_id', teamId)
  if ((count ?? 0) > 0) {
    return { ok: false, message: 'Team changes are locked — this team has already submitted and can no longer add, remove, or change members.' }
  }

  return { ok: true, message: '' }
}
