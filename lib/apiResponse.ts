import { NextResponse } from 'next/server'

// Next.js Route Handlers default to `Cache-Control: public, max-age=0, must-revalidate`
// for a GET response unless told otherwise — cacheable-with-revalidation, not "never cache".
// `export const dynamic = 'force-dynamic'` on a route stops NEXT's own Data/Route Cache from
// serving a stale response, but it does NOT change this header, so a browser or any
// intermediate cache is still free to store the response and revalidate it later — which is
// exactly how a just-deleted webinar/internship kept showing up after the delete: the list
// page itself was correctly fetched fresh, but the JSON it depends on wasn't. Every route
// using apiSuccess/apiError is a live read (registration/payment/admin state) or a write —
// none of them should ever be cached — so this is applied unconditionally here rather than
// per-route.
const NO_STORE = { 'Cache-Control': 'no-store' }

/** Standard success envelope: { success: true, message, data }. Always valid JSON, never cached. */
export function apiSuccess<T>(data?: T, message = 'Success', status = 200) {
  return NextResponse.json({ success: true, message, data: data ?? null }, { status, headers: NO_STORE })
}

/** Standard error envelope: { success: false, message }. Always valid JSON, never cached. */
export function apiError(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status, headers: NO_STORE })
}
