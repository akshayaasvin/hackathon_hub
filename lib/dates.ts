// Shared, timezone-independent handling for CALENDAR-DATE values — columns like
// internships.start_date/end_date/application_deadline, which are Postgres `date` (already
// confirmed: NOT timestamptz — see migration 0025), and come back from PostgREST as a plain
// 'YYYY-MM-DD' string with no time or zone component at all.
//
// The bug this file exists to prevent: `new Date('YYYY-MM-DD')` parses that string as UTC
// midnight, and `.toLocaleDateString()` then renders it in the BROWSER's local timezone.
// For any viewer west of UTC (most of the Americas, and — around the international date
// line — parts of the Pacific) that pushes the display back a full calendar day: an admin
// who typed 27/09/2026 has it shown to a candidate in Los Angeles as 26/09/2026. Every
// function below works on the 'YYYY-MM-DD' string directly (or, for real instants like
// created_at, via an explicit IANA zone) and never lets the runtime's own zone leak in.
//
// No client-only or server-only import here on purpose — this is pure date arithmetic used
// from both server components/routes and 'use client' components.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

function parseISODateParts(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  const [, y, m, d] = match
  return { y: Number(y), m: Number(m), d: Number(d) }
}

// A 'YYYY-MM-DD' calendar date, represented as the UTC instant of its own midnight — used
// only as an arithmetic anchor (day differences, offsetting), never displayed directly.
function isoDateToUTCMidnightMs(value: string): number | null {
  const parts = parseISODateParts(value)
  if (!parts) return null
  return Date.UTC(parts.y, parts.m - 1, parts.d)
}

/** 'YYYY-MM-DD' → 'DD/MM/YYYY', via string parsing only. Returns '' for null/empty/unparseable input. */
export function formatDateDMY(value: string | null | undefined): string {
  if (!value) return ''
  const parts = parseISODateParts(value)
  if (!parts) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(parts.d)}/${pad(parts.m)}/${parts.y}`
}

/** 'DD/MM/YYYY' → 'YYYY-MM-DD'. Returns the input unchanged if it doesn't match that shape. */
export function parseDMYToISO(value: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim())
  if (!match) return value
  const [, d, m, y] = match
  return `${y}-${m}-${d}`
}

/**
 * Human-readable duration between two calendar dates (inclusive of both ends), e.g.
 * "2 Months", "6 Weeks", "10 Days" — matches the wording already used by the admin-authored
 * duration_text field. Returns null when either date is missing/unparseable or end < start.
 */
export function durationBetween(startISO: string | null | undefined, endISO: string | null | undefined): string | null {
  if (!startISO || !endISO) return null
  const startMs = isoDateToUTCMidnightMs(startISO)
  const endMs = isoDateToUTCMidnightMs(endISO)
  if (startMs === null || endMs === null || endMs < startMs) return null
  const days = Math.round((endMs - startMs) / 86_400_000) + 1
  if (days >= 30 && days % 30 === 0) {
    const months = days / 30
    return `${months} Month${months === 1 ? '' : 's'}`
  }
  if (days >= 7 && days % 7 === 0) {
    const weeks = days / 7
    return `${weeks} Week${weeks === 1 ? '' : 's'}`
  }
  return `${days} Day${days === 1 ? '' : 's'}`
}

/**
 * True once the given application-deadline calendar date has fully passed, end-of-day in
 * Asia/Kolkata (23:59:59.999 IST on the deadline date) — i.e. applications are still open for
 * the whole of the deadline day itself. `nowMs` is injectable for testing.
 */
export function isPastApplicationDeadlineIST(deadlineISO: string | null | undefined, nowMs: number = Date.now()): boolean {
  if (!deadlineISO) return false
  const midnightUTCms = isoDateToUTCMidnightMs(deadlineISO)
  if (midnightUTCms === null) return false
  // End of the IST calendar day, expressed as a UTC instant: midnight UTC of the same date
  // + 24h, minus the IST offset, minus 1ms — e.g. 2026-09-27 → 2026-09-27T18:29:59.999Z,
  // which is 2026-09-27 23:59:59.999 in Asia/Kolkata.
  const endOfDayUTCms = midnightUTCms + 86_400_000 - IST_OFFSET_MS - 1
  return nowMs > endOfDayUTCms
}

/** Today (or `daysAgo` days before today) as an IST calendar date string 'YYYY-MM-DD'. */
export function istDateNDaysAgo(daysAgo: number, nowMs: number = Date.now()): string {
  const shifted = new Date(nowMs + IST_OFFSET_MS - daysAgo * 86_400_000)
  return shifted.toISOString().slice(0, 10)
}

/**
 * UTC [gte, lt) bounds for the inclusive IST calendar-date range [fromISO, toISO] — i.e. from
 * 00:00:00.000 IST on fromISO up to (but excluding) 00:00:00.000 IST on the day after toISO.
 * Use with `.gte('created_at', gte).lt('created_at', lt)` to filter a timestamptz column by
 * IST calendar day without ever comparing raw date strings against an instant column.
 */
export function istDateRangeToUTC(fromISO: string, toISO: string): { gte: string; lt: string } | null {
  const fromMs = isoDateToUTCMidnightMs(fromISO)
  const toMs = isoDateToUTCMidnightMs(toISO)
  if (fromMs === null || toMs === null) return null
  return {
    gte: new Date(fromMs - IST_OFFSET_MS).toISOString(),
    lt: new Date(toMs + 86_400_000 - IST_OFFSET_MS).toISOString(),
  }
}

/** timestamptz ISO string → 'DD/MM/YYYY HH:mm' rendered in Asia/Kolkata, for exports. */
export function formatDateTimeDMY_IST(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`
}

/**
 * timestamptz ISO string → 'DD/MM/YYYY' (date only, no time), rendered in Asia/Kolkata. For
 * real instants (e.g. created_at) that should be shown as a calendar date to an IST audience
 * — unlike formatDateDMY, this DOES need a timezone, since the input is an actual point in
 * time rather than an already-a-date-with-no-time-component value.
 */
export function formatInstantDateDMY_IST(value: string | null | undefined): string {
  const full = formatDateTimeDMY_IST(value)
  return full ? full.split(' ')[0] : ''
}
