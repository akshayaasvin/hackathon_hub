export type UserRole = 'participant' | 'college' | 'admin' | 'jury'

export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  created_at: string
}

export interface Hackathon {
  id: string
  name: string
  description: string
  theme: string
  start_date: string
  end_date: string
  registration_deadline: string
  registration_fee: number
  max_team_size: number
  status: 'draft' | 'published' | 'ongoing' | 'completed'
  created_at: string
}