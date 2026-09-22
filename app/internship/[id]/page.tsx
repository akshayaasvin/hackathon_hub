import InternshipFlow from '@/components/internship/InternshipFlow'

// Public page: https://hackathon.adz4needz.com/internship/<id> — the whole applicant
// journey (details -> assessment if enabled -> registration -> payment if paid ->
// confirmation) lives in InternshipFlow, entirely without HackathonHub login (section 2/20).
export const metadata = {
  title: 'Internship | HackathonHub',
}

export default function InternshipDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="premium-container fade-in" style={{ maxWidth: '760px' }}>
      <InternshipFlow internshipId={params.id} />
    </div>
  )
}
