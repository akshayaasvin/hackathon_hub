import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const createClient = async () => {
  const cookieStore = await cookies()

  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )

  if (process.env.NEXT_PUBLIC_MOCK_AUTH === 'true') {
    const mockUserCookie = cookieStore.get('mock_user')
    const mockUser = mockUserCookie ? JSON.parse(decodeURIComponent(mockUserCookie.value)) : null

    const mockAuth = {
      getUser: async () => {
        return { data: { user: mockUser }, error: null as any }
      },
      getSession: async () => {
        return { data: { session: mockUser ? { user: mockUser } : null }, error: null as any }
      },
      signOut: async () => {
        return { error: null as any }
      }
    }

    class MockQueryBuilderServer {
      private tableName: string;
      private mockUserObj: any;
      private filters: Array<{ col: string; val: any }> = [];
      private singleResult: boolean = false;
      private maybeSingleResult: boolean = false;

      constructor(tableName: string, mockUserObj: any) {
        this.tableName = tableName;
        this.mockUserObj = mockUserObj;
      }

      select(columns: string = '*') {
        return this;
      }

      insert(values: any) {
        return this;
      }

      update(values: any) {
        return this;
      }

      delete() {
        return this;
      }

      eq(column: string, value: any) {
        this.filters.push({ col: column, val: value });
        return this;
      }

      in(column: string, values: any[]) {
        this.filters.push({ col: column, val: values });
        return this;
      }

      single() {
        this.singleResult = true;
        return this;
      }

      maybeSingle() {
        this.maybeSingleResult = true;
        return this;
      }

      order(column: string, options?: any) {
        return this;
      }

      limit(n: number) {
        return this;
      }

      async then(resolve: any, reject?: any) {
        if (resolve) {
          if (this.tableName === 'users') {
            if (this.mockUserObj) {
              const profile = {
                id: this.mockUserObj.id,
                email: this.mockUserObj.email,
                full_name: this.mockUserObj.user_metadata?.full_name || 'Participant',
                role: this.mockUserObj.user_metadata?.role || 'participant',
                created_at: new Date().toISOString()
              };
              resolve({ data: (this.singleResult || this.maybeSingleResult) ? profile : [profile], error: null as any });
            } else {
              resolve({ data: (this.singleResult || this.maybeSingleResult) ? null : [], error: null as any });
            }
          } else {
            // For other mocked tables like colleges or students on server-side
            resolve({ data: (this.singleResult || this.maybeSingleResult) ? null : [], error: null as any });
          }
        }
      }
    }

    return new Proxy(client, {
      get(target, prop, receiver) {
        if (prop === 'auth') {
          return mockAuth
        }
        if (prop === 'from') {
          return (tableName: string) => {
            if (tableName === 'users' || tableName === 'colleges' || tableName === 'students') {
              return new MockQueryBuilderServer(tableName, mockUser);
            }
            const origMethod = Reflect.get(target, prop, receiver);
            return origMethod.bind(target)(tableName);
          }
        }
        return Reflect.get(target, prop, receiver)
      }
    })
  }

  return client
}