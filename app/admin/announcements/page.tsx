'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Send, Volume2, Users, Trash2 } from 'lucide-react'

export default function AdminAnnouncements() {
  const [user, setUser] = useState<any>(null)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [targetRole, setTargetRole] = useState('all')
  const [sending, setSending] = useState(false)
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkAdmin()
  }, [])

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
    
    if (userData?.role !== 'admin') {
      router.push('/participant')
      return
    }
    setUser(user)
    loadAnnouncements()
  }

  const loadAnnouncements = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
    setAnnouncements(data || [])
  }

  const sendAnnouncement = async () => {
    if (!title.trim() || !message.trim()) {
      alert('Please fill title and message')
      return
    }

    setSending(true)

    // Save announcement
    const { error: announceError } = await supabase
      .from('announcements')
      .insert({
        title,
        message,
        target_role: targetRole,
        created_by: user?.id
      })

    if (announceError) {
      alert('Error: ' + announceError.message)
      setSending(false)
      return
    }

    // Get users based on target role
    let query = supabase.from('users').select('id')
    if (targetRole !== 'all') {
      query = query.eq('role', targetRole)
    }
    const { data: users } = await query

    // Create notifications for each user
    if (users && users.length > 0) {
      const notifications = users.map(u => ({
        user_id: u.id,
        title: title,
        message: message,
        type: 'announcement'
      }))

      const { error } = await supabase.from('notifications').insert(notifications)
      if (error) console.error('Error sending notifications:', error)
    }

    alert(`Announcement sent to ${users?.length || 0} users!`)
    setTitle('')
    setMessage('')
    setTargetRole('all')
    loadAnnouncements()
    setSending(false)
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    const previous = announcements
    setAnnouncements((prev) => prev.filter((a) => a.id !== id))
    setConfirmDeleteId(null)

    try {
      const res = await fetch(`/api/announcements/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!json.success) {
        alert('Error: ' + json.message)
        setAnnouncements(previous)
      } else {
        alert('Announcement deleted.')
      }
    } catch {
      alert('Network error — could not delete announcement.')
      setAnnouncements(previous)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="premium-container fade-in" style={{ maxWidth: '800px' }}>
      <div style={{ marginBottom: '36px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>📢 Broadcast Announcements</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Publish notifications and broadcast alerts directly to target user cohorts.</p>
      </div>

      <div className="glass-card" style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Volume2 size={20} color="var(--primary)" /> Draft Message
        </h2>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Target Audience</label>
          <select
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            className="premium-input premium-select"
          >
            <option value="all">All Users</option>
            <option value="participant">Participants Only</option>
            <option value="admin">Admins Only</option>
            <option value="jury">Jury Only</option>
            <option value="college">College Only</option>
          </select>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Announcement Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Project submission deadline updated"
            className="premium-input"
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Message Body</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Enter announcement contents here..."
            className="premium-input"
          />
        </div>

        <button
          onClick={sendAnnouncement}
          disabled={sending}
          className="btn btn-primary"
          style={{ width: '100%' }}
        >
          <Send size={16} /> {sending ? 'Broadcasting...' : 'Publish Announcement'}
        </button>
      </div>

      <h2 style={{ fontSize: '20px', marginBottom: '20px', fontFamily: 'var(--font-display)' }}>Previous Announcements</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {announcements.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            No announcements sent yet.
          </div>
        ) : (
          announcements.map(ann => (
            <div key={ann.id} className="glass-card" style={{ padding: '20px', borderLeft: '3px solid var(--primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', gap: '12px' }}>
                <strong style={{ fontSize: '16px', color: 'var(--text-primary)' }}>{ann.title}</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <span style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'rgba(2, 132, 199, 0.05)',
                    color: 'var(--text-secondary)',
                    fontWeight: 600
                  }}>
                    {ann.target_role.toUpperCase()}
                  </span>
                  <button
                    onClick={() => setConfirmDeleteId(ann.id)}
                    disabled={deletingId === ann.id}
                    className="btn btn-secondary"
                    style={{ padding: '4px 8px', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                    aria-label="Delete announcement"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5', marginBottom: '12px' }}>{ann.message}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                <Users size={12} /> Sent by {ann.created_by ? ann.created_by.slice(0, 8) : 'a deleted admin'} | {new Date(ann.created_at).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>

      {confirmDeleteId && (
        <div className="modal-overlay">
          <div className="glass-card" style={{ width: '100%', maxWidth: '420px', padding: '32px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Delete this announcement?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
              This cannot be undone. It will disappear from every user's notifications feed reference.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDeleteId(null)} className="btn btn-secondary" style={{ padding: '8px 16px' }}>
                Cancel
              </button>
              <button onClick={() => handleDelete(confirmDeleteId)} className="btn btn-danger" style={{ padding: '8px 20px' }}>
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}