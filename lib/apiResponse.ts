import { NextResponse } from 'next/server'

/** Standard success envelope: { success: true, message, data }. Always valid JSON. */
export function apiSuccess<T>(data?: T, message = 'Success', status = 200) {
  return NextResponse.json({ success: true, message, data: data ?? null }, { status })
}

/** Standard error envelope: { success: false, message }. Always valid JSON. */
export function apiError(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status })
}
