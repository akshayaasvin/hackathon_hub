import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  const getDashboardUrl = (r: string) => {
    if (r === 'admin') return '/admin'
    if (r === 'jury') return '/jury'
    if (r === 'college') return '/college'
    return '/participant'
  }

  // Public/Auth routes
  if (path === '/' || path === '/login' || path === '/register') {
    if (user && path !== '/') {
      const { data: userData } = await supabase
        .from('users')
        .select('role, status')
        .eq('id', user.id)
        .single()
      if (userData?.status === 'pending') {
        return NextResponse.redirect(new URL('/pending-approval', request.url))
      }
      if (userData?.status === 'rejected') {
        return NextResponse.redirect(new URL('/account-rejected', request.url))
      }
      const role = userData?.role || 'participant'
      return NextResponse.redirect(new URL(getDashboardUrl(role), request.url))
    }
    return response
  }

  // Route protection
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Fetch role + status
  const { data: userData } = await supabase
    .from('users')
    .select('role, status')
    .eq('id', user.id)
    .single()
  const role = userData?.role || 'participant'
  const status = userData?.status || 'pending'

  if (path === '/pending-approval' || path === '/account-rejected') {
    if (status === 'active') {
      return NextResponse.redirect(new URL(getDashboardUrl(role), request.url))
    }
    return response
  }

  if (status === 'pending') {
    return NextResponse.redirect(new URL('/pending-approval', request.url))
  }

  if (status === 'rejected') {
    return NextResponse.redirect(new URL('/account-rejected', request.url))
  }

  // Role Checks
  if (path.startsWith('/admin') && role !== 'admin') {
    return NextResponse.redirect(new URL(getDashboardUrl(role), request.url))
  }

  if (path.startsWith('/jury') && role !== 'jury') {
    return NextResponse.redirect(new URL(getDashboardUrl(role), request.url))
  }

  if (path.startsWith('/college') && role !== 'college') {
    return NextResponse.redirect(new URL(getDashboardUrl(role), request.url))
  }

  const participantPaths = ['/participant', '/results', '/certificates', '/profile']
  const isParticipantPath = participantPaths.some(p => path === p || path.startsWith(p + '/'))
  if (isParticipantPath && role !== 'participant') {
    return NextResponse.redirect(new URL(getDashboardUrl(role), request.url))
  }

  return response
}

export const config = {
  matcher: [
    // Exclude /api/** — every API route handles its own auth server-side
    // (registration is intentionally public; admin routes check requireAdmin()
    // internally). Letting middleware redirect unauthenticated API calls to
    // /login means the client receives an HTML page instead of JSON.
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
