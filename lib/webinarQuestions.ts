// Shared (browser + server) definition of webinar registration questions.
// The SERVER runs validateAnswers() on every registration — the browser form is only a convenience.

export type QuestionType = 'text' | 'paragraph' | 'radio' | 'checkbox' | 'dropdown' | 'date' | 'year' | 'number'

export const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'text', label: 'Short answer' },
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'radio', label: 'Multiple choice (pick one)' },
  { value: 'checkbox', label: 'Checkboxes (pick many)' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'date', label: 'Date' },
  { value: 'year', label: 'Year' },
  { value: 'number', label: 'Number' },
]

export const YEAR_MIN = 1950
export const YEAR_MAX = 2100
export const MAX_QUESTIONS = 25
const MAX_OPTIONS = 50

export const hasOptions = (type: QuestionType) => type === 'radio' || type === 'checkbox' || type === 'dropdown'

export interface WebinarQuestion {
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

const TYPE_SET = new Set<string>(QUESTION_TYPES.map((t) => t.value))

/** Defensive read of whatever is stored in webinars.questions: malformed entries are dropped. */
export function parseQuestions(raw: unknown): WebinarQuestion[] {
  if (!Array.isArray(raw)) return []
  const out: WebinarQuestion[] = []
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

const isEmpty = (v: unknown) =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0)

/** Validates a registrant's answers against the webinar's questions. Unknown answer keys are ignored. */
export function validateAnswers(
  questions: WebinarQuestion[],
  raw: unknown
): { ok: true; answers: StoredAnswer[] } | { ok: false; message: string } {
  const input: Record<string, unknown> = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as any) : {}
  const answers: StoredAnswer[] = []

  for (const q of questions) {
    const v = input[q.id]
    const fail = (why: string) => ({ ok: false as const, message: `"${q.label}": ${why}` })

    if (isEmpty(v)) {
      if (q.required) return fail('this question is required.')
      continue
    }

    let value: AnswerValue
    switch (q.type) {
      case 'text':
      case 'paragraph': {
        if (typeof v !== 'string') return fail('invalid answer.')
        const max = q.type === 'text' ? 300 : 2000
        value = v.trim()
        if (value.length > max) return fail(`please keep this under ${max} characters.`)
        break
      }
      case 'number': {
        const s = String(v).trim()
        if (!/^-?\d{1,15}(\.\d{1,6})?$/.test(s)) return fail('enter a valid number.')
        value = s
        break
      }
      case 'year': {
        const s = String(v).trim()
        const n = Number(s)
        if (!/^\d{4}$/.test(s) || n < YEAR_MIN || n > YEAR_MAX) return fail(`enter a year between ${YEAR_MIN} and ${YEAR_MAX}.`)
        value = s
        break
      }
      case 'date': {
        const s = String(v).trim()
        const d = new Date(s + 'T00:00:00Z')
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
          return fail('enter a valid date.')
        }
        const year = d.getUTCFullYear()
        if (year < 1900 || year > YEAR_MAX) return fail('enter a valid date.')
        value = s
        break
      }
      case 'radio':
      case 'dropdown': {
        if (typeof v !== 'string' || !q.options?.includes(v)) return fail('choose one of the listed options.')
        value = v
        break
      }
      case 'checkbox': {
        if (!Array.isArray(v) || v.some((x) => typeof x !== 'string' || !q.options?.includes(x))) {
          return fail('choose only from the listed options.')
        }
        value = v.filter((x, i) => v.indexOf(x) === i) as string[]
        break
      }
      default:
        continue
    }

    answers.push({ id: q.id, label: q.label, type: q.type, value })
  }

  return { ok: true, answers }
}

/** "Draft" = what the admin builder edits; options are one-per-line text while typing. */
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

export const toDraft = (q: WebinarQuestion): DraftQuestion => ({
  id: q.id,
  label: q.label,
  type: q.type,
  required: q.required,
  optionsText: (q.options ?? []).join('\n'),
})

export function draftsToQuestions(
  drafts: DraftQuestion[]
): { ok: true; questions: WebinarQuestion[] } | { ok: false; message: string } {
  if (drafts.length > MAX_QUESTIONS) return { ok: false, message: `You can add at most ${MAX_QUESTIONS} questions.` }
  const questions: WebinarQuestion[] = []
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
