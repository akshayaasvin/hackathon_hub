'use client'

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import {
  ASSESSMENT_QUESTION_TYPES,
  newAssessmentDraft,
  type AssessmentQuestionType,
  type DraftAssessmentQuestion,
} from '@/lib/internshipAssessment'

const fieldLabel = { display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' } as const
const SCORABLE = new Set<AssessmentQuestionType>(['radio', 'checkbox', 'dropdown', 'yesno'])

/** Google-Form-like eligibility assessment builder (section 5): question, type, options, correct answer, marks. */
export default function AssessmentBuilder({ value, onChange }: { value: DraftAssessmentQuestion[]; onChange: (next: DraftAssessmentQuestion[]) => void }) {
  const update = (index: number, patch: Partial<DraftAssessmentQuestion>) => onChange(value.map((q, i) => (i === index ? { ...q, ...patch } : q)))
  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= value.length) return
    const next = [...value]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div>
      <div style={{ display: 'grid', gap: '14px' }}>
        {value.map((q, index) => {
          const scorable = SCORABLE.has(q.type)
          const optionLines = q.type === 'yesno' ? ['Yes', 'No'] : q.optionsText.split('\n').map((l) => l.trim()).filter(Boolean)
          return (
            <div key={q.id} style={{ border: '1px solid var(--border-color)', borderRadius: '14px', padding: '16px', background: 'rgba(108,71,255,0.03)' }}>
              <div className="responsive-grid-2" style={{ marginBottom: '12px' }}>
                <div>
                  <label style={fieldLabel}>Question</label>
                  <input className="premium-input" value={q.label} onChange={(e) => update(index, { label: e.target.value })} placeholder="e.g. What does API stand for?" maxLength={300} />
                </div>
                <div>
                  <label style={fieldLabel}>Answer type</label>
                  <select className="premium-input" value={q.type} onChange={(e) => update(index, { type: e.target.value as AssessmentQuestionType, correctText: '' })}>
                    {ASSESSMENT_QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              {(q.type === 'radio' || q.type === 'checkbox' || q.type === 'dropdown') && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={fieldLabel}>Options (one per line, at least 2)</label>
                  <textarea className="premium-input" rows={3} value={q.optionsText} onChange={(e) => update(index, { optionsText: e.target.value })} placeholder={'Option 1\nOption 2'} />
                </div>
              )}

              {scorable && (
                <div className="responsive-grid-2" style={{ marginBottom: '12px' }}>
                  <div>
                    <label style={fieldLabel}>
                      Correct answer{q.type === 'checkbox' ? '(s) — one per line' : ''} <span style={{ fontWeight: 400 }}>(optional — leave blank to not auto-grade)</span>
                    </label>
                    {q.type === 'checkbox' ? (
                      <textarea className="premium-input" rows={2} value={q.correctText} onChange={(e) => update(index, { correctText: e.target.value })} placeholder="Must match option text exactly, one per line" />
                    ) : (
                      <select className="premium-input" value={q.correctText} onChange={(e) => update(index, { correctText: e.target.value })}>
                        <option value="">Not graded</option>
                        {optionLines.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    )}
                  </div>
                  <div>
                    <label style={fieldLabel}>Marks</label>
                    <input type="number" min="0" step="1" className="premium-input" value={q.marks} onChange={(e) => update(index, { marks: e.target.value })} disabled={!q.correctText.trim()} />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={q.required} onChange={(e) => update(index, { required: e.target.checked })} /> Required
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => move(index, -1)} disabled={index === 0}><ArrowUp size={14} /></button>
                  <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => move(index, 1)} disabled={index === value.length - 1}><ArrowDown size={14} /></button>
                  <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px', color: 'var(--danger)' }} onClick={() => onChange(value.filter((_, i) => i !== index))}><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <button type="button" className="btn btn-secondary" style={{ marginTop: '14px', display: 'inline-flex', gap: '6px' }} onClick={() => onChange([...value, newAssessmentDraft()])}>
        <Plus size={16} /> Add question
      </button>
    </div>
  )
}
