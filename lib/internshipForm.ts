// Shared (browser + server) definition of the internship REGISTRATION form: a fixed set of
// well-known fields the admin can toggle required/optional/hidden per internship, plus
// unlimited custom questions (same idea as lib/webinarQuestions.ts, kept as an independent
// module on purpose — internships change independently of webinars and must never risk
// breaking that working feature). The SERVER runs validateRegistrationAnswers() on every
// submission; the browser form is only a convenience.

export type QuestionType = 'text' | 'paragraph' | 'radio' | 'checkbox' | 'dropdown' | 'date' | 'year' | 'number' | 'url'

export const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'text', label: 'Short answer' },
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'radio', label: 'Multiple choice (pick one)' },
  { value: 'checkbox', label: 'Checkboxes (pick many)' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'date', label: 'Date' },
  { value: 'year', label: 'Year' },
  { value: 'number', label: 'Number' },
  { value: 'url', label: 'Link (URL)' },
]

export const YEAR_MIN = 1950
export const YEAR_MAX = 2100
export const MAX_QUESTIONS = 25
const MAX_OPTIONS = 50

export const hasOptions = (type: QuestionType) => type === 'radio' || type === 'checkbox' || type === 'dropdown'

export interface Question {
  id: string
  label: string
  type: QuestionType
  required: boolean
  options?: string[]
}

export type AnswerValue = string | string[]

export interface StoredAnswer {
  id: string
  label: string
  type: QuestionType
  value: AnswerValue
}

// The well-known fields section 6 asks for. `type` drives both the input rendered and the
// server-side validation. Admin picks a SUBSET per internship and marks each required/optional.
export const FIXED_FIELD_DEFS = [
  { key: 'college_name', label: 'College Name', type: 'text' as const },
  { key: 'degree', label: 'Degree', type: 'text' as const },
  { key: 'domain', label: 'Branch / Domain', type: 'text' as const },
  { key: 'passout_year', label: 'Passout Year', type: 'year' as const },
  { key: 'date_of_birth', label: 'Date of Birth', type: 'date' as const },
  { key: 'experience_level', label: 'Experience Level', type: 'dropdown' as const, options: ['Fresher', 'Experienced'] },
  { key: 'address', label: 'Address', type: 'paragraph' as const },
  { key: 'linkedin_url', label: 'LinkedIn URL', type: 'url' as const },
  { key: 'github_url', label: 'GitHub URL', type: 'url' as const },
  { key: 'portfolio_url', label: 'Portfolio URL', type: 'url' as const },
  { key: 'resume', label: 'Resume', type: 'resume' as const },
] as const

export type FixedFieldKey = (typeof FIXED_FIELD_DEFS)[number]['key']
const FIXED_FIELD_KEYS = new Set<string>(FIXED_FIELD_DEFS.map((f) => f.key))
const fixedFieldDef = (key: string) => FIXED_FIELD_DEFS.find((f) => f.key === key)

export interface FixedFieldConfig {
  key: FixedFieldKey
  required: boolean
}

export interface FormConfig {
  fixedFields: FixedFieldConfig[]
  questions: Question[]
}

const TYPE_SET = new Set<string>(QUESTION_TYPES.map((t) => t.value))

function parseQuestionList(raw: unknown): Question[] {
  if (!Array.isArray(raw)) return []
  const out: Question[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const q = item as any
    const id = typeof q.id === 'string' ? q.id : ''
    const label = typeof q.label === 'string' ? q.label.trim() : ''
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(id) || !label || seen.has(id) || !TYPE_SET.has(q.type)) continue
    const type = q.type as QuestionType
    let options: string[] | undefined
    if (hasOptions(type)) {
      const cleaned: string[] = Array.isArray(q.options)
        ? q.options.filter((o: unknown): o is string => typeof o === 'string').map((o: string) => o.trim()).filter(Boolean)
        : []
      options = cleaned.filter((o, i) => cleaned.indexOf(o) === i).slice(0, MAX_OPTIONS)
      if (options.length < 1) continue
    }
    seen.add(id)
    out.push({ id, label: label.slice(0, 200), type, required: !!q.required, ...(options ? { options } : {}) })
  }
  return out.slice(0, MAX_QUESTIONS)
}

/** Defensive read of whatever is stored in internships.form_config: malformed entries are dropped. */
export function parseFormConfig(raw: unknown): FormConfig {
  const obj = raw && typeof raw === 'object' ? (raw as any) : {}
  const fixedFields: FixedFieldConfig[] = Array.isArray(obj.fixedFields)
    ? obj.fixedFields
        .filter((f: any) => f && FIXED_FIELD_KEYS.has(f.key))
        .map((f: any) => ({ key: f.key as FixedFieldKey, required: !!f.required }))
        .filter((f: FixedFieldConfig, i: number, arr: FixedFieldConfig[]) => arr.findIndex((x) => x.key === f.key) === i)
    : []
  return { fixedFields, questions: parseQuestionList(obj.questions) }
}

const isEmpty = (v: unknown) =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0)

