// Shared (client + server) validation for Phase 4's round submissions — no upload/Storage
// involved anywhere here, every field is a link the server checks the shape of, never fetches
// or embeds (the app only ever opens these in a new tab: rel="noopener noreferrer").

const PRESENTATION_HOSTS = [
  // Google
  'docs.google.com',
  'drive.google.com',
  'slides.google.com',
  // Canva
  'canva.com',
  'canva.link',
  'canva.site',
  // Microsoft
  'onedrive.live.com',
  '1drv.ms',
  'sharepoint.com',
  'office.com',
  'live.com',
  // Dropbox
  'dropbox.com',
  'db.tt',
  // Other common pitch-deck tools
  'figma.com',
  'pitch.com',
  'gamma.app',
]

function hostAllowed(host: string, allowlist: string[]): boolean {
  const h = host.toLowerCase()
  return allowlist.some((allowed) => h === allowed || h.endsWith('.' + allowed))
}

function parseHttpsUrl(raw: string, maxLen: number): { ok: true; url: string; host: string } | { ok: false; message: string } {
  const value = raw.trim()
  if (!value) return { ok: false, message: 'This link is required.' }
  if (value.length > maxLen) return { ok: false, message: `Link must be under ${maxLen} characters.` }
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return { ok: false, message: 'Enter a valid link.' }
  }
  if (parsed.protocol !== 'https:') return { ok: false, message: 'Link must start with https://' }
  return { ok: true, url: value, host: parsed.hostname }
}

/**
 * Round 1: PPT/deck link. https only, exact-domain-or-subdomain match against PRESENTATION_HOSTS
 * (never substring-on-the-full-string — "canva.com.evil.io" and "evil-canva.com" both correctly
 * fail hostAllowed's `h === allowed || h.endsWith('.' + allowed)` check), max 500 chars.
 */
export function validatePresentationUrl(raw: string): { ok: true; url: string } | { ok: false; message: string } {
  const parsed = parseHttpsUrl(raw, 500)
  if (parsed.ok === false) return parsed
  if (!hostAllowed(parsed.host, PRESENTATION_HOSTS)) {
    return {
      ok: false,
      message: "Please paste a share link from Google Drive/Slides, Canva, OneDrive, Dropbox, Figma, Pitch or Gamma. Make sure access is set to \"Anyone with the link can view\".",
    }
  }
  return { ok: true, url: parsed.url }
}

/** Round 2: GitHub repo URL. */
export function validateGithubUrl(raw: string): { ok: true; url: string } | { ok: false; message: string } {
  const parsed = parseHttpsUrl(raw, 500)
  if (parsed.ok === false) return parsed
  if (!hostAllowed(parsed.host, ['github.com'])) return { ok: false, message: 'Enter a valid github.com repository link.' }
  return { ok: true, url: parsed.url }
}

/** Round 2: live demo URL — any https link (the deployed app itself, so no fixed host list). */
export function validateLiveDemoUrl(raw: string): { ok: true; url: string } | { ok: false; message: string } {
  return parseHttpsUrl(raw, 500)
}

/** Round 2: optional demo video URL — same shape, but empty is allowed (it's optional). */
export function validateOptionalVideoUrl(raw: string): { ok: true; url: string } | { ok: false; message: string } {
  if (!raw.trim()) return { ok: true, url: '' }
  return parseHttpsUrl(raw, 500)
}

/** Pitch session Meet link — must be a real meet.google.com link, matching the DB check constraint. */
export function validateMeetUrl(raw: string): { ok: true; url: string } | { ok: false; message: string } {
  const value = raw.trim()
  if (!value.startsWith('https://meet.google.com/')) return { ok: false, message: 'Must be a https://meet.google.com/ link.' }
  if (value.length > 300) return { ok: false, message: 'Link is too long.' }
  return { ok: true, url: value }
}
