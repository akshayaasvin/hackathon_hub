// Shared (browser + server) definition of the eligibility ASSESSMENT (distinct from the
// registration form in lib/internshipForm.ts). Google-Form-like: multiple choice, checkboxes,
// dropdown, yes/no, short answer and paragraph. The first four have a fixed option set, so
// the admin can mark a correct answer and assign marks — those are the auto-scored types.
// Short answer / paragraph are free text: included in the assessment for the admin to see,
// but never auto-graded (no reliable way to check free text), so they never carry marks.
//
// The SERVER computes the score from the STORED correct answers on every submission — the
// browser is only ever sent the questions and options, never a correctAnswer.

export type AssessmentQuestionType = 'radio' | 'checkbox' | 'dropdown' | 'yesno' | 'short' | 'paragraph'

export const ASSESSMENT_QUESTION_TYPES: { value: AssessmentQuestionType; label: string; scorable: boolean }[] = [
  { value: 'radio', label: 'Multiple choice (pick one)', scorable: true },
  { value: 'checkbox', label: 'Checkboxes (pick many)', scorable: true },
  { value: 'dropdown', label: 'Dropdown', scorable: true },
  { value: 'yesno', label: 'Yes / No', scorable: true },
  { value: 'short', label: 'Short answer (not auto-scored)', scorable: false },
  { value: 'paragraph', label: 'Paragraph (not auto-scored)', scorable: false },
]

const TYPE_SET = new Set<string>(ASSESSMENT_QUESTION_TYPES.map((t) => t.value))
const SCORABLE_TYPES = new Set<string>(ASSESSMENT_QUESTION_TYPES.filter((t) => t.scorable).map((t) => t.value))
const YESNO_OPTIONS = ['Yes', 'No']
const MAX_QUESTIONS = 50
const MAX_OPTIONS = 20

export type AnswerValue = string | string[]

/** Full shape (includes the correct answer) — admin-only; never sent to a public route. */
export interface AssessmentQuestionFull {
  id: string
  label: string
  type: AssessmentQuestionType
  required: boolean
  marks: number
  options?: string[]
  correctAnswer?: AnswerValue
}

/** What a public/student-facing route may return — never includes correctAnswer or marks. */
export interface AssessmentQuestionPublic {
  id: string
  label: string
  type: AssessmentQuestionType
  required: boolean
  options?: string[]
}

export function toPublicQuestion(q: AssessmentQuestionFull): AssessmentQuestionPublic {
  const { id, label, type, required, options } = q
  return { id, label, type, required, ...(options ? { options } : {}) }
}

function optionsFor(type: AssessmentQuestionType, raw: unknown): string[] | undefined {
  if (type === 'yesno') return YESNO_OPTIONS
  if (type !== 'radio' && type !== 'checkbox' && type !== 'dropdown') return undefined
  const cleaned: string[] = Array.isArray(raw)
    ? raw.filter((o): o is string => typeof o === 'string').map((o) => o.trim()).filter(Boolean)
    : []
  const options = cleaned.filter((o, i) => cleaned.indexOf(o) === i).slice(0, MAX_OPTIONS)
  return options.length >= 1 ? options : undefined
}

/** Defensive read of whatever is stored in internships.assessment_questions. */
export function parseAssessmentQuestions(raw: unknown): AssessmentQuestionFull[] {
  if (!Array.isArray(raw)) return []
  const out: AssessmentQuestionFull[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const q = item as any
    const id = typeof q.id === 'string' ? q.id : ''
    const label = typeof q.label === 'string' ? q.label.trim() : ''
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(id) || !label || seen.has(id) || !TYPE_SET.has(q.type)) continue
    const type = q.type as AssessmentQuestionType
    const scorable = SCORABLE_TYPES.has(type)
    const options = optionsFor(type, q.options)
    if ((type === 'radio' || type === 'checkbox' || type === 'dropdown') && !options) continue

    let correctAnswer: AnswerValue | undefined
    if (scorable && options) {
      if (type === 'checkbox') {
        const raw: unknown[] = Array.isArray(q.correctAnswer) ? q.correctAnswer : []
        const arr: string[] = raw.filter((v): v is string => typeof v === 'string' && options!.includes(v))
        correctAnswer = arr.length ? [...new Set(arr)] : undefined
      } else if (typeof q.correctAnswer === 'string' && options.includes(q.correctAnswer)) {
        correctAnswer = q.correctAnswer
      }
    }

    seen.add(id)
    out.push({
      id,
      label: label.slice(0, 300),
      type,
      required: !!q.required,
      marks: scorable && correctAnswer !== undefined ? Math.max(0, Math.min(1000, Number(q.marks) || 0)) : 0,
      ...(options ? { options } : {}),
      ...(correctAnswer !== undefined ? { correctAnswer } : {}),
    })
  }
  return out.slice(0, MAX_QUESTIONS)
}

const isEmpty = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0)

export interface ScoreResult {
  score: number
  total: number
  passed: boolean
  answers: { id: string; label: string; type: AssessmentQuestionType; value: AnswerValue; correct: boolean | null }[]
}

/**
 * Validates required-ness and scores the submission server-side. `raw` is a flat
 * {questionId: value} object. `total` is the sum of marks across scorable questions that
 * have a correct answer set — questions with no correct answer configured don't count
 * toward the total (there is nothing to grade them against).
 */
