'use client'

import { FIXED_FIELD_DEFS, type FixedFieldConfig, type FixedFieldKey } from '@/lib/internshipForm'

/** Admin picks which of the standard registration fields (section 6) to ask, and which are required. */
export default function FixedFieldsPicker({ value, onChange }: { value: FixedFieldConfig[]; onChange: (next: FixedFieldConfig[]) => void }) {
  const configFor = (key: FixedFieldKey) => value.find((f) => f.key === key)

  const toggleIncluded = (key: FixedFieldKey, included: boolean) => {
    if (included) onChange([...value, { key, required: false }])
    else onChange(value.filter((f) => f.key !== key))
  }
  const toggleRequired = (key: FixedFieldKey, required: boolean) => onChange(value.map((f) => (f.key === key ? { ...f, required } : f)))

  return (
    <div style={{ display: 'grid', gap: '8px' }}>
      {FIXED_FIELD_DEFS.map((def) => {
        const cfg = configFor(def.key)
        return (
          <div
            key={def.key}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 14px',
              borderRadius: '10px', border: '1px solid var(--border-color)', background: cfg ? 'rgba(108,71,255,0.04)' : 'transparent',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer', flex: 1 }}>
              <input type="checkbox" checked={!!cfg} onChange={(e) => toggleIncluded(def.key, e.target.checked)} />
              {def.label}
            </label>
            {cfg && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={cfg.required} onChange={(e) => toggleRequired(def.key, e.target.checked)} /> Required
              </label>
            )}
          </div>
        )
      })}
    </div>
  )
}
