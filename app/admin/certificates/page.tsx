'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Award, Search, User, Calendar, ExternalLink } from 'lucide-react'

export default function AdminCertificatesPage() {
  const [certificates, setCertificates] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadCertificates()
  }, [])

  const loadCertificates = async () => {
    try {
      setLoading(true)
      const [certsRes, hacksRes, usersRes] = await Promise.all([
        supabase.from('certificates').select('*'),
        supabase.from('hackathons').select('*'),
        supabase.from('users').select('*')
      ])

      const certsData = certsRes.data || []
      const hacksData = hacksRes.data || []
      const usersData = usersRes.data || []

      const joined = certsData.map(cert => {
        const hackathon = hacksData.find((h: any) => h.id === cert.hackathon_id)
        const user = usersData.find((u: any) => u.id === cert.user_id)

        return {
          ...cert,
          userName: user ? user.full_name : 'Unknown Student',
          userEmail: user ? user.email : '',
          hackathonName: hackathon ? hackathon.name : 'Unknown Hackathon'
        }
      })

      setCertificates(joined)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const filtered = certificates.filter(c =>
    c.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.certificate_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.hackathonName?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading Certificates...</div>
  }

  return (
    <div className="premium-container fade-in" style={{ padding: '40px' }}>
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>🎖️ Issued Certificates</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Audit and view achievement certificates generated for winning students.</p>
      </div>

      <div style={{ marginBottom: '32px', position: 'relative', maxWidth: '480px' }}>
        <input 
          placeholder="Search by student, team, or hackathon..." 
          value={searchQuery} 
          onChange={(e) => setSearchQuery(e.target.value)}
          className="premium-input"
          style={{ paddingLeft: '44px' }}
        />
        <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
          <Search size={18} />
        </div>
      </div>

      <div className="table-container fade-in">
        <table className="premium-table">
          <thead>
            <tr>
              <th>Certificate ID</th>
              <th>Recipient Student</th>
              <th>Type</th>
              <th>Hackathon Name</th>
              <th>Issued Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No certificates found.</td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {c.certificate_id}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.userName}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{c.userEmail}</div>
                  </td>
                  <td style={{ textTransform: 'capitalize' }}>{c.certificate_type}</td>
                  <td>{c.hackathonName}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                      <Calendar size={14} color="var(--text-secondary)" />
                      {new Date(c.issued_at).toLocaleDateString()}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
