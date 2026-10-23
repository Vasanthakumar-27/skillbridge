import type { SupabaseClient } from '@supabase/supabase-js'
import type { ApplicationStatus, Application, Profile, Project } from './types'

type RemoteProject = {
  id: string
  title: string
  description: string
  skills: string[]
  duration: string
  profiles: {
    full_name: string
    bio: string | null
    skills: string[] | null
    education: string | null
    github: string | null
    linkedin: string | null
    resume_path: string | null
    resume_name: string | null
  }[] | null
  applications?: { count: number }[]
  status?: 'live' | 'closed'
  industry?: string
  work_mode?: string
  location?: string
  compensation?: string
}

const legacyProjectSelect = 'id, title, description, skills, duration, status, profiles!projects_employer_id_fkey(full_name), applications(count)'
const legacyProfileSelect = 'full_name, role'
const legacyApplicationSelect = 'id, project_id, status, created_at, profiles!applications_student_id_fkey(full_name), projects(title, description, duration, skills, profiles!projects_employer_id_fkey(full_name))'

type RemoteApplication = {
  id: string
  project_id: string
  status: ApplicationStatus
  created_at: string
  profiles: {
    full_name: string
    bio: string | null
    skills: string[] | null
    education: string | null
    github: string | null
    linkedin: string | null
    resume_path: string | null
    resume_name: string | null
  }[] | null
  projects: {
    title: string
    description: string
    duration: string
    skills: string[]
    profiles: { full_name: string }[] | null
  }[] | null
}

function isSchemaCompatibilityError(error: { code?: string } | null) {
  return Boolean(error && ['42703', '42P01', 'PGRST200', 'PGRST205'].includes(error.code ?? ''))
}

function profileName(profiles: { full_name: string }[] | null) {
  return profiles?.[0]?.full_name || 'SkillBridge business'
}

function numericId(value: string) {
  let hash = 0
  for (const character of value) hash = ((hash << 5) - hash) + character.charCodeAt(0)
  return Math.abs(hash)
}

export function mapRemoteProject(project: RemoteProject): Project {
  return {
    id: numericId(project.id),
    remoteId: project.id,
    title: project.title,
    company: profileName(project.profiles),
    description: project.description,
    skills: project.skills,
    duration: project.duration,
    applicants: project.applications?.[0]?.count ?? 0,
    status: project.status ?? 'live',
    industry: project.industry ?? '',
    workMode: project.work_mode ?? '',
    location: project.location ?? '',
    compensation: project.compensation ?? '',
  }
}

export function mapRemoteApplication(application: RemoteApplication): Application | null {
  const project = application.projects?.[0]
  if (!project) return null
  return {
    id: numericId(application.id),
    remoteId: application.id,
    projectId: numericId(application.project_id),
    remoteProjectId: application.project_id,
    studentName: application.profiles?.[0]?.full_name || 'Student',
    studentInitials: (application.profiles?.[0]?.full_name || 'Student').slice(0, 2).toUpperCase(),
    submittedAt: application.created_at,
    status: application.status,
    studentProfile: application.profiles?.[0] ? {
      bio: application.profiles[0].bio ?? '',
      skills: application.profiles[0].skills ?? [],
      education: application.profiles[0].education ?? '',
      github: application.profiles[0].github ?? '',
      linkedin: application.profiles[0].linkedin ?? '',
      resumePath: application.profiles[0].resume_path ?? '',
      resumeName: application.profiles[0].resume_name ?? '',
    } : undefined,
  }
}

export async function loadRemoteProjects(client: SupabaseClient, employerId?: string) {
  let query = client
    .from('projects')
    .select('id, title, description, skills, duration, status, industry, work_mode, location, compensation, profiles!projects_employer_id_fkey(full_name), applications(count)')
    .order('created_at', { ascending: false })
  query = employerId ? query.eq('employer_id', employerId) : query.eq('status', 'live')
  let { data, error } = await query
  if (isSchemaCompatibilityError(error)) {
    let legacyQuery = client.from('projects').select(legacyProjectSelect).order('created_at', { ascending: false })
    legacyQuery = employerId ? legacyQuery.eq('employer_id', employerId) : legacyQuery.eq('status', 'live')
    const legacyResult = await legacyQuery
    data = legacyResult.data as typeof data
    error = legacyResult.error
  }
  if (error) throw error
  return (data as unknown as RemoteProject[]).map(mapRemoteProject)
}

export async function loadRemoteApplications(client: SupabaseClient, userId?: string) {
  let query = client
    .from('applications')
    .select('id, project_id, status, created_at, profiles!applications_student_id_fkey(full_name, bio, skills, education, github, linkedin, resume_path, resume_name), projects(title, description, duration, skills, profiles!projects_employer_id_fkey(full_name))')
  if (userId) query = query.eq('student_id', userId)
  let { data, error } = await query.order('created_at', { ascending: false })
  if (isSchemaCompatibilityError(error)) {
    let legacyQuery = client.from('applications').select(legacyApplicationSelect)
    if (userId) legacyQuery = legacyQuery.eq('student_id', userId)
    const legacyResult = await legacyQuery.order('created_at', { ascending: false })
    data = legacyResult.data as typeof data
    error = legacyResult.error
  }
  if (error) throw error
  return (data as unknown as RemoteApplication[]).map(mapRemoteApplication).filter((application): application is Application => application !== null)
}

