import { istDateRangeToUTC } from '@/lib/dates'

/**
 * Filter state shared by the internship and webinar registration admin pages (list,
 * export, and "select all N matching filters" ID-fetch all apply exactly the same filters,
 * so there is only one place this logic lives).
 */
export interface RegistrationFilters {
  targetId: string // internship_id / webinar_id, '' = all
  status: string // '' = all
  search: string
  dateFrom: string // 'YYYY-MM-DD' (IST calendar date), '' = no lower bound
  dateTo: string // 'YYYY-MM-DD' (IST calendar date), '' = no upper bound
}

export const EMPTY_FILTERS: RegistrationFilters = { targetId: '', status: '', search: '', dateFrom: '', dateTo: '' }

// Characters PostgREST's `.or()` mini-language treats specially (`,` separates conditions,
// `(` `)` group them) — stripped from the search term before embedding it in an ilike
// pattern. Admin-only, RLS-gated either way, but this keeps the intended search scope from
// being silently widened by a stray comma/paren in the input.
function sanitizeForOrFilter(term: string): string {
  return term.replace(/[,()]/g, ' ').trim()
}

/**
 * Applies the shared filters to a Supabase query builder in place — targetColumn is
 * 'internship_id' or 'webinar_id', searchColumns are the text columns to match `search`
 * against (case-insensitive, substring). All filtering happens in Postgres via the query
 * itself, never by fetching rows and filtering in JS.
 */
export function applyRegistrationFilters<T extends { eq: any; gte: any; lt: any; or: any }>(
  query: T,
  targetColumn: string,
  filters: RegistrationFilters,
  searchColumns: string[]
): T {
  let q: any = query
  if (filters.targetId) q = q.eq(targetColumn, filters.targetId)
  if (filters.status) q = q.eq('status', filters.status)
  if (filters.dateFrom && filters.dateTo) {
    const range = istDateRangeToUTC(filters.dateFrom, filters.dateTo)
    if (range) q = q.gte('created_at', range.gte).lt('created_at', range.lt)
  }
  const term = sanitizeForOrFilter(filters.search)
  if (term) q = q.or(searchColumns.map((c) => `${c}.ilike.%${term}%`).join(','))
  return q
}

/** Parses the shared filter query-string params used by both the list fetch and the export route. */
export function filtersFromSearchParams(params: URLSearchParams, targetParam: string): RegistrationFilters {
  return {
    targetId: params.get(targetParam) || '',
    status: params.get('status') || '',
    search: params.get('search') || '',
    dateFrom: params.get('dateFrom') || '',
    dateTo: params.get('dateTo') || '',
  }
}
