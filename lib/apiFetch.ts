export interface ApiResult<T = any> {
  success: boolean
  message: string
  data?: T
}

/**
 * POSTs JSON and always resolves to a usable result — never throws on a
 * network error, empty body, or non-JSON response (e.g. an HTML error page).
 */
export async function postJson<T = any>(url: string, body: unknown): Promise<ApiResult<T>> {
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    return { success: false, message: 'Network error. Check your connection and try again.' }
  }

  const text = await res.text()
  let json: any = null
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = null
    }
  }

  if (!json) {
    return {
      success: false,
      message: res.ok
        ? 'Server returned an empty response. Please try again.'
        : `Server error (${res.status}). Please try again.`,
    }
  }

  if (typeof json.success === 'boolean') {
    return json
  }

  // Defensive fallback in case any endpoint doesn't use the standard envelope.
  return res.ok
    ? { success: true, message: json.message || 'Success', data: json }
    : { success: false, message: json.message || json.error || 'Request failed.' }
}