export async function createRemoteApplication(client: SupabaseClient, projectId: string, studentId: string) {
  const { error } = await client.from('applications').insert({ project_id: projectId, student_id: studentId })
  if (error) throw error
}

export async function createRemoteProject(client: SupabaseClient, project: Omit<Project, 'id' | 'applicants'>, employerId: string) {
  const { data, error } = await client
    .from('projects')
    .insert({ employer_id: employerId, title: project.title, description: project.description, skills: project.skills, duration: project.duration, industry: project.industry, work_mode: project.workMode, location: project.location, compensation: project.compensation })
    .select('id, title, description, skills, duration, status, industry, work_mode, location, compensation, profiles!projects_employer_id_fkey(full_name), applications(count)')
    .single()
  if (isSchemaCompatibilityError(error)) {
    const legacyResult = await client.from('projects')
      .insert({ employer_id: employerId, title: project.title, description: project.description, skills: project.skills, duration: project.duration })
      .select(legacyProjectSelect)
      .single()
    if (legacyResult.error) throw legacyResult.error
    return mapRemoteProject(legacyResult.data as RemoteProject)
  }
  if (error) throw error
  return mapRemoteProject(data as RemoteProject)
}

export async function updateRemoteProject(client: SupabaseClient, projectId: string, project: Pick<Project, 'title' | 'description' | 'skills' | 'duration' | 'industry' | 'workMode' | 'location' | 'compensation'>) {
  const result = await client
    .from('projects')
    .update({ title: project.title, description: project.description, skills: project.skills, duration: project.duration, industry: project.industry, work_mode: project.workMode, location: project.location, compensation: project.compensation })
    .eq('id', projectId)
    .select('id, title, description, skills, duration, status, industry, work_mode, location, compensation, profiles!projects_employer_id_fkey(full_name), applications(count)')
    .single()
  if (isSchemaCompatibilityError(result.error)) {
    const legacyResult = await client.from('projects')
      .update({ title: project.title, description: project.description, skills: project.skills, duration: project.duration })
      .eq('id', projectId)
      .select(legacyProjectSelect)
      .single()
    if (legacyResult.error) throw legacyResult.error
    return mapRemoteProject(legacyResult.data as RemoteProject)
  }
  if (result.error) throw result.error
  return mapRemoteProject(result.data as RemoteProject)
}

export async function updateRemoteProjectStatus(client: SupabaseClient, projectId: string, status: 'live' | 'closed') {
  const { error } = await client.from('projects').update({ status }).eq('id', projectId)
  if (error) throw error
}

export async function loadRemoteProfile(client: SupabaseClient, userId: string) {
  let { data, error } = await client.from('profiles').select('full_name, role, bio, skills, education, website, github, linkedin, resume_path, resume_name, industry').eq('id', userId).single()
  if (isSchemaCompatibilityError(error)) {
    const legacyResult = await client.from('profiles').select(legacyProfileSelect).eq('id', userId).single()
    data = legacyResult.data as typeof data
    error = legacyResult.error
  }
  if (error) throw error
  const profileData = data as unknown as {
    full_name: string
    role: 'student' | 'employer'
    bio?: string
    skills?: string[]
    education?: string
    website?: string
    github?: string
    linkedin?: string
    resume_path?: string
    resume_name?: string
    industry?: string
  }
  return {
    fullName: profileData.full_name,
    role: profileData.role,
    bio: profileData.bio ?? '',
    skills: profileData.skills ?? [],
    education: profileData.education ?? '',
    website: profileData.website ?? '',
    github: profileData.github ?? '',
    linkedin: profileData.linkedin ?? '',
    resumePath: profileData.resume_path ?? '',
    resumeName: profileData.resume_name ?? '',
    industry: profileData.industry ?? '',
  }
}

export async function updateRemoteProfile(client: SupabaseClient, userId: string, profile: Pick<Profile, 'fullName' | 'bio' | 'skills' | 'education' | 'website' | 'github' | 'linkedin' | 'resumePath' | 'resumeName' | 'industry'>) {
  const result = await client.from('profiles').update({
    full_name: profile.fullName,
    bio: profile.bio,
    skills: profile.skills,
    education: profile.education,
    website: profile.website,
    github: profile.github,
    linkedin: profile.linkedin,
    resume_path: profile.resumePath,
    resume_name: profile.resumeName,
    industry: profile.industry,
  }).eq('id', userId)
  if (isSchemaCompatibilityError(result.error)) {
    const legacyResult = await client.from('profiles').update({ full_name: profile.fullName }).eq('id', userId)
    if (legacyResult.error) throw legacyResult.error
    return
  }
  if (result.error) throw result.error
}

export async function uploadResume(client: SupabaseClient, userId: string, file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'pdf'
  const path = `${userId}/resume-${Date.now()}.${extension}`
  const { error } = await client.storage.from('student-documents').upload(path, file, {
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  })
  if (error) throw error
  return { path, name: file.name }
}

export async function createResumeDownloadUrl(client: SupabaseClient, path: string) {
  const { data, error } = await client.storage.from('student-documents').createSignedUrl(path, 300)
  if (error) throw error
  return data.signedUrl
}

export async function updateRemoteApplicationStatus(client: SupabaseClient, application: Application, status: ApplicationStatus) {
  if (!application.remoteId) throw new Error('This application is local-only and cannot be updated remotely.')
  const { error } = await client.from('applications').update({ status }).eq('id', application.remoteId)
  if (error) throw error
}
