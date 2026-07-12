import { createBrowserClient } from '@supabase/ssr'

export const createClient = () => {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Every "Logout" button in the app should call this, not supabase.auth.signOut()
// directly. supabase.auth.signOut() can throw (an already-expired or
// already-revoked refresh token, a network blip) — with no try/catch around
// it, that exception used to abort the handler before the redirect line ever
// ran, so the user stayed stuck on the same page looking still logged in.
// This always clears the sb-* auth cookies itself (belt-and-suspenders on
// top of whatever signOut() managed) and always redirects via a full page
// load, regardless of whether the network call to revoke the session
// server-side succeeded — a full reload guarantees middleware re-evaluates
// auth from the now-cleared cookies rather than trusting cached client state.
export async function signOutAndRedirect(redirectTo: string = '/') {
  const supabase = createClient()
  try {
    await supabase.auth.signOut()
  } catch (err) {
    console.error('[signOutAndRedirect] supabase.auth.signOut() failed:', err)
  } finally {
    document.cookie.split(';').forEach((c) => {
      const name = c.split('=')[0].trim()
      if (name.startsWith('sb-')) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
      }
    })
    window.location.href = redirectTo
  }
}
