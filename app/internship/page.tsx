import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { Calendar, Clock, GraduationCap, MapPin, Users } from 'lucide-react'

// Public page: https://hackathon.adz4needz.com/internship — no login required (section 2/3).
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Internships | HackathonHub',
  description: 'Apply for HackathonHub internships — no account required.',
}

interface ListedInternship {
  id: string
  title: string
  topic: string | null
  description: string | null
  duration_text: string | null
  mode: string
  is_paid: boolean
  fee: number
  currency: string
  eligibility_text: string | null
  start_date: string | null
  application_deadline: string | null
  seatsAvailable: number | null
  banner_url: string | null
}

const money = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${currency} ${amount}`
  }
}

async function loadInternships(): Promise<{ internships: ListedInternship[]; failed: boolean }> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('internships')
      .select('id, title, topic, description, duration_text, mode, is_paid, fee, currency, eligibility_text, start_date, application_deadline, seats_total, banner_url')
      .eq('status', 'published')
      .is('deleted_at', null)
      .order('application_deadline', { ascending: true, nullsFirst: false })
    if (error) throw error

    const internships = data ?? []
    let takenById = new Map<string, number>()
    if (internships.length) {
      const { data: counts } = await admin
        .from('internship_registrations')
        .select('internship_id')
        .in('internship_id', internships.map((i) => i.id))
        .in('status', ['eligible', 'payment_pending', 'registered', 'active', 'completed', 'certificate_issued'])
      takenById = new Map()
      for (const r of counts ?? []) takenById.set(r.internship_id, (takenById.get(r.internship_id) ?? 0) + 1)
    }

    return {
      internships: internships.map((i) => ({
        ...i,
        fee: Number(i.fee),
        seatsAvailable: i.seats_total != null ? Math.max(0, i.seats_total - (takenById.get(i.id) ?? 0)) : null,
      })),
      failed: false,
    }
  } catch (err) {
    console.error('[internship page] could not load internships:', err)
    return { internships: [], failed: true }
  }
}

export default async function InternshipListPage() {
  const { internships, failed } = await loadInternships()

  return (
    <div className="premium-container fade-in">
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '34px', fontFamily: 'var(--font-display)', marginBottom: '10px' }}>Internships</h1>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '560px', margin: '0 auto' }}>
          Apply directly — no HackathonHub account needed. Register, complete the eligibility check if one applies, and you&apos;re in.
        </p>
      </div>

      {failed ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px 24px', borderLeft: '4px solid var(--danger)' }}>
          <h3 style={{ marginBottom: '8px' }}>We couldn&apos;t load internships</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Please refresh the page in a moment.</p>
        </div>
      ) : internships.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <h3 style={{ marginBottom: '8px' }}>No internships are open right now</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Check back soon — new internships are announced regularly.</p>
        </div>
      ) : (
        <div className="responsive-card-grid">
          {internships.map((i) => (
            <div key={i.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                {i.banner_url && (
                  <img src={i.banner_url} alt={i.title} style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '10px', marginBottom: '14px' }} />
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <h3 style={{ fontSize: '18px', color: 'var(--text-primary)' }}>{i.title}</h3>
                  <span style={{ fontWeight: 700, whiteSpace: 'nowrap', color: i.is_paid ? 'var(--primary)' : 'var(--success)' }}>
                    {i.is_paid ? money(i.fee, i.currency) : 'Unpaid'}
                  </span>
                </div>
                {i.topic && <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '10px' }}>{i.topic}</p>}
                {i.description && (
                  <p
                    style={{
                      color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6, marginBottom: '14px',
                      display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}
                  >
                    {i.description}
                  </p>
                )}
                <div style={{ display: 'grid', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '18px' }}>
                  {i.duration_text && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={14} /> {i.duration_text}
                    </span>
                  )}
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'capitalize' }}>
                    <MapPin size={14} /> {i.mode}
                  </span>
                  {i.eligibility_text && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <GraduationCap size={14} /> {i.eligibility_text}
                    </span>
                  )}
                  {i.start_date && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={14} /> Starts {new Date(i.start_date).toLocaleDateString()}
                    </span>
                  )}
                  {i.application_deadline && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={14} /> Apply by {new Date(i.application_deadline).toLocaleDateString()}
                    </span>
                  )}
                  {i.seatsAvailable != null && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Users size={14} /> {i.seatsAvailable} seat{i.seatsAvailable === 1 ? '' : 's'} available
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <Link href={`/internship/${i.id}`} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
                  View Details
                </Link>
                {/* Skips straight past the details screen into the registration/payment
                    flow — "View Details" still lands on that screen for anyone who wants
                    to read first (it has its own Register Now button too). */}
                <Link href={`/internship/${i.id}?start=1`} className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                  Register Now
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <p style={{ textAlign: 'center', marginTop: '32px', fontSize: '13px', color: 'var(--text-muted)' }}>
        Already applied?{' '}
        <Link href="/internship/status" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
          Check your application status
        </Link>
      </p>
    </div>
  )
}
