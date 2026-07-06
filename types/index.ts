export type UserRole = 'participant' | 'college' | 'admin' | 'jury'
export type UserStatus = 'pending' | 'approved' | 'rejected' | 'active'

export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  status: UserStatus
  created_at: string
  updated_at: string
}

export interface ParticipantProfile {
  user_id: string
  college_name: string
  passout_year: number
  degree: string
  domain: string
  experience_level: 'fresher' | 'experienced'
  contact_number: string
  address: string
  date_of_birth: string | null
  created_at: string
  updated_at: string
}

export interface CollegeProfile {
  user_id: string
  college_name: string
  representative_name: string
  position_in_college: string
  date_of_birth: string | null
  official_email: string
  personal_email: string | null
  contact_number: string
  department: string | null
  college_address: string
  created_at: string
  updated_at: string
}

export interface JuryProfile {
  user_id: string
  full_name: string
  contact_number: string
  email: string
  official_email: string | null
  organization_name: string | null
  portfolio_url: string | null
  occupation: string
  experience_years: number | null
  date_of_birth: string | null
  location: string
  created_at: string
  updated_at: string
}

export type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested'

export interface CollegeApplication {
  id: string
  college_name: string
  representative_name: string
  position_in_college: string
  date_of_birth: string | null
  official_email: string
  personal_email: string | null
  contact_number: string
  department: string | null
  college_address: string
  status: ApplicationStatus
  admin_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_user_id: string | null
  created_at: string
  updated_at: string
}

export interface JuryApplication {
  id: string
  full_name: string
  contact_number: string
  email: string
  official_email: string | null
  organization_name: string | null
  portfolio_url: string | null
  occupation: string
  experience_years: number | null
  date_of_birth: string | null
  location: string
  status: ApplicationStatus
  admin_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_user_id: string | null
  created_at: string
  updated_at: string
}

export interface Hackathon {
  id: string
  name: string
  description: string
  theme: string
  banner_url: string | null
  rules: string | null
  eligibility: string | null
  registration_deadline: string
  start_date: string
  end_date: string
  prize_details: string | null
  max_team_size: number
  razorpay_button_id: string | null
  status: 'draft' | 'published' | 'ongoing' | 'completed'
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Team {
  id: string
  hackathon_id: string
  team_name: string
  team_code: string
  team_lead_id: string | null
  created_at: string
  updated_at: string
}

export interface TeamMember {
  id: string
  team_id: string
  user_id: string
  joined_at: string
}

export interface Registration {
  id: string
  hackathon_id: string
  user_id: string
  team_id: string | null
  registration_status: 'pending' | 'confirmed' | 'cancelled'
  registered_at: string
}

export interface Submission {
  id: string
  team_id: string
  hackathon_id: string
  project_title: string | null
  problem_statement: string | null
  solution: string | null
  features: string | null
  repo_link: string | null
  demo_video_url: string | null
  ppt_url: string | null
  report_pdf_url: string | null
  status: 'draft' | 'submitted'
  submitted_at: string | null
  created_at: string
  updated_at: string
}

export interface Evaluation {
  id: string
  judge_id: string
  team_id: string
  hackathon_id: string
  innovation_score: number
  technical_score: number
  ux_score: number
  feasibility_score: number
  presentation_score: number
  total_score: number
  feedback: string | null
  submitted_at: string
}

export interface Certificate {
  id: string
  user_id: string
  hackathon_id: string
  certificate_type: 'participant' | 'finalist' | 'winner' | 'judge'
  certificate_id: string
  verification_code: string
  pdf_url: string | null
  issued_at: string
}

export interface JudgeAssignment {
  id: string
  judge_id: string
  team_id: string
  hackathon_id: string
  assigned_at: string
}

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: string | null
  read: boolean
  created_at: string
}

export interface Announcement {
  id: string
  title: string
  message: string
  target_role: 'all' | 'participant' | 'admin' | 'jury' | 'college'
  created_by: string | null
  created_at: string
}

export interface Winner {
  id: string
  hackathon_id: string
  team_id: string
  rank: number
  prize_amount: number | null
  declared_at: string
}
