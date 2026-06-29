import { createBrowserClient } from '@supabase/ssr'

export const createClient = () => {
  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  if (process.env.NEXT_PUBLIC_MOCK_AUTH === 'true') {
    const seedMockUsers = () => {
      if (typeof window !== 'undefined') {
        const mockUsers: any[] = JSON.parse(localStorage.getItem('mock_users') || '[]')
        const defaultAccounts = [
          { id: 'ddbdc6a9-0602-47a0-9122-52901ae15855', email: 'participant@test.com', role: 'participant' },
          { id: '52a03e89-f5fd-449a-8c8e-da5f3331975c', email: 'admin@test.com', role: 'admin' },
          { id: 'db97b9f4-8d9c-4686-a6ed-40d1f56a36dd', email: 'jury@test.com', role: 'jury' },
          { id: '4c54426a-1625-4fe7-8174-7cc514262d1f', email: 'college@test.com', role: 'college' }
        ]
        let updated = false
        for (const acc of defaultAccounts) {
          if (!mockUsers.some(u => u.email === acc.email)) {
            mockUsers.push({
              id: acc.id,
              email: acc.email,
              password: 'password',
              user_metadata: {
                full_name: acc.email.split('@')[0],
                role: acc.role,
                college_name: acc.role === 'college' ? 'PSNA' : undefined
              }
            })
            updated = true
          }
        }
        if (updated) {
          localStorage.setItem('mock_users', JSON.stringify(mockUsers))
        }

        // Clean corrupted mock_users
        const cleanedUsers = mockUsers.filter((u: any) => u && u.email && u.id && u.user_metadata && u.user_metadata.role);
        if (cleanedUsers.length !== mockUsers.length) {
          localStorage.setItem('mock_users', JSON.stringify(cleanedUsers))
        }

        // Clean corrupted mock_user_profiles
        const mockProfiles = JSON.parse(localStorage.getItem('mock_user_profiles') || '{}')
        let profilesCleaned = false
        for (const key of Object.keys(mockProfiles)) {
          const p = mockProfiles[key]
          if (!p || !p.email || !p.role || !p.id) {
            delete mockProfiles[key]
            profilesCleaned = true
          }
        }
        if (profilesCleaned) {
          localStorage.setItem('mock_user_profiles', JSON.stringify(mockProfiles))
        }

        // Seed default colleges if missing
        if (!localStorage.getItem('mock_colleges')) {
          const defaultColleges = [
            { id: '4c54426a-1625-4fe7-8174-7cc514262d1f', college_name: 'PSNA', email: 'college@test.com', password: 'password', status: 'active', created_at: new Date().toISOString() },
            { id: 'mit-college-id-12345', college_name: 'MIT', email: 'mit@college.com', password: 'password', status: 'active', created_at: new Date().toISOString() },
            { id: 'anna-college-id-12345', college_name: 'Anna University', email: 'anna@college.com', password: 'password', status: 'active', created_at: new Date().toISOString() },
            { id: 'thiagarajar-college-id', college_name: 'Thiagarajar', email: 'thiagarajar@college.com', password: 'password', status: 'active', created_at: new Date().toISOString() }
          ]
          localStorage.setItem('mock_colleges', JSON.stringify(defaultColleges))
          
          // Seed the colleges users so they can log in
          const users = JSON.parse(localStorage.getItem('mock_users') || '[]')
          let usersUpdated = false
          for (const col of defaultColleges) {
            if (!users.some((u: any) => u.email === col.email)) {
              users.push({
                id: col.id,
                email: col.email,
                password: col.password,
                user_metadata: {
                  full_name: col.college_name,
                  role: 'college',
                  college_name: col.college_name
                }
              })
              usersUpdated = true
            }
          }
          if (usersUpdated) {
            localStorage.setItem('mock_users', JSON.stringify(users))
          }
        }

        // Seed default hackathons
        if (!localStorage.getItem('mock_hackathons')) {
          const defaultHackathons = [
            {
              id: "hackathon-1",
              name: "AI Innovation Hackathon",
              description: "Develop artificial intelligence solutions, agentic systems, or LLM integrations.",
              theme: "Artificial Intelligence",
              registration_deadline: new Date(Date.now() + 86400000 * 7).toISOString(),
              registration_fee: 0,
              max_team_size: 5,
              status: "published",
              created_at: new Date().toISOString()
            },
            {
              id: "hackathon-2",
              name: "Web3 Global Challenge",
              description: "Design decentralized applications, smart contracts, and Web3 solutions.",
              theme: "Blockchain",
              registration_deadline: new Date(Date.now() + 86400000 * 10).toISOString(),
              registration_fee: 15,
              max_team_size: 4,
              status: "published",
              created_at: new Date().toISOString()
            }
          ]
          localStorage.setItem('mock_hackathons', JSON.stringify(defaultHackathons))
        }

        // Seed default students
        if (!localStorage.getItem('mock_students')) {
          const defaultStudents = [
            { id: 'stud-ajay', college_id: 'anna-college-id-12345', name: 'Ajay', email: 'ajay@anna.edu', department: 'Computer Science', year: 3, status: 'Nominated', created_at: new Date().toISOString() },
            { id: 'stud-arun', college_id: 'anna-college-id-12345', name: 'Arun', email: 'arun@anna.edu', department: 'Information Technology', year: 4, status: 'Nominated', created_at: new Date().toISOString() },
            { id: 'stud-bala', college_id: 'anna-college-id-12345', name: 'Bala', email: 'bala@anna.edu', department: 'Electronics', year: 2, status: 'Nominated', created_at: new Date().toISOString() },
            { id: 'stud-gokul', college_id: '4c54426a-1625-4fe7-8174-7cc514262d1f', name: 'Gokul', email: 'gokul@psna.edu', department: 'Computer Science', year: 4, status: 'Nominated', created_at: new Date().toISOString() },
            { id: 'stud-hari', college_id: '4c54426a-1625-4fe7-8174-7cc514262d1f', name: 'Hari', email: 'hari@psna.edu', department: 'Mechanical Engineering', year: 3, status: 'Nominated', created_at: new Date().toISOString() },
            { id: 'stud-karthik', college_id: 'mit-college-id-12345', name: 'Karthik', email: 'karthik@mit.edu', department: 'Computer Science', year: 3, status: 'Nominated', created_at: new Date().toISOString() }
          ]
          localStorage.setItem('mock_students', JSON.stringify(defaultStudents))

          // Add to mock_users and mock_user_profiles as well, so these students exist in credentials
          const mockUsers = JSON.parse(localStorage.getItem('mock_users') || '[]')
          const mockProfiles = JSON.parse(localStorage.getItem('mock_user_profiles') || '{}')
          for (const s of defaultStudents) {
            if (!mockUsers.some((u: any) => u.email === s.email)) {
              mockUsers.push({
                id: s.id,
                email: s.email,
                password: 'password',
                user_metadata: {
                  full_name: s.name,
                  role: 'participant',
                  college_name: s.college_id === 'anna-college-id-12345' ? 'Anna University' : s.college_id === 'mit-college-id-12345' ? 'MIT' : 'PSNA',
                  department: s.department,
                  year_of_study: s.year
                }
              })
            }
            mockProfiles[s.id] = {
              id: s.id,
              email: s.email,
              full_name: s.name,
              role: 'participant',
              created_at: new Date().toISOString()
            }
          }
          localStorage.setItem('mock_users', JSON.stringify(mockUsers))
          localStorage.setItem('mock_user_profiles', JSON.stringify(mockProfiles))
        }

        // Seed default registrations
        if (!localStorage.getItem('mock_registrations')) {
          const defaultRegs = [
            { id: "reg-1", hackathon_id: "hackathon-1", user_id: "ddbdc6a9-0602-47a0-9122-52901ae15855", registration_status: "pending", payment_status: "pending", registered_at: new Date().toISOString() },
            { id: "reg-ajay", hackathon_id: "hackathon-1", user_id: "stud-ajay", registration_status: "confirmed", payment_status: "paid", registered_at: new Date().toISOString() },
            { id: "reg-arun", hackathon_id: "hackathon-1", user_id: "stud-arun", registration_status: "confirmed", payment_status: "paid", registered_at: new Date().toISOString() },
            { id: "reg-bala", hackathon_id: "hackathon-1", user_id: "stud-bala", registration_status: "confirmed", payment_status: "paid", registered_at: new Date().toISOString() },
            { id: "reg-gokul", hackathon_id: "hackathon-1", user_id: "stud-gokul", registration_status: "confirmed", payment_status: "paid", registered_at: new Date().toISOString() },
            { id: "reg-hari", hackathon_id: "hackathon-1", user_id: "stud-hari", registration_status: "confirmed", payment_status: "paid", registered_at: new Date().toISOString() },
            { id: "reg-karthik", hackathon_id: "hackathon-1", user_id: "stud-karthik", registration_status: "confirmed", payment_status: "paid", registered_at: new Date().toISOString() }
          ]
          localStorage.setItem('mock_registrations', JSON.stringify(defaultRegs))
        }

        // Seed default teams
        if (!localStorage.getItem('mock_teams')) {
          const defaultTeams = [
            { id: "team-1", team_name: "Alpha Coders", hackathon_id: "hackathon-1", team_lead_id: "ddbdc6a9-0602-47a0-9122-52901ae15855", created_at: new Date().toISOString() },
            { id: "team-anna", team_name: "Anna Avengers", hackathon_id: "hackathon-1", team_lead_id: "stud-ajay", created_at: new Date().toISOString() },
            { id: "team-psna", team_name: "PSNA Pioneers", hackathon_id: "hackathon-1", team_lead_id: "stud-gokul", created_at: new Date().toISOString() },
            { id: "team-mit", team_name: "MIT Mavericks", hackathon_id: "hackathon-1", team_lead_id: "stud-karthik", created_at: new Date().toISOString() }
          ]
          localStorage.setItem('mock_teams', JSON.stringify(defaultTeams))
        }

        // Seed default team members
        if (!localStorage.getItem('mock_team_members')) {
          const defaultMembers = [
            { id: "member-1", team_id: "team-1", user_id: "ddbdc6a9-0602-47a0-9122-52901ae15855", created_at: new Date().toISOString() },
            { id: "member-ajay", team_id: "team-anna", user_id: "stud-ajay", created_at: new Date().toISOString() },
            { id: "member-arun", team_id: "team-anna", user_id: "stud-arun", created_at: new Date().toISOString() },
            { id: "member-bala", team_id: "team-anna", user_id: "stud-bala", created_at: new Date().toISOString() },
            { id: "member-gokul", team_id: "team-psna", user_id: "stud-gokul", created_at: new Date().toISOString() },
            { id: "member-hari", team_id: "team-psna", user_id: "stud-hari", created_at: new Date().toISOString() },
            { id: "member-karthik", team_id: "team-mit", user_id: "stud-karthik", created_at: new Date().toISOString() }
          ]
          localStorage.setItem('mock_team_members', JSON.stringify(defaultMembers))
        }

        // Seed default submissions
        if (!localStorage.getItem('mock_submissions')) {
          const defaultSubs = [
            {
              id: "sub-1",
              team_id: "team-1",
              hackathon_id: "hackathon-1",
              project_title: "Smart Medical Diagnostic Agent",
              project_description: "An AI-powered diagnostic helper that reads symptoms and provides early advice using clinical APIs.",
              repo_link: "https://github.com/test/medical-agent",
              demo_video_url: "https://youtube.com/watch?v=demo",
              ppt_url: JSON.stringify({
                ppt: "https://google.com/slides/123",
                pdf: "https://google.com/docs/123.pdf"
              }),
              status: "submitted",
              created_at: new Date().toISOString()
            }
          ]
          localStorage.setItem('mock_submissions', JSON.stringify(defaultSubs))
        }

        // Seed default evaluations
        if (!localStorage.getItem('mock_evaluations')) {
          const defaultEvals = [
            { id: "eval-anna", judge_id: "db97b9f4-8d9c-4686-a6ed-40d1f56a36dd", team_id: "team-anna", hackathon_id: "hackathon-1", innovation_score: 9, technical_score: 9, impact: 9, ux: 9, presentation: 9, total_score: 90.0, feedback: "Excellent innovation and execution!" },
            { id: "eval-psna", judge_id: "db97b9f4-8d9c-4686-a6ed-40d1f56a36dd", team_id: "team-psna", hackathon_id: "hackathon-1", innovation_score: 8, technical_score: 9, impact: 8, ux: 9, presentation: 8, total_score: 85.0, feedback: "Great technical architecture!" },
            { id: "eval-mit", judge_id: "db97b9f4-8d9c-4686-a6ed-40d1f56a36dd", team_id: "team-mit", hackathon_id: "hackathon-1", innovation_score: 8, technical_score: 8, impact: 8, ux: 8, presentation: 8, total_score: 80.0, feedback: "Solid presentation and MVP." }
          ]
          localStorage.setItem('mock_evaluations', JSON.stringify(defaultEvals))
        }
      }
    }

    const mockAuth = {
      getUser: async () => {
        seedMockUsers()
        if (typeof window !== 'undefined') {
          const mockUserJson = localStorage.getItem('mock_user')
          if (mockUserJson) {
            return { data: { user: JSON.parse(mockUserJson) }, error: null as any }
          }
        }
        return { data: { user: null }, error: null as any }
      },
      getSession: async () => {
        seedMockUsers()
        if (typeof window !== 'undefined') {
          const mockUserJson = localStorage.getItem('mock_user')
          if (mockUserJson) {
            return { data: { session: { user: JSON.parse(mockUserJson) } }, error: null as any }
          }
        }
        return { data: { session: null }, error: null as any }
      },
      signInWithPassword: async ({ email, password }: any) => {
        seedMockUsers()
        if (typeof window !== 'undefined') {
          const mockUsers: any[] = JSON.parse(localStorage.getItem('mock_users') || '[]')
          let found = mockUsers.find((u: any) => u.email === email && u.password === password)
          
          if (!found) {
            // Auto-seed typical development test accounts for convenience
            let role = 'participant'
            let id = 'ddbdc6a9-0602-47a0-9122-52901ae15855'
            let collegeName = undefined
            if (email.includes('admin')) {
              role = 'admin'
              id = '52a03e89-f5fd-449a-8c8e-da5f3331975c'
            } else if (email.includes('jury')) {
              role = 'jury'
              id = 'db97b9f4-8d9c-4686-a6ed-40d1f56a36dd'
            } else if (email.includes('college')) {
              role = 'college'
              id = '4c54426a-1625-4fe7-8174-7cc514262d1f'
              collegeName = 'PSNA'
            }
 
            found = {
              id,
              email,
              password,
              user_metadata: {
                full_name: email.split('@')[0],
                role,
                college_name: collegeName
              }
            }
            mockUsers.push(found)
            localStorage.setItem('mock_users', JSON.stringify(mockUsers))
          }

          if (found) {
            localStorage.setItem('mock_user', JSON.stringify(found))
            // Set cookie for middleware
            document.cookie = `mock_user=${encodeURIComponent(JSON.stringify(found))}; path=/; max-age=3600`
            return { data: { user: found, session: {} }, error: null as any }
          }
        }
        return { data: { user: null, session: null }, error: { message: 'Invalid credentials in mock auth store.' } as any }
      },
      signUp: async ({ email, password, options }: any) => {
        if (typeof window !== 'undefined') {
          const mockUsers: any[] = JSON.parse(localStorage.getItem('mock_users') || '[]')
          if (mockUsers.some((u: any) => u.email === email)) {
            return { data: { user: null, session: null }, error: { message: 'User email already registered in mock auth store.' } as any }
          }
          
          let role = options?.data?.role || 'participant'
          if (email.includes('admin')) role = 'admin'
          else if (email.includes('jury')) role = 'jury'
          else if (email.includes('college')) role = 'college'

          let id = 'ddbdc6a9-0602-47a0-9122-52901ae15855'
          if (role === 'admin') id = '52a03e89-f5fd-449a-8c8e-da5f3331975c'
          else if (role === 'jury') id = 'db97b9f4-8d9c-4686-a6ed-40d1f56a36dd'
          else if (role === 'college') id = '4c54426a-1625-4fe7-8174-7cc514262d1f'
          else {
            id = Math.random().toString(36).substring(2, 9) + '-' + Math.random().toString(36).substring(2, 9)
          }
 
          const newUser = {
            id,
            email,
            password,
            user_metadata: {
              ...options?.data,
              role
            }
          }
          mockUsers.push(newUser)
          localStorage.setItem('mock_users', JSON.stringify(mockUsers))
          localStorage.setItem('mock_user', JSON.stringify(newUser))
          // Set cookie for middleware
          document.cookie = `mock_user=${encodeURIComponent(JSON.stringify(newUser))}; path=/; max-age=3600`
          return { data: { user: newUser, session: {} }, error: null as any }
        }
        return { data: { user: null, session: null }, error: { message: 'Signup failed.' } as any }
      },
      signOut: async () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('mock_user')
          document.cookie = 'mock_user=; path=/; max-age=0'
        }
        return { error: null as any }
      }
    }

    class MockQueryBuilder {
      private tableName: string;
      private filters: Array<{ col: string; val: any; op: 'eq' | 'in' }> = [];
      private selectedColumns: string = '*';
      private singleResult: boolean = false;
      private maybeSingleResult: boolean = false;
      private valuesToInsert: any = null;
      private valuesToUpdate: any = null;
      private isDelete: boolean = false;
      private orderCol: string | null = null;
      private orderAscending: boolean = true;
      private limitVal: number | null = null;

      constructor(tableName: string) {
        this.tableName = tableName;
      }

      select(columns: string = '*') {
        this.selectedColumns = columns;
        return this;
      }

      insert(values: any) {
        this.valuesToInsert = values;
        return this;
      }

      update(values: any) {
        this.valuesToUpdate = values;
        return this;
      }

      delete() {
        this.isDelete = true;
        return this;
      }

      eq(column: string, value: any) {
        this.filters.push({ col: column, val: value, op: 'eq' });
        return this;
      }

      in(column: string, values: any[]) {
        this.filters.push({ col: column, val: values, op: 'in' });
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

      order(column: string, options?: { ascending?: boolean }) {
        this.orderCol = column;
        this.orderAscending = options?.ascending !== false;
        return this;
      }

      limit(n: number) {
        this.limitVal = n;
        return this;
      }

      async then(resolve: any, reject?: any) {
        try {
          const data = await this.execute();
          if (resolve) resolve({ data, error: null });
        } catch (err: any) {
          if (resolve) resolve({ data: null, error: { message: err.message } });
        }
      }

      private async execute() {
        if (typeof window === 'undefined') {
          return (this.singleResult || this.maybeSingleResult) ? null : [];
        }

        seedMockUsers();

        // Helpers to load/save custom mocked tables
        const getTableData = (table: string) => {
          const stored = localStorage.getItem(`mock_${table}`)
          return stored ? JSON.parse(stored) : []
        }

        const saveTableData = (table: string, list: any[]) => {
          localStorage.setItem(`mock_${table}`, JSON.stringify(list))
        }

        // ------------------ USERS TABLE ------------------
        if (this.tableName === 'users') {
          const mockUserJson = localStorage.getItem('mock_user');
          const mockUser = mockUserJson ? JSON.parse(mockUserJson) : null;
          const mockUsers: any[] = JSON.parse(localStorage.getItem('mock_users') || '[]');
          const mockProfiles = JSON.parse(localStorage.getItem('mock_user_profiles') || '{}');

          if (mockUser && !mockProfiles[mockUser.id]) {
            mockProfiles[mockUser.id] = {
              id: mockUser.id,
              email: mockUser.email,
              full_name: mockUser.user_metadata?.full_name || 'Participant',
              role: mockUser.user_metadata?.role || 'participant',
              created_at: new Date().toISOString()
            };
            localStorage.setItem('mock_user_profiles', JSON.stringify(mockProfiles));
          }

          // Handle insert
          if (this.valuesToInsert) {
            const profiles = Array.isArray(this.valuesToInsert) ? this.valuesToInsert : [this.valuesToInsert];
            for (const profile of profiles) {
              mockProfiles[profile.id] = {
                ...mockProfiles[profile.id],
                ...profile
              };
            }
            localStorage.setItem('mock_user_profiles', JSON.stringify(mockProfiles));
            return this.singleResult ? profiles[0] : profiles;
          }

          // Handle update
          if (this.valuesToUpdate) {
            const filterId = this.filters.find(f => f.col === 'id')?.val;
            if (filterId) {
              mockProfiles[filterId] = {
                ...mockProfiles[filterId],
                ...this.valuesToUpdate
              };
              localStorage.setItem('mock_user_profiles', JSON.stringify(mockProfiles));

              // Sync to mock_users
              const uIdx = mockUsers.findIndex((u: any) => u.id === filterId);
              if (uIdx !== -1) {
                if (this.valuesToUpdate.role !== undefined) {
                  mockUsers[uIdx].user_metadata.role = this.valuesToUpdate.role;
                }
                if (this.valuesToUpdate.full_name !== undefined) {
                  mockUsers[uIdx].user_metadata.full_name = this.valuesToUpdate.full_name;
                }
                localStorage.setItem('mock_users', JSON.stringify(mockUsers));

                // If this is the active user, update mock_user session and cookie
                const activeUserJson = localStorage.getItem('mock_user');
                if (activeUserJson) {
                  const activeUser = JSON.parse(activeUserJson);
                  if (activeUser.id === filterId) {
                    activeUser.user_metadata.role = mockUsers[uIdx].user_metadata.role;
                    activeUser.user_metadata.full_name = mockUsers[uIdx].user_metadata.full_name;
                    localStorage.setItem('mock_user', JSON.stringify(activeUser));
                    document.cookie = `mock_user=${encodeURIComponent(JSON.stringify(activeUser))}; path=/; max-age=3600`;
                  }
                }
              }
            }
            return this.valuesToUpdate;
          }

          // Handle delete
          if (this.isDelete) {
            const filterId = this.filters.find(f => f.col === 'id')?.val;
            if (filterId) {
              delete mockProfiles[filterId];
              localStorage.setItem('mock_user_profiles', JSON.stringify(mockProfiles));

              // Also delete from mock_users so they cannot log in and disappear from lists
              const filteredUsers = mockUsers.filter((u: any) => u.id !== filterId);
              localStorage.setItem('mock_users', JSON.stringify(filteredUsers));
            }
            return [];
          }

          // Handle select
          let list = Object.values(mockProfiles);
          if (list.length === 0 && mockUser) {
            list = [mockProfiles[mockUser.id]];
          }

          for (const u of mockUsers) {
            if (!mockProfiles[u.id]) {
              list.push({
                id: u.id,
                email: u.email,
                full_name: u.user_metadata?.full_name || 'Participant',
                role: u.user_metadata?.role || 'participant',
                created_at: new Date().toISOString()
              });
            }
          }

          // Apply filters
          for (const filter of this.filters) {
            if (filter.op === 'in') {
              list = list.filter((item: any) => filter.val.includes(item[filter.col]));
            } else {
              list = list.filter((item: any) => item[filter.col] === filter.val);
            }
          }

          if (this.singleResult || this.maybeSingleResult) {
            return list[0] || null;
          }
          return list;
        }

        // ------------------ COLLEGES TABLE ------------------
        if (this.tableName === 'colleges') {
          let colleges: any[] = JSON.parse(localStorage.getItem('mock_colleges') || '[]');

          // Handle insert
          if (this.valuesToInsert) {
            const rows = Array.isArray(this.valuesToInsert) ? this.valuesToInsert : [this.valuesToInsert];
            const inserted: any[] = [];
            for (const r of rows) {
              const newCol = {
                id: r.id || Math.random().toString(36).substring(2, 9) + '-' + Math.random().toString(36).substring(2, 9),
                college_name: r.college_name,
                email: r.email,
                password: r.password || 'password',
                status: r.status || 'active',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };
              colleges.push(newCol);
              inserted.push(newCol);

              // Auto-create in mock_users & mock_user_profiles
              const mockUsers: any[] = JSON.parse(localStorage.getItem('mock_users') || '[]');
              if (!mockUsers.some(u => u.email === newCol.email)) {
                mockUsers.push({
                  id: newCol.id,
                  email: newCol.email,
                  password: newCol.password,
                  user_metadata: {
                    full_name: newCol.college_name,
                    role: 'college',
                    college_name: newCol.college_name
                  }
                });
                localStorage.setItem('mock_users', JSON.stringify(mockUsers));
              }
              const mockProfiles = JSON.parse(localStorage.getItem('mock_user_profiles') || '{}');
              mockProfiles[newCol.id] = {
                id: newCol.id,
                email: newCol.email,
                full_name: newCol.college_name,
                role: 'college',
                created_at: new Date().toISOString()
              };
              localStorage.setItem('mock_user_profiles', JSON.stringify(mockProfiles));
            }
            localStorage.setItem('mock_colleges', JSON.stringify(colleges));
            return this.singleResult ? inserted[0] : inserted;
          }

          // Handle update
          if (this.valuesToUpdate) {
            let updatedRows: any[] = [];
            colleges = colleges.map(col => {
              let match = true;
              for (const filter of this.filters) {
                if (filter.op === 'in') {
                  if (!filter.val.includes(col[filter.col])) match = false;
                } else {
                  if (col[filter.col] !== filter.val) match = false;
                }
              }
              if (match) {
                const updated = {
                  ...col,
                  ...this.valuesToUpdate,
                  updated_at: new Date().toISOString()
                };
                updatedRows.push(updated);
                
                // Keep auth users in sync if credentials changed
                const mockUsers = JSON.parse(localStorage.getItem('mock_users') || '[]');
                const uIdx = mockUsers.findIndex((u: any) => u.id === col.id);
                if (uIdx !== -1) {
                  mockUsers[uIdx].email = updated.email;
                  mockUsers[uIdx].password = updated.password;
                  mockUsers[uIdx].user_metadata.full_name = updated.college_name;
                  localStorage.setItem('mock_users', JSON.stringify(mockUsers));
                }
                
                return updated;
              }
              return col;
            });
            localStorage.setItem('mock_colleges', JSON.stringify(colleges));
            return this.singleResult ? updatedRows[0] : updatedRows;
          }

          // Handle delete
          if (this.isDelete) {
            colleges = colleges.filter(col => {
              let match = true;
              for (const filter of this.filters) {
                if (filter.op === 'in') {
                  if (!filter.val.includes(col[filter.col])) match = false;
                } else {
                  if (col[filter.col] !== filter.val) match = false;
                }
              }
              if (match) {
                // Delete from mock users too
                const mockUsers = JSON.parse(localStorage.getItem('mock_users') || '[]');
                const filteredUsers = mockUsers.filter((u: any) => u.id !== col.id);
                localStorage.setItem('mock_users', JSON.stringify(filteredUsers));
                
                const mockProfiles = JSON.parse(localStorage.getItem('mock_user_profiles') || '{}');
                delete mockProfiles[col.id];
                localStorage.setItem('mock_user_profiles', JSON.stringify(mockProfiles));
                return false;
              }
              return true;
            });
            localStorage.setItem('mock_colleges', JSON.stringify(colleges));
            return [];
          }

          // Handle select
          let list = colleges;
          for (const filter of this.filters) {
            if (filter.op === 'in') {
              list = list.filter((item: any) => filter.val.includes(item[filter.col]));
            } else {
              list = list.filter((item: any) => item[filter.col] === filter.val);
            }
          }

          if (this.orderCol) {
            const c = this.orderCol;
            const asc = this.orderAscending;
            list.sort((a, b) => {
              if (a[c] < b[c]) return asc ? -1 : 1;
              if (a[c] > b[c]) return asc ? 1 : -1;
              return 0;
            });
          }

          if (this.limitVal !== null) {
            list = list.slice(0, this.limitVal);
          }

          if (this.singleResult || this.maybeSingleResult) {
            return list[0] || null;
          }
          return list;
        }

        // ------------------ STUDENTS TABLE ------------------
        if (this.tableName === 'students') {
          let students: any[] = JSON.parse(localStorage.getItem('mock_students') || '[]');

          // Handle insert
          if (this.valuesToInsert) {
            const rows = Array.isArray(this.valuesToInsert) ? this.valuesToInsert : [this.valuesToInsert];
            const inserted: any[] = [];
            for (const r of rows) {
              const newStud = {
                id: r.id || Math.random().toString(36).substring(2, 9) + '-' + Math.random().toString(36).substring(2, 9),
                college_id: r.college_id,
                name: r.name,
                email: r.email,
                department: r.department,
                year: r.year,
                status: r.status || 'Active',
                created_at: new Date().toISOString()
              };
              students.push(newStud);
              inserted.push(newStud);

              // Auto-create in mock_users & mock_user_profiles as a participant so they can log in
              const mockUsers: any[] = JSON.parse(localStorage.getItem('mock_users') || '[]');
              if (!mockUsers.some(u => u.email === newStud.email)) {
                // Find college name
                const colleges = JSON.parse(localStorage.getItem('mock_colleges') || '[]');
                const colName = colleges.find((c: any) => c.id === newStud.college_id)?.college_name || 'College';
                
                mockUsers.push({
                  id: newStud.id,
                  email: newStud.email,
                  password: 'password', // default student password
                  user_metadata: {
                    full_name: newStud.name,
                    role: 'participant',
                    college_name: colName,
                    department: newStud.department,
                    year_of_study: newStud.year
                  }
                });
                localStorage.setItem('mock_users', JSON.stringify(mockUsers));
              }
              const mockProfiles = JSON.parse(localStorage.getItem('mock_user_profiles') || '{}');
              mockProfiles[newStud.id] = {
                id: newStud.id,
                email: newStud.email,
                full_name: newStud.name,
                role: 'participant',
                created_at: new Date().toISOString()
              };
              localStorage.setItem('mock_user_profiles', JSON.stringify(mockProfiles));
            }
            localStorage.setItem('mock_students', JSON.stringify(students));
            return this.singleResult ? inserted[0] : inserted;
          }

          // Handle update
          if (this.valuesToUpdate) {
            let updatedRows: any[] = [];
            students = students.map(stud => {
              let match = true;
              for (const filter of this.filters) {
                if (filter.op === 'in') {
                  if (!filter.val.includes(stud[filter.col])) match = false;
                } else {
                  if (stud[filter.col] !== filter.val) match = false;
                }
              }
              if (match) {
                const updated = {
                  ...stud,
                  ...this.valuesToUpdate
                };
                updatedRows.push(updated);
                
                // Keep auth users in sync
                const mockUsers = JSON.parse(localStorage.getItem('mock_users') || '[]');
                const uIdx = mockUsers.findIndex((u: any) => u.id === stud.id);
                if (uIdx !== -1) {
                  mockUsers[uIdx].email = updated.email;
                  mockUsers[uIdx].user_metadata.full_name = updated.name;
                  mockUsers[uIdx].user_metadata.department = updated.department;
                  mockUsers[uIdx].user_metadata.year_of_study = updated.year;
                  localStorage.setItem('mock_users', JSON.stringify(mockUsers));
                }
                
                return updated;
              }
              return stud;
            });
            localStorage.setItem('mock_students', JSON.stringify(students));
            return this.singleResult ? updatedRows[0] : updatedRows;
          }

          // Handle delete
          if (this.isDelete) {
            students = students.filter(stud => {
              let match = true;
              for (const filter of this.filters) {
                if (filter.op === 'in') {
                  if (!filter.val.includes(stud[filter.col])) match = false;
                } else {
                  if (stud[filter.col] !== filter.val) match = false;
                }
              }
              if (match) {
                // Delete from auth users too
                const mockUsers = JSON.parse(localStorage.getItem('mock_users') || '[]');
                const filteredUsers = mockUsers.filter((u: any) => u.id !== stud.id);
                localStorage.setItem('mock_users', JSON.stringify(filteredUsers));
                
                const mockProfiles = JSON.parse(localStorage.getItem('mock_user_profiles') || '{}');
                delete mockProfiles[stud.id];
                localStorage.setItem('mock_user_profiles', JSON.stringify(mockProfiles));
                return false;
              }
              return true;
            });
            localStorage.setItem('mock_students', JSON.stringify(students));
            return [];
          }

          // Handle select
          let list = students;
          for (const filter of this.filters) {
            if (filter.op === 'in') {
              list = list.filter((item: any) => filter.val.includes(item[filter.col]));
            } else {
              list = list.filter((item: any) => item[filter.col] === filter.val);
            }
          }

          if (this.orderCol) {
            const c = this.orderCol;
            const asc = this.orderAscending;
            list.sort((a, b) => {
              if (a[c] < b[c]) return asc ? -1 : 1;
              if (a[c] > b[c]) return asc ? 1 : -1;
              return 0;
            });
          }

          if (this.limitVal !== null) {
            list = list.slice(0, this.limitVal);
          }

          if (this.singleResult || this.maybeSingleResult) {
            return list[0] || null;
          }
          return list;
        }

        // ------------------ OTHER GENERIC MOCKED TABLES ------------------
        // Handle insert for generic tables
        if (this.valuesToInsert) {
          const tableList = getTableData(this.tableName);
          const rows = Array.isArray(this.valuesToInsert) ? this.valuesToInsert : [this.valuesToInsert];
          const inserted: any[] = [];
          for (const r of rows) {
            const newRow = {
              id: r.id || Math.random().toString(36).substring(2, 9) + '-' + Math.random().toString(36).substring(2, 9),
              ...r,
              created_at: r.created_at || new Date().toISOString()
            };
            tableList.push(newRow);
            inserted.push(newRow);
          }
          saveTableData(this.tableName, tableList);
          return this.singleResult ? inserted[0] : inserted;
        }

        // Handle update for generic tables
        if (this.valuesToUpdate) {
          let tableList = getTableData(this.tableName);
          let updatedRows: any[] = [];
          tableList = tableList.map((row: any) => {
            let match = true;
            for (const filter of this.filters) {
              if (filter.op === 'in') {
                if (!filter.val.includes(row[filter.col])) match = false;
              } else {
                if (row[filter.col] !== filter.val) match = false;
              }
            }
            if (match) {
              const updated = {
                ...row,
                ...this.valuesToUpdate,
                updated_at: new Date().toISOString()
              };
              updatedRows.push(updated);
              return updated;
            }
            return row;
          });
          saveTableData(this.tableName, tableList);
          return this.singleResult ? updatedRows[0] : updatedRows;
        }

        // Handle delete for generic tables
        if (this.isDelete) {
          let tableList = getTableData(this.tableName);
          tableList = tableList.filter((row: any) => {
            let match = true;
            for (const filter of this.filters) {
              if (filter.op === 'in') {
                if (!filter.val.includes(row[filter.col])) match = false;
              } else {
                if (row[filter.col] !== filter.val) match = false;
              }
            }
            return !match;
          });
          saveTableData(this.tableName, tableList);
          return [];
        }

        // Handle select for generic tables
        let list = getTableData(this.tableName);

        // Apply filters
        for (const filter of this.filters) {
          if (filter.op === 'in') {
            list = list.filter((item: any) => filter.val.includes(item[filter.col]));
          } else {
            list = list.filter((item: any) => item[filter.col] === filter.val);
          }
        }

        // Apply ordering
        if (this.orderCol) {
          const c = this.orderCol;
          const asc = this.orderAscending;
          list.sort((a: any, b: any) => {
            if (a[c] < b[c]) return asc ? -1 : 1;
            if (a[c] > b[c]) return asc ? 1 : -1;
            return 0;
          });
        }

        // Apply limit
        if (this.limitVal !== null) {
          list = list.slice(0, this.limitVal);
        }

        // Resolve relational joins
        if (this.tableName === 'registrations') {
          const hackathons = getTableData('hackathons');
          const users = Object.values(JSON.parse(localStorage.getItem('mock_user_profiles') || '{}'));
          const mockUsers = JSON.parse(localStorage.getItem('mock_users') || '[]');

          list = list.map((reg: any) => {
            const hack = hackathons.find((h: any) => h.id === reg.hackathon_id);
            let u = users.find((usr: any) => usr.id === reg.user_id);
            if (!u) {
              const mu = mockUsers.find((usr: any) => usr.id === reg.user_id);
              if (mu) {
                u = {
                  id: mu.id,
                  email: mu.email,
                  full_name: mu.user_metadata?.full_name || 'Participant',
                  role: mu.user_metadata?.role || 'participant',
                  created_at: new Date().toISOString()
                };
              }
            }
            return {
              ...reg,
              hackathons: hack || null,
              users: u || null
            };
          });
        } else if (this.tableName === 'teams') {
          const hackathons = getTableData('hackathons');
          const teamMembers = getTableData('team_members');
          list = list.map((team: any) => {
            const hack = hackathons.find((h: any) => h.id === team.hackathon_id);
            const membersCount = teamMembers.filter((tm: any) => tm.team_id === team.id).length;

            const evaluations = getTableData('evaluations');
            const teamEvals = evaluations.filter((e: any) => e.team_id === team.id);

            return {
              ...team,
              hackathons: hack || null,
              team_members: [{ count: membersCount }],
              evaluations: teamEvals
            };
          });
        }

        if (this.singleResult || this.maybeSingleResult) {
          return list[0] || null;
        }
        return list;
      }
    }

    return new Proxy(client, {
      get(target, prop, receiver) {
        if (prop === 'auth') {
          return mockAuth
        }
        if (prop === 'from') {
          return (tableName: string) => {
            return new MockQueryBuilder(tableName);
          }
        }
        return Reflect.get(target, prop, receiver)
      }
    })
  }

  return client
}