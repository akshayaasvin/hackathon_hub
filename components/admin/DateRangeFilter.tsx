'use client'

import { istDateNDaysAgo } from '@/lib/dates'

export type DatePreset = 'all' | 'today' | 'yesterday' | '7d' | '30d' | 'custom'

export interface DateRangeState {
  preset: DatePreset
  // Both always 'YYYY-MM-DD' (IST calendar dates), kept in sync with `preset` for every
  // non-custom preset so the caller never has to special-case "which preset am I on" —
  // it just reads `from`/`to` (empty strings when preset === 'all').
  from: string
  to: string
}

export const ALL_DATES: DateRangeState = { preset: 'all', from: '', to: '' }

const PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'all', label: 'All time' },
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'custom', label: 'Custom range' },
]

function presetToRange(preset: DatePreset): { from: string; to: string } {
  switch (preset) {
    case 'today':
      return { from: istDateNDaysAgo(0), to: istDateNDaysAgo(0) }
    case 'yesterday':
      return { from: istDateNDaysAgo(1), to: istDateNDaysAgo(1) }
    case '7d':
      return { from: istDateNDaysAgo(6), to: istDateNDaysAgo(0) }
    case '30d':
      return { from: istDateNDaysAgo(29), to: istDateNDaysAgo(0) }
    default:
      return { from: '', to: '' }
  }
}

/**
 * Shared date-range filter used by both the internship and webinar registration admin pages
 * (created_at, day boundaries computed in Asia/Kolkata — see lib/dates.ts istDateRangeToUTC,
 * which is what the caller should feed `value.from`/`value.to` into to build the actual
 * .gte()/.lt() query). Emits `{ preset: 'all', from: '', to: '' }` for "no filter".
 */
export default function DateRangeFilter({ value, onChange }: { value: DateRangeState; onChange: (next: DateRangeState) => void }) {
  const selectPreset = (preset: DatePreset) => {
    if (preset === 'custom') {
      // Keep whatever custom from/to was already picked (or blank, for a first click).
      onChange({ preset, from: value.preset === 'custom' ? value.from : '', to: value.preset === 'custom' ? value.to : '' })
      return
    }
    onChange({ preset, ...presetToRange(preset) })
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
      {PRESETS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => selectPreset(p.key)}
          className="btn btn-secondary"
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            ...(value.preset === p.key
              ? { background: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' }
              : {}),
          }}
        >
          {p.label}
        </button>
      ))}
      {value.preset === 'custom' && (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input
            type="date"
            className="premium-input"
            style={{ padding: '6px 10px', fontSize: '13px', width: 'auto' }}
            value={value.from}
            max={value.to || undefined}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
          />
          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>to</span>
          <input
            type="date"
            className="premium-input"
            style={{ padding: '6px 10px', fontSize: '13px', width: 'auto' }}
            value={value.to}
            min={value.from || undefined}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
          />
        </div>
      )}
    </div>
  )
}