export function scoreAssessment(
  questions: AssessmentQuestionFull[],
  passingScorePercent: number,
  raw: unknown
): { ok: true; result: ScoreResult } | { ok: false; message: string } {
  const input: Record<string, unknown> = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as any) : {}
  let score = 0
  let total = 0
  const answers: ScoreResult['answers'] = []

  for (const q of questions) {
    const v = input[q.id]
    if (isEmpty(v)) {
      if (q.required) return { ok: false, message: `"${q.label}": this question is required.` }
      continue
    }

    let normalized: AnswerValue
    let correct: boolean | null = null

    switch (q.type) {
      case 'short':
      case 'paragraph': {
        if (typeof v !== 'string') return { ok: false, message: `"${q.label}": invalid answer.` }
        const max = q.type === 'short' ? 300 : 2000
        normalized = v.trim().slice(0, max)
        break
      }
      case 'radio':
      case 'dropdown':
      case 'yesno': {
        if (typeof v !== 'string' || !q.options?.includes(v)) return { ok: false, message: `"${q.label}": choose one of the listed options.` }
        normalized = v
        if (q.correctAnswer !== undefined) {
          total += q.marks
          correct = v === q.correctAnswer
          if (correct) score += q.marks
        }
        break
      }
      case 'checkbox': {
        if (!Array.isArray(v) || v.some((x) => typeof x !== 'string' || !q.options?.includes(x))) {
          return { ok: false, message: `"${q.label}": choose only from the listed options.` }
        }
        const chosen = [...new Set(v as string[])]
        normalized = chosen
        if (Array.isArray(q.correctAnswer)) {
          total += q.marks
          const want = new Set(q.correctAnswer)
          correct = chosen.length === want.size && chosen.every((c) => want.has(c))
          if (correct) score += q.marks
        }
        break
      }
      default:
        continue
    }

    answers.push({ id: q.id, label: q.label, type: q.type, value: normalized, correct })
  }

  // Nothing was actually scorable (all free-text, or no correct answers configured yet):
  // there is nothing to fail, so this can't block an applicant.
  const passed = total === 0 ? true : (score / total) * 100 >= passingScorePercent

  return { ok: true, result: { score, total, passed, answers } }
}

// ── Admin builder helpers ──────────────────────────────────────────────────────────────

export interface DraftAssessmentQuestion {
  id: string
  label: string
  type: AssessmentQuestionType
  required: boolean
  optionsText: string
  correctText: string // radio/dropdown/yesno: the option text; checkbox: newline-separated
  marks: string
}

export const newAssessmentDraft = (): DraftAssessmentQuestion => ({
  id: 'aq_' + Math.random().toString(36).slice(2, 8),
  label: '',
  type: 'radio',
  required: true,
  optionsText: '',
  correctText: '',
  marks: '1',
})

export const toAssessmentDraft = (q: AssessmentQuestionFull): DraftAssessmentQuestion => ({
  id: q.id,
  label: q.label,
  type: q.type,
  required: q.required,
  optionsText: (q.options ?? []).join('\n'),
  correctText: Array.isArray(q.correctAnswer) ? q.correctAnswer.join('\n') : q.correctAnswer ?? '',
  marks: String(q.marks || ''),
})

export function draftsToAssessmentQuestions(
  drafts: DraftAssessmentQuestion[]
): { ok: true; questions: AssessmentQuestionFull[] } | { ok: false; message: string } {
  if (drafts.length > MAX_QUESTIONS) return { ok: false, message: `You can add at most ${MAX_QUESTIONS} questions.` }
  const questions: AssessmentQuestionFull[] = []
  for (let i = 0; i < drafts.length; i++) {
    const d = drafts[i]
    const label = d.label.trim()
    if (!label) return { ok: false, message: `Question ${i + 1} needs a title.` }
    const scorable = SCORABLE_TYPES.has(d.type)

    let options: string[] | undefined
    if (d.type === 'yesno') options = YESNO_OPTIONS
    else if (d.type === 'radio' || d.type === 'checkbox' || d.type === 'dropdown') {
      const lines = d.optionsText.split('\n').map((l) => l.trim()).filter(Boolean)
      options = lines.filter((o, idx) => lines.indexOf(o) === idx)
      if (options.length < 2) return { ok: false, message: `"${label}" needs at least 2 options (one per line).` }
    }

    let correctAnswer: AnswerValue | undefined
    let marks = 0
    if (scorable) {
      if (d.type === 'checkbox') {
        const chosen = d.correctText.split('\n').map((l) => l.trim()).filter(Boolean)
        if (chosen.some((c) => !options!.includes(c))) return { ok: false, message: `"${label}": correct answer(s) must match the listed options.` }
        if (chosen.length) correctAnswer = [...new Set(chosen)]
      } else {
        const c = d.correctText.trim()
        if (c) {
          if (!options!.includes(c)) return { ok: false, message: `"${label}": correct answer must match one of the listed options.` }
          correctAnswer = c
        }
      }
      if (correctAnswer !== undefined) {
        marks = Number(d.marks)
        if (!Number.isFinite(marks) || marks < 0) return { ok: false, message: `"${label}": marks must be a number 0 or greater.` }
      }
    }

    questions.push({
      id: d.id,
      label,
      type: d.type,
      required: d.required,
      marks,
      ...(options ? { options } : {}),
      ...(correctAnswer !== undefined ? { correctAnswer } : {}),
    })
  }
  return { ok: true, questions }
}
