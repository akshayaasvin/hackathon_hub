'use client'

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { MAX_QUESTIONS, QUESTION_TYPES, hasOptions, newDraft, type DraftQuestion, type QuestionType } from '@/lib/webinarQuestions'

const fieldLabel = { display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' } as const

/**
 * "Google Form"-style question builder for the admin Create/Edit Webinar form.
 * Name, email and mobile number are always asked; these are the extra questions.
 */
export default function QuestionBuilder({
  value,
  onChange,
}: {
  value: DraftQuestion[]
  onChange: (next: DraftQuestion[]) => void
}) {
  const update = (index: number, patch: Partial<DraftQuestion>) =>
    onChange(value.map((q, i) => (i === index ? { ...q, ...patch } : q)))

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= value.length) return
    const next = [...value]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ marginBottom: '12px' }}>
        <h3 style={{ fontSize: '16px', marginBottom: '4px' }}>Registration questions</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Name, email and mobile number are always asked. Add any extra questions you need, like a Google Form.
        </p>
      </div>

      <div style={{ display: 'grid', gap: '14px' }}>
        {value.map((q, index) => (
          <div key={q.id} style={{ border: '1px solid var(--border-color)', borderRadius: '14px', padding: '16px', background: 'rgba(108,71,255,0.03)' }}>
            <div className="responsive-grid-2" style={{ marginBottom: '12px' }}>
              <div>
                <label style={fieldLabel}>Question {index + 1}</label>
                <input
                  className="premium-input"
                  value={q.label}
                  onChange={(e) => update(index, { label: e.target.value })}
                  placeholder="e.g. Which year do you graduate?"
                  maxLength={200}
                />
              </div>
              <div>
                <label style={fieldLabel}>Answer type</label>
                <select
                  className="premium-input"
                  value={q.type}
                  onChange={(e) => update(index, { type: e.target.value as QuestionType })}
                >
                  {QUESTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {hasOptions(q.type) && (
              <div style={{ marginBottom: '12px' }}>
                <label style={fieldLabel}>Options (one per line, at least 2)</label>
                <textarea
                  className="premium-input"
                  rows={4}
                  value={q.optionsText}
                  onChange={(e) => update(index, { optionsText: e.target.value })}
                  placeholder={'Option 1\nOption 2\nOption 3'}
                />
              </div>
            )}

            {q.type === 'year' && (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>Shown as a year dropdown.</p>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                <input type="checkbox" checked={q.required} onChange={(e) => update(index, { required: e.target.checked })} />
                Required
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up">
                  <ArrowUp size={14} />
                </button>
                <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => move(index, 1)} disabled={index === value.length - 1} aria-label="Move down">
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '6px 10px', color: 'var(--danger)' }}
                  onClick={() => onChange(value.filter((_, i) => i !== index))}
                  aria-label="Delete question"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="btn btn-secondary"
        style={{ marginTop: '14px', display: 'inline-flex', gap: '6px' }}
        onClick={() => onChange([...value, newDraft()])}
        disabled={value.length >= MAX_QUESTIONS}
      >
        <Plus size={16} /> Add question
      </button>
    </div>
  )
}
