'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Award, Download, ShieldCheck, Calendar, Sparkles } from 'lucide-react'

export default function CertificatesPage() {
  const [user, setUser] = useState<any>(null)
  const [myCertificates, setMyCertificates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadCertificates()
  }, [])

  const loadCertificates = async () => {
    try {
      setLoading(true)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)

      // Get user's certificates
      const { data: certificates } = await supabase
        .from('certificates')
        .select('*')
        .eq('user_id', user.id)

      // Resolve this user's team per hackathon (certificates aren't linked to a team directly)
      const { data: myTeamMemberships } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
      const myTeamIds = (myTeamMemberships || []).map((tm: any) => tm.team_id)

      const [{ data: teams }, { data: hackathons }, { data: winners }] = await Promise.all([
        myTeamIds.length
          ? supabase.from('teams').select('id, team_name, hackathon_id').in('id', myTeamIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from('hackathons').select('id, name'),
        myTeamIds.length
          ? supabase.from('winners').select('*').in('team_id', myTeamIds)
          : Promise.resolve({ data: [] as any[] }),
      ])

      // Combine data
      const enrichedCertificates = (certificates || []).map(cert => {
        const team = teams?.find(t => t.hackathon_id === cert.hackathon_id)
        const hackathon = hackathons?.find(h => h.id === cert.hackathon_id)
        const winner = team ? winners?.find(w => w.team_id === team.id) : null
        return {
          ...cert,
          team_name: team?.team_name || 'Individual Entry',
          hackathon_name: hackathon?.name || 'Unknown Hackathon',
          rank: winner?.rank || (cert.certificate_type === 'winner' ? 1 : 0),
          prize: winner?.prize_amount || 0
        }
      })

      setMyCertificates(enrichedCertificates)
      
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadCertificate = async (certificate: any) => {
    try {
      setGenerating(true)
      
      const rank = certificate.rank || 1
      const medalIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'
      const rankText = rank === 1 ? 'FIRST' : rank === 2 ? 'SECOND' : 'THIRD'
      const medalColor = rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : '#CD7F32'

      const certificateHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Certificate of Achievement</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;800&family=Montserrat:wght@300;500;700&display=swap');
            
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Montserrat', sans-serif;
              background: radial-gradient(circle, #1a1b3a 0%, #0c0d21 100%);
              min-height: 100vh;
              display: flex;
              justify-content: center;
              align-items: center;
              padding: 20px;
              color: #f3f4f6;
            }
            .certificate-frame {
              background: #fff;
              color: #0b0f19;
              width: 960px;
              padding: 50px;
              border-radius: 8px;
              box-shadow: 0 25px 60px rgba(0,0,0,0.6);
              position: relative;
              border: 18px double ${medalColor};
            }
            .certificate-inner {
              border: 2px solid rgba(0,0,0,0.15);
              padding: 40px;
              text-align: center;
              position: relative;
            }
            .watermark {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              font-size: 150px;
              opacity: 0.03;
              font-family: 'Cinzel', serif;
              pointer-events: none;
              z-index: 1;
            }
            .content-container {
              position: relative;
              z-index: 2;
            }
            .medal { font-size: 80px; margin-bottom: 16px; display: block; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.15)); }
            .title { 
              font-family: 'Cinzel', serif;
              font-size: 34px; 
              font-weight: 800;
              letter-spacing: 0.1em;
              color: #1e1b4b; 
              margin-bottom: 8px; 
            }
            .divider {
              width: 150px;
              height: 2px;
              background: ${medalColor};
              margin: 15px auto 25px auto;
            }
            .subtitle { font-size: 15px; text-transform: uppercase; letter-spacing: 0.15em; color: #6b7280; margin-bottom: 24px; }
            .award-text { font-size: 18px; color: #4b5563; margin: 15px 0; }
            .rank { font-family: 'Cinzel', serif; font-size: 40px; font-weight: 800; color: ${medalColor}; margin: 20px 0; letter-spacing: 0.05em; }
            .team-name { font-family: 'Cinzel', serif; font-size: 38px; font-weight: 800; color: #111827; margin: 20px 0; }
            .hackathon-name { font-size: 24px; font-weight: 700; color: #4f46e5; margin: 15px 0; letter-spacing: 0.02em; }
            .date { font-size: 13px; color: #9ca3af; margin-top: 30px; font-weight: 500; }
            .signature-block {
              margin-top: 50px;
              display: flex;
              justify-content: space-between;
              padding: 0 60px;
            }
            .sign-line {
              text-align: center;
              border-top: 2px solid #374151;
              padding-top: 10px;
              width: 220px;
              font-size: 13px;
              font-weight: 600;
              color: #374151;
            }
            footer { margin-top: 40px; font-size: 11px; color: #9ca3af; letter-spacing: 0.05em; }
          </style>
        </head>
        <body>
          <div class="certificate-frame">
            <div class="certificate-inner">
              <div class="watermark">WINNER</div>
              <div class="content-container">
                <span class="medal">${medalIcon}</span>
                <h1 class="title">CERTIFICATE OF ACHIEVEMENT</h1>
                <div class="divider"></div>
                <p class="subtitle">This certificate is proudly presented to</p>
                <h2 class="team-name">${certificate.team_name}</h2>
                <p class="award-text">for securing</p>
                <div class="rank">${rankText} PLACE</div>
                <p class="award-text">in the next-generation challenge</p>
                <h3 class="hackathon-name">${certificate.hackathon_name}</h3>
                <div class="signature-block">
                  <div class="sign-line">Organizing Director</div>
                  <div class="sign-line">Date of Issuance</div>
                </div>
                <div class="date">Certificate ID: ${certificate.certificate_id} &middot; Verification Code: ${certificate.verification_code}</div>
                <footer>Hackathon Hub Operations Center</footer>
              </div>
            </div>
          </div>
        </body>
        </html>
      `

      const blob = new Blob([certificateHTML], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = `certificate_${certificate.team_name.replace(/\s+/g, '_')}_${certificate.hackathon_name.replace(/\s+/g, '_')}.html`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
    } catch (error) {
      alert('Error generating certificate')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading Achievement Records...</div>
  }

  return (
    <div className="premium-container fade-in">
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>📜 Achievement Certificates</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Audit and download secure certificate files for verified hackathon placements.</p>
      </div>
      
      {myCertificates.length === 0 ? (
        <div className="glass-card" style={{ 
          textAlign: 'center', 
          padding: '60px 40px', 
          borderLeft: '4px solid var(--primary)'
        }}>
          <p style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '8px' }}>No Certificates Awarded Yet</p>
          <p style={{ color: 'var(--text-secondary)' }}>Certificates are dispatched automatically when organizers announce winning placements.</p>
        </div>
      ) : (
        <div className="responsive-card-grid">
          {myCertificates.map((cert) => {
            const isFirst = cert.rank === 1
            const isSecond = cert.rank === 2
            const isThird = cert.rank === 3
            
            return (
              <div key={cert.id} className="glass-card" style={{ 
                borderLeft: isFirst ? '4px solid #FFD700' : isSecond ? '4px solid #C0C0C0' : isThird ? '4px solid #CD7F32' : '4px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                      <Award size={18} color={isFirst ? '#FFD700' : isSecond ? '#C0C0C0' : isThird ? '#CD7F32' : 'var(--text-secondary)'} />
                      <strong style={{ fontSize: '16px' }}>{cert.hackathon_name}</strong>
                    </div>
                    <span style={{ fontSize: '20px' }}>
                      {isFirst ? '🥇' : isSecond ? '🥈' : isThird ? '🥉' : '📜'}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                    <p><strong>Team:</strong> <span style={{ color: 'var(--text-primary)' }}>{cert.team_name}</span></p>
                    <p><strong>Placement:</strong> {isFirst ? 'First Place' : isSecond ? 'Second Place' : isThird ? 'Third Place' : 'Finalist'}</p>
                    <p><strong>Prize Allocated:</strong> <span style={{ color: 'var(--success)' }}>${cert.prize}</span></p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                      <Calendar size={12} /> Issued on {new Date(cert.issued_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleDownloadCertificate(cert)}
                  disabled={generating}
                  className="btn btn-success"
                  style={{ width: '100%', padding: '10px' }}
                >
                  <Download size={16} /> {generating ? 'Generating PDF...' : 'Download Certificate'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}