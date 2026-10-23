export type ApplicationStatus = 'submitted' | 'shortlisted' | 'accepted' | 'rejected'

export type Project = {
  id: number
  remoteId?: string
  title: string
  company: string
  description: string
  skills: string[]
  duration: string
  applicants: number
  status?: 'live' | 'closed'
  industry?: string
  workMode?: string
  location?: string
  compensation?: string
}

export type Profile = {
  fullName: string
  role: 'student' | 'employer'
  bio: string
  skills: string[]
  education: string
  website: string
  github: string
  linkedin: string
  resumePath: string
  resumeName: string
  industry: string
}

export type Application = {
  id: number
  remoteId?: string
  projectId: number
  remoteProjectId?: string
  studentRemoteId?: string
  employerRemoteId?: string
  studentName: string
  studentInitials: string
  submittedAt: string
  status: ApplicationStatus
  studentProfile?: Pick<Profile, 'bio' | 'skills' | 'education' | 'github' | 'linkedin' | 'resumePath' | 'resumeName'>
}

export type Message = {
  id: string
  applicationId: string
  senderId: string
  senderName: string
  body: string
  createdAt: string
}
