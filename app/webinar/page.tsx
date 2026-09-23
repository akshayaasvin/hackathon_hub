import { createAdminClient } from '@/lib/supabase/admin'
import { WebinarRegistration, type PublicWebinar } from '@/components/webinar/WebinarRegistration'
import { parseQuestions } from '@/lib/webinarQuestions'

// Public page: https://hackathon.adz4needz.com/webinar
// A real App Router route, so opening or refreshing /webinar directly never 404s.
// Reads through the service-role client with an explicit column list, so the
// (private) join link is never sent to the browser here.
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Webinars | HackathonHub',
  description: 'Register for upcoming HackathonHub webinars.',
}

export default async function WebinarPage({ searchParams }: { searchParams: { w?: string } }) {
  let webinars: PublicWebinar[] = []
  let loadFailed = false

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('webinars')
      .select('id, title, description, starts_at, fee, currency, questions')
      .eq('status', 'published')
      .is('deleted_at', null)
      .order('starts_at', { ascending: true, nullsFirst: false })
    if (error) throw error
    webinars = (data ?? []).map((w: any) => ({
      id: w.id,
      title: w.title,
      description: w.description,
      startsAt: w.starts_at,
      fee: Number(w.fee),
      currency: w.currency || 'INR',
      questions: parseQuestions(w.questions),
    }))
  } catch (err) {
    console.error('[webinar page] could not load webinars:', err)
    loadFailed = true
  }

  return (
    <div className="premium-container fade-in" style={{ maxWidth: '760px' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '34px', fontFamily: 'var(--font-display)', marginBottom: '10px' }}>Webinars</h1>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Live sessions from the HackathonHub community. Reserve your spot below.
        </p>
      </div>

      {loadFailed ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px 24px', borderLeft: '4px solid var(--danger)' }}>
          <h3 style={{ marginBottom: '8px' }}>We couldn&apos;t load the webinars</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Please refresh the page in a moment.</p>
        </div>
      ) : webinars.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <h3 style={{ marginBottom: '8px' }}>No webinars are open right now</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Check back soon — new sessions are announced regularly.</p>
        </div>
      ) : (
        <WebinarRegistration webinars={webinars} initialWebinarId={searchParams?.w} />
      )}
    </div>
  )
}
