import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const mockUserCookie = request.cookies.get('mock_user')
  const mockUser = mockUserCookie ? JSON.parse(decodeURIComponent(mockUserCookie.value)) : null
  const isMockAuth = process.env.NEXT_PUBLIC_MOCK_AUTH === 'true' || !!mockUserCookie;

  if (isMockAuth) {
    const path = request.nextUrl.pathname

    const getDashboardUrl = (r: string) => {
      if (r === 'admin') return '/admin'
      if (r === 'jury') return '/jury'
      if (r === 'college') return '/college'
      return '/participant'
    }

    const role = mockUser?.user_metadata?.role || 'participant'

    if (path === '/' || path === '/login' || path === '/register' || path === '/login-simple') {
      if (mockUser && path !== '/') {
        return NextResponse.redirect(new URL(getDashboardUrl(role), request.url))
      }
      return response
    }

    if (!mockUser) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Role checks from mock metadata
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
  if (path === '/' || path === '/login' || path === '/register' || path === '/login-simple') {
    if (user && path !== '/') {
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()
      const role = userData?.role || 'participant'
      return NextResponse.redirect(new URL(getDashboardUrl(role), request.url))
    }
    return response
  }

  // Route protection
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Fetch role
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  const role = userData?.role || 'participant'

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
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