function validateOne(
  label: string,
  type: QuestionType,
  required: boolean,
  v: unknown,
  options?: string[]
): { ok: true; value: AnswerValue } | { ok: false; message: string } {
  const fail = (why: string) => ({ ok: false as const, message: `"${label}": ${why}` })
  if (isEmpty(v)) {
    if (required) return fail('this field is required.')
    return { ok: true, value: '' }
  }
  switch (type) {
    case 'text':
    case 'paragraph': {
      if (typeof v !== 'string') return fail('invalid answer.')
      const max = type === 'text' ? 300 : 2000
      const value = v.trim()
      if (value.length > max) return fail(`please keep this under ${max} characters.`)
      return { ok: true, value }
    }
    case 'number': {
      const s = String(v).trim()
      if (!/^-?\d{1,15}(\.\d{1,6})?$/.test(s)) return fail('enter a valid number.')
      return { ok: true, value: s }
    }
    case 'year': {
      const s = String(v).trim()
      const n = Number(s)
      if (!/^\d{4}$/.test(s) || n < YEAR_MIN || n > YEAR_MAX) return fail(`enter a year between ${YEAR_MIN} and ${YEAR_MAX}.`)
      return { ok: true, value: s }
    }
    case 'date': {
      const s = String(v).trim()
      const d = new Date(s + 'T00:00:00Z')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) return fail('enter a valid date.')
      const year = d.getUTCFullYear()
      if (year < 1900 || year > YEAR_MAX) return fail('enter a valid date.')
      return { ok: true, value: s }
    }
    case 'url': {
      const s = String(v).trim()
      if (s.length > 500 || !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(s)) return fail('enter a valid link starting with http:// or https://')
      return { ok: true, value: s }
    }
    case 'radio':
    case 'dropdown': {
      if (typeof v !== 'string' || !options?.includes(v)) return fail('choose one of the listed options.')
      return { ok: true, value: v }
    }
    case 'checkbox': {
      if (!Array.isArray(v) || v.some((x) => typeof x !== 'string' || !options?.includes(x))) return fail('choose only from the listed options.')
      return { ok: true, value: v.filter((x, i) => v.indexOf(x) === i) as string[] }
    }
    default:
      return { ok: false, message: `"${label}": unsupported field.` }
  }
}

/**
 * Validates a submission against an internship's form config. `raw` is a flat
 * {fieldOrQuestionId: value} object from the browser. Returns the fixed-field values (for
 * the dedicated columns / prefill use) and the full answers snapshot (fixed + custom) to
 * store in internship_registrations.form_answers.
 */
export function validateRegistrationAnswers(
  config: FormConfig,
  raw: unknown
):
  | { ok: true; fixedValues: Record<string, AnswerValue>; answers: StoredAnswer[] }
  | { ok: false; message: string } {
  const input: Record<string, unknown> = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as any) : {}
  const fixedValues: Record<string, AnswerValue> = {}
  const answers: StoredAnswer[] = []

  for (const f of config.fixedFields) {
    const def = fixedFieldDef(f.key)
    if (!def || def.type === 'resume') continue // resume is handled separately (file upload)
    const optionList = 'options' in def ? [...def.options] : undefined
    const result = validateOne(def.label, def.type, f.required, input[f.key], optionList)
    if (result.ok === false) return result
    if (result.value !== '') {
      fixedValues[f.key] = result.value
      answers.push({ id: f.key, label: def.label, type: def.type, value: result.value })
    }
  }

  for (const q of config.questions) {
    const result = validateOne(q.label, q.type, q.required, input[q.id], q.options)
    if (result.ok === false) return result
    if (result.value !== '') answers.push({ id: q.id, label: q.label, type: q.type, value: result.value })
  }

  return { ok: true, fixedValues, answers }
}

// ── Admin builder helpers (drafts for custom questions; fixed fields are toggled directly) ──

export interface DraftQuestion {
  id: string
  label: string
  type: QuestionType
  required: boolean
  optionsText: string
}

export const newDraft = (): DraftQuestion => ({
  id: 'q_' + Math.random().toString(36).slice(2, 8),
  label: '',
  type: 'text',
  required: false,
  optionsText: '',
})

export const toDraft = (q: Question): DraftQuestion => ({
  id: q.id,
  label: q.label,
  type: q.type,
  required: q.required,
  optionsText: (q.options ?? []).join('\n'),
})

export function draftsToQuestions(drafts: DraftQuestion[]): { ok: true; questions: Question[] } | { ok: false; message: string } {
  if (drafts.length > MAX_QUESTIONS) return { ok: false, message: `You can add at most ${MAX_QUESTIONS} questions.` }
  const questions: Question[] = []
  for (let i = 0; i < drafts.length; i++) {
    const d = drafts[i]
    const label = d.label.trim()
    if (!label) return { ok: false, message: `Question ${i + 1} needs a title.` }
    if (hasOptions(d.type)) {
      const lines = d.optionsText.split('\n').map((l) => l.trim()).filter(Boolean)
      const options = lines.filter((o, idx) => lines.indexOf(o) === idx)
      if (options.length < 2) return { ok: false, message: `"${label}" needs at least 2 options (one per line).` }
      questions.push({ id: d.id, label, type: d.type, required: d.required, options })
    } else {
      questions.push({ id: d.id, label, type: d.type, required: d.required })
    }
  }
  return { ok: true, questions }
}
