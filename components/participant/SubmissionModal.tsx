'use client'

import { useState } from 'react'

export interface SubmissionFormValues {
  project_title: string
  problem_statement: string
  solution: string
  features: string
  repo_link: string
  demo_video_url: string
  ppt_url: string
  report_pdf_url: string
}

const emptyValues: SubmissionFormValues = {
  project_title: '',
  problem_statement: '',
  solution: '',
  features: '',
  repo_link: '',
  demo_video_url: '',
  ppt_url: '',
  report_pdf_url: '',
}

export function SubmissionModal({
  initialValues,
  readOnly = false,
  submitting = false,
  onSubmit,
  onClose,
}: {
  initialValues?: Partial<SubmissionFormValues>
  readOnly?: boolean
  submitting?: boolean
  onSubmit: (values: SubmissionFormValues) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<SubmissionFormValues>({ ...emptyValues, ...initialValues })

  const set = (key: keyof SubmissionFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const fields: Array<{ key: keyof SubmissionFormValues; label: string; type?: 'text' | 'url' | 'textarea'; required?: boolean }> = [
    { key: 'project_title', label: 'Project Title', required: true },
    { key: 'problem_statement', label: 'Problem Statement', type: 'textarea' },
    { key: 'solution', label: 'Solution & Tech Stack', type: 'textarea' },
    { key: 'features', label: 'Key Features', type: 'textarea' },
    { key: 'repo_link', label: 'GitHub / Repository Link', type: 'url' },
    { key: 'demo_video_url', label: 'Demo Video URL', type: 'url' },
    { key: 'ppt_url', label: 'PPT / Slide Link', type: 'url' },
    { key: 'report_pdf_url', label: 'PDF / Documentation Link', type: 'url' },
  ]

  return (
    <div className="modal-overlay">
      <div className="glass-card" style={{ width: '100%', maxWidth: '560px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>
          {readOnly ? 'Your Submission' : 'Submit Hackathon Project'}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
          {readOnly ? 'This is a read-only view of your submitted project.' : 'Submit files and repository pointers for your team.'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
          {fields.map(({ key, label, type, required }) => (
            <div key={key}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                {label} {required && '*'}
              </label>
              {type === 'textarea' ? (
                <textarea
                  value={form[key]}
                  onChange={set(key)}
                  rows={key === 'solution' ? 4 : 2}
                  className="premium-input"
                  disabled={readOnly}
                />
              ) : (
                <input
                  type={type === 'url' ? 'url' : 'text'}
                  value={form[key]}
                  onChange={set(key)}
                  className="premium-input"
                  disabled={readOnly}
                />
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '10px 20px' }}>
            {readOnly ? 'Close' : 'Cancel'}
          </button>
          {!readOnly && (
            <button
              onClick={() => onSubmit(form)}
              disabled={submitting || !form.project_title.trim()}
              className="btn btn-primary"
              style={{ padding: '10px 24px' }}
            >
              {submitting ? 'Submitting...' : 'Submit Project'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
