import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import './App.css'
import { supabase } from './lib/supabase'
import { createRemoteApplication, createRemoteProject, loadRemoteApplications, loadRemoteProjects, loadRemoteProfile, updateRemoteApplicationStatus, updateRemoteProfile, updateRemoteProject, updateRemoteProjectStatus, uploadResume, createResumeDownloadUrl } from './lib/data'
import type { Application, ApplicationStatus, Profile, Project } from './lib/types'

type View = 'home' | 'student' | 'employer'
type Theme = 'light' | 'dark'
type DurationFilter = 'all' | 'short' | 'medium' | 'long'

const PROJECTS_STORAGE_KEY = 'skillbridge.projects'
const APPLICATIONS_STORAGE_KEY = 'skillbridge.applications'

function isProject(value: unknown): value is Project {
  if (!value || typeof value !== 'object') return false
  const project = value as Partial<Project>
  return typeof project.id === 'number'
    && typeof project.title === 'string'
    && typeof project.company === 'string'
    && typeof project.description === 'string'
    && Array.isArray(project.skills)
    && project.skills.every((skill) => typeof skill === 'string')
    && typeof project.duration === 'string'
    && typeof project.applicants === 'number'
}

function isApplication(value: unknown): value is Application {
  if (!value || typeof value !== 'object') return false
  const application = value as Partial<Application>
  return typeof application.id === 'number'
    && typeof application.projectId === 'number'
    && typeof application.studentName === 'string'
    && typeof application.studentInitials === 'string'
    && typeof application.submittedAt === 'string'
    && ['submitted', 'shortlisted', 'accepted', 'rejected'].includes(application.status ?? '')
}

const initialProjects: Project[] = [
  { id: 1, title: 'Build a climate impact dashboard', company: 'Greenlight Labs', description: 'Turn complex sustainability data into a clear, useful dashboard for small businesses.', skills: ['React', 'Data viz', 'Figma'], duration: '6 weeks', applicants: 12 },
  { id: 2, title: 'Refresh our brand identity', company: 'Northstar Coffee', description: 'Help a growing coffee company tell a more memorable story across digital and print.', skills: ['Branding', 'Illustrator', 'Strategy'], duration: '4 weeks', applicants: 8 },
  { id: 3, title: 'Automate our customer support', company: 'Relay Health', description: 'Prototype a smart support workflow that helps patients find answers faster.', skills: ['Python', 'AI', 'UX research'], duration: '8 weeks', applicants: 21 },
]

function Icon({ name }: { name: 'arrow' | 'spark' | 'briefcase' | 'users' | 'search' | 'plus' | 'check' | 'menu' }) {
  const paths = {
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    spark: <><path d="m12 3-1.5 5.5L5 10l5.5 1.5L12 17l1.5-5.5L19 10l-5.5-1.5L12 3Z" /><path d="m19 16-.5 2.5L16 19l2.5.5L19 22l.5-2.5L22 19l-2.5-.5L19 16Z" /></>,
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function App() {
  const [view, setView] = useState<View>('home')
  const [projects, setProjects] = useState<Project[]>(() => {
    if (supabase) return []
    const storedProjects = localStorage.getItem(PROJECTS_STORAGE_KEY)
    if (!storedProjects) return initialProjects

    try {
      const parsedProjects: unknown = JSON.parse(storedProjects)
      if (!Array.isArray(parsedProjects)) return initialProjects
      return parsedProjects.filter(isProject)
    } catch (error) {
      console.error('Unable to restore saved projects.', error)
      return initialProjects
    }
  })
  const [applications, setApplications] = useState<Application[]>(() => {
    if (supabase) return []
    const storedApplications = localStorage.getItem(APPLICATIONS_STORAGE_KEY)
    if (!storedApplications) return []

    try {
      const parsedApplications: unknown = JSON.parse(storedApplications)
      if (!Array.isArray(parsedApplications)) return []
      return parsedApplications.filter(isApplication)
    } catch (error) {
      console.error('Unable to restore saved applications.', error)
      return []
    }
  })
  const [query, setQuery] = useState('')
  const [skillFilter, setSkillFilter] = useState('all')
  const [durationFilter, setDurationFilter] = useState<DurationFilter>('all')
  const [savedProjectIds, setSavedProjectIds] = useState<number[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('skillbridge.saved-projects') ?? '[]') as unknown
      return Array.isArray(saved) && saved.every((id) => typeof id === 'number') ? saved : []
    } catch (error) {
      console.error('Unable to restore saved projects.', error)
      return []
    }
  })
  const [isLoading, setIsLoading] = useState(false)
  const [showPublish, setShowPublish] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [showApplicantsFor, setShowApplicantsFor] = useState<number | null>(null)
  const [applicantsLoading, setApplicantsLoading] = useState(false)
  const [studentTab, setStudentTab] = useState<'explore' | 'applications' | 'saved'>('explore')
  const [backendStatus, setBackendStatus] = useState<'not-configured' | 'checking' | 'connected' | 'schema-missing' | 'unavailable'>(supabase ? 'checking' : 'not-configured')
  const [user, setUser] = useState<User | null>(null)
  const [accountRole, setAccountRole] = useState<'student' | 'employer' | null>(null)
  const [showAuth, setShowAuth] = useState(false)
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [authRecovery, setAuthRecovery] = useState(false)
  const [authRole, setAuthRole] = useState<'student' | 'employer'>('student')
  const [authError, setAuthError] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('skillbridge.theme') as Theme) || 'light')
  const userRole = accountRole ?? (user?.user_metadata.role === 'employer' ? 'employer' : 'student')
  const remoteReady = Boolean(supabase && user && backendStatus === 'connected')

  const availableSkills = useMemo(() => Array.from(new Set(projects.flatMap((project) => project.skills))).sort(), [projects])
  const filteredProjects = useMemo(() => projects.filter((project) => {
    const matchesQuery = `${project.title} ${project.company} ${project.skills.join(' ')}`.toLowerCase().includes(query.toLowerCase())
    const matchesSkill = skillFilter === 'all' || project.skills.includes(skillFilter)
    const weeks = Number.parseInt(project.duration, 10)
    const matchesDuration = durationFilter === 'all'
      || (durationFilter === 'short' && weeks <= 4)
      || (durationFilter === 'medium' && weeks > 4 && weeks <= 8)
      || (durationFilter === 'long' && weeks > 8)
    return matchesQuery && matchesSkill && matchesDuration
  }), [projects, query, skillFilter, durationFilter])
  const visibleProjects = studentTab === 'saved'
    ? filteredProjects.filter((project) => savedProjectIds.includes(project.id))
    : filteredProjects

  const refreshRemoteData = useCallback(async (role: 'student' | 'employer' = userRole) => {
    if (!supabase || !user || backendStatus !== 'connected') return
    const remoteProjects = await loadRemoteProjects(supabase, role === 'employer' ? user.id : undefined)
    setProjects(remoteProjects)
    const remoteApplications = await loadRemoteApplications(supabase, role === 'student' ? user.id : undefined)
    setApplications(remoteApplications)
  }, [backendStatus, supabase, user, userRole])

  function errorCode(value: unknown) {
    if (!value || typeof value !== 'object') return ''
    const maybeCode = (value as { code?: unknown }).code
    return typeof maybeCode === 'string' ? maybeCode : ''
  }

  useEffect(() => {
    if (supabase) return
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects))
  }, [projects])

  useEffect(() => {
    if (supabase) return
    localStorage.setItem(APPLICATIONS_STORAGE_KEY, JSON.stringify(applications))
  }, [applications])

  useEffect(() => {
    localStorage.setItem('skillbridge.saved-projects', JSON.stringify(savedProjectIds))
  }, [savedProjectIds])

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    let active = true
    const loadBackend = async () => {
      const [{ data }, { error }] = await Promise.all([
        client.auth.getSession(),
        client.from('projects').select('id, industry, work_mode, location, compensation').limit(1),
      ])
      if (!active) return
      setUser(data.session?.user ?? null)
      if (!data.session?.user) setAccountRole(null)
      if (error) {
        setBackendStatus(['PGRST200', 'PGRST205', '42P01', '42703'].includes(error.code ?? '') ? 'schema-missing' : 'unavailable')
      } else {
        setBackendStatus('connected')
      }
    }
    loadBackend().catch((error: unknown) => {
        console.error('Unable to reach Supabase.', error)
        if (active) setBackendStatus('unavailable')
      })
    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (active) {
        setUser(session?.user ?? null)
        if (!session?.user) setAccountRole(null)
        if (event === 'PASSWORD_RECOVERY') {
          setAuthError('')
          setAuthMessage('')
          setShowPassword(true)
        }
      }
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabase || !user || backendStatus !== 'connected') return
    const client = supabase
    let active = true
    client.from('profiles').select('role').eq('id', user.id).single().then(({ data, error }) => {
      if (!active) return
      if (error) {
        console.error('Unable to load the signed-in account role.', error)
        setAuthError('Your account role could not be verified. Please sign in again.')
        return
      }
      if (data?.role === 'student' || data?.role === 'employer') {
        setAccountRole(data.role)
        if (showAuth && authRole !== data.role) {
          setAuthError(`This account is registered as a ${data.role}. Choose that role to continue.`)
          setShowAuth(true)
          setView('home')
        } else {
          setView(data.role)
          setShowAuth(false)
        }
      }
    }, (error: unknown) => {
      console.error('Unable to verify the signed-in account role.', error)
      if (active) setAuthError('Your account role could not be verified. Please sign in again.')
    })
    return () => {
      active = false
    }
  }, [backendStatus, user, showAuth, authRole])

  useEffect(() => {
    if (!supabase || !user || backendStatus !== 'connected') return
    refreshRemoteData().catch((error) => {
      console.error('Unable to load Supabase project data.', error)
    })
  }, [backendStatus, user, userRole, refreshRemoteData])

  useEffect(() => {
    if (!supabase || !user || backendStatus !== 'connected') return
    loadRemoteProfile(supabase, user.id).then(setProfile).catch((error: unknown) => {
      console.error('Unable to load the account profile.', error)
      setAuthError('Your profile could not be loaded. Please try again.')
    })
  }, [backendStatus, user])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('skillbridge.theme', theme)
  }, [theme])

  function openRoleAccess(role: 'student' | 'employer') {
    if (!supabase) {
      setView(role)
      setMobileNav(false)
      return
    }
    if (user) {
      if (backendStatus !== 'connected') {
        setAuthError('Your account is signed in, but the project database is still being prepared. Apply the Supabase migrations, then refresh this page.')
        setShowAuth(true)
        return
      }
      if (userRole !== role) {
        setAuthError(`This account is registered as a ${userRole}. Sign out to switch access.`)
        setShowAuth(true)
        return
      }
      setView(role)
      return
    }
    setAuthRole(role)
    setAuthMode('sign-in')
    setAuthError('')
    setAuthMessage('')
    setShowAuth(true)
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setAuthError('')
    setAuthMessage('')
    setAuthLoading(true)
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email'))
    const password = String(data.get('password'))
    try {
      if (authRecovery) {
        const result = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}` })
        if (result.error) {
          setAuthError(result.error.message)
          return
        }
        setAuthMessage('Password reset email sent. Check your inbox to continue.')
        return
      }
      const result = authMode === 'sign-in'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: String(data.get('fullName')), role: authRole } },
        })
      if (result.error) {
        setAuthError(result.error.message)
        return
      }

      setAuthMessage(authMode === 'sign-up' ? 'Account created. Check your email to confirm it.' : 'You are now signed in.')
    } catch (error) {
      console.error('Unable to complete authentication.', error)
      setAuthError('Authentication is temporarily unavailable. Please try again.')
    } finally {
      setAuthLoading(false)
    }

  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    const data = new FormData(event.currentTarget)
    const password = String(data.get('newPassword'))
    const confirmation = String(data.get('confirmPassword'))
    if (password.length < 8 || password !== confirmation) {
      setAuthError('Use at least 8 characters and make both passwords match.')
      return
    }
    setAuthLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setAuthLoading(false)
    if (error) {
      setAuthError(error.message)
      return
    }
    setAuthMessage('Your password was updated successfully.')
  }

  async function signOut() {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Unable to sign out.', error)
      return
    }
    setUser(null)
    setAccountRole(null)
  }

  async function applyToProject(id: number) {
    if (applications.some((application) => application.projectId === id)) return
    const project = projects.find((item) => item.id === id)
    if (project?.status === 'closed') {
      setAuthError('This project is closed and no longer accepting applications.')
      return
    }
    if (supabase && !remoteReady) {
      setAuthError('The live backend is still connecting. Please wait a moment and try again.')
      return
    }
    setIsLoading(true)
    if (remoteReady && project?.remoteId && supabase && user) {
      try {
        await createRemoteApplication(supabase, project.remoteId, user.id)
      } catch (error) {
        if (errorCode(error) === '23505') {
          setAuthError('You already applied to this project. Your status has been refreshed.')
          await refreshRemoteData('student')
        } else {
          console.error('Unable to submit the application.', error)
          setAuthError('This application could not be submitted. Please try again.')
        }
        setIsLoading(false)
        return
      }
      await refreshRemoteData('student')
      setIsLoading(false)
      return
    }
    const studentName = user?.user_metadata.full_name || 'Alex Morgan'
    if (supabase) {
      setIsLoading(false)
      return
    }
    setApplications((current) => [...current, {
      id: Date.now(),
      projectId: id,
      studentName,
      studentInitials: studentName.split(/\s+/).map((part: string) => part[0]).join('').slice(0, 2).toUpperCase(),
      submittedAt: new Date().toISOString(),
      status: 'submitted',
    }])
    setProjects((current) => current.map((project) => project.id === id ? { ...project, applicants: project.applicants + 1 } : project))
    setIsLoading(false)
  }

  async function updateApplicationStatus(applicationId: number, status: ApplicationStatus) {
    const application = applications.find((item) => item.id === applicationId)
    if (remoteReady && application?.remoteId && supabase) {
      try {
        await updateRemoteApplicationStatus(supabase, application, status)
        await refreshRemoteData('employer')
      } catch (error) {
        console.error('Unable to update the application status.', error)
        setAuthError('This application status could not be updated. Please refresh and try again.')
        return
      }

    }
    setApplications((current) => current.map((application) => application.id === applicationId ? { ...application, status } : application))
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !user || !profile) return
    const data = new FormData(event.currentTarget)
    const resume = data.get('resume')
    let resumePath = profile.resumePath
    let resumeName = profile.resumeName
    setIsLoading(true)
    try {
      if (resume instanceof File && resume.size > 0) {
        if (resume.size > 5 * 1024 * 1024 || !['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(resume.type)) {
          setAuthError('Resume must be a PDF, DOC, or DOCX file up to 5 MB.')
          return
        }
        const uploaded = await uploadResume(supabase, user.id, resume)
        resumePath = uploaded.path
        resumeName = uploaded.name
      }
      const nextProfile = {
        fullName: String(data.get('fullName') ?? '').trim(),
        bio: String(data.get('bio') ?? '').trim(),
        skills: String(data.get('skills') ?? '').split(',').map((skill) => skill.trim()).filter(Boolean),
        education: String(data.get('education') ?? '').trim(),
        website: String(data.get('website') ?? profile.website).trim(),
        github: String(data.get('github') ?? profile.github).trim(),
        linkedin: String(data.get('linkedin') ?? profile.linkedin).trim(),
        resumePath,
        resumeName,
        industry: String(data.get('industry') ?? profile.industry).trim(),
      }
      if (nextProfile.fullName.length < 2) {
        setAuthError('Please enter your full name or business name.')
        return
      }
      await updateRemoteProfile(supabase, user.id, nextProfile)
      setProfile({ ...profile, ...nextProfile })
      setShowProfile(false)
    } catch (error) {
      console.error('Unable to update the account profile.', error)
      setAuthError('Your profile could not be saved. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  async function publishProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const newProject = {
      title: String(data.get('title')),
      company: 'Your company',
      description: String(data.get('description')),
      skills: String(data.get('skills')).split(',').map((skill) => skill.trim()).filter(Boolean),
      duration: String(data.get('duration')),
      applicants: 0,
      industry: String(data.get('industry')).trim(),
      workMode: String(data.get('workMode')).trim(),
      location: String(data.get('location')).trim(),
      compensation: String(data.get('compensation')).trim(),
    }
    if (newProject.title.length < 5 || newProject.description.length < 20 || newProject.skills.length === 0 || !newProject.duration) {
      setAuthError('Add a project title, a description of at least 20 characters, one skill, and a duration.')
      return
    }
    if (supabase && (!remoteReady || userRole !== 'employer')) {
      setAuthError('Sign in with a business account before publishing a live project.')
      return
    }
    setIsLoading(true)
    if (remoteReady && userRole === 'employer' && supabase && user) {
      try {
        if (editingProjectId !== null) {
          const project = projects.find((item) => item.id === editingProjectId)
          if (!project?.remoteId) throw new Error('The project identifier is missing.')
          const remoteProject = await updateRemoteProject(supabase, project.remoteId, newProject)
          setProjects((current) => current.map((item) => item.id === editingProjectId ? { ...remoteProject, applicants: item.applicants } : item))
        } else {
          const remoteProject = await createRemoteProject(supabase, newProject, user.id)
          setProjects((current) => [remoteProject, ...current])
        }
      } catch (error) {
        console.error('Unable to publish the project.', error)
        setAuthError('This project could not be published. Please try again.')
        setIsLoading(false)
        return
      }
    } else {
      setProjects((current) => [{ id: Date.now(), ...newProject }, ...current])
    }
    setShowPublish(false)
    setEditingProjectId(null)
    setView('employer')
    setIsLoading(false)
  }

  async function toggleProjectStatus(project: Project) {
    if (!supabase || !remoteReady || !project.remoteId) return
    const nextStatus = project.status === 'closed' ? 'live' : 'closed'
    try {
      await updateRemoteProjectStatus(supabase, project.remoteId, nextStatus)
      setProjects((current) => current.map((item) => item.id === project.id ? { ...item, status: nextStatus } : item))
    } catch (error) {
      console.error('Unable to update the project status.', error)
      setAuthError('This project status could not be updated.')
    }

  }

  async function openResume(path: string) {
    if (!supabase) return
    try {
      const url = await createResumeDownloadUrl(supabase, path)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      console.error('Unable to open the student resume.', error)
      setAuthError('The resume could not be opened. Ask the student to upload it again.')
    }
  }

  function openApplicants(projectId: number) {
    setShowApplicantsFor(projectId)
    if (remoteReady) {
      setApplicantsLoading(true)
      refreshRemoteData('employer').catch((error) => {
        console.error('Unable to refresh applicants.', error)
      }).finally(() => {
        setApplicantsLoading(false)
      })
    }
  }

  function applicationLabel(status: ApplicationStatus) {
    return status === 'submitted' ? 'Pending' : status.charAt(0).toUpperCase() + status.slice(1)
  }

  function toggleSavedProject(id: number) {
    setSavedProjectIds((current) => current.includes(id) ? current.filter((projectId) => projectId !== id) : [...current, id])
  }

  function getMatchScore(project: Project) {
    const studentSkills = ['React', 'Figma', 'UX research', 'Data viz']
    const matches = project.skills.filter((skill) => studentSkills.some((studentSkill) => studentSkill.toLowerCase() === skill.toLowerCase())).length
    return Math.min(99, Math.max(72, 72 + matches * 9))
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView('home')} aria-label="SkillBridge home">
          <img className="brand-logo" src="/skillbridge-logo.png" alt="" /><span>skill<span>bridge</span></span>
        </button>
        <button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation"><Icon name="menu" /></button>
        <nav className={mobileNav ? 'nav-links open' : 'nav-links'}>
          <button className={view === 'home' ? 'active' : ''} onClick={() => { setView('home'); setMobileNav(false) }}>How it works</button>
          <button className={view === 'student' ? 'active' : ''} onClick={() => { openRoleAccess('student'); setMobileNav(false) }}>For students</button>
          <button className={view === 'employer' ? 'active' : ''} onClick={() => { openRoleAccess('employer'); setMobileNav(false) }}>For businesses</button>
        </nav>
        <div className="top-actions"><button className="theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>{theme === 'light' ? '☾' : '☀'}<span>{theme === 'light' ? 'Dark' : 'Light'}</span></button>{user ? <button className="text-button" onClick={signOut}>Log out</button> : <button className="text-button" onClick={() => openRoleAccess('student')}>Log in</button>}<button className="dark-button" onClick={() => openRoleAccess('student')}>Get started <Icon name="arrow" /></button></div>
      </header>
      {backendStatus === 'schema-missing' && <div className="setup-banner" role="status"><strong>API connected · schema update required.</strong><span>Supabase is reachable, but the project-management columns are missing. If the initial schema already exists, do not rerun it; run <code>20261021150000_profiles_and_project_management.sql</code> and <code>20261022100000_production_hardening.sql</code>.</span></div>}
      {backendStatus === 'unavailable' && <div className="setup-banner" role="alert"><strong>Backend unavailable.</strong><span>The Supabase API could not be reached. Check <code>.env.local</code> and the project network settings.</span></div>}

      {view === 'home' && <main>
        <section className="hero-section">
          <div className="hero-copy"><p className="eyebrow"><span className="eyebrow-dot" /> Real projects. Real experience.</p><h1>Bridge the gap<br />between <em>talent</em><br />and opportunity.</h1><p className="hero-description">SkillBridge connects ambitious students with businesses that need fresh thinking. Build your portfolio while making an impact.</p><div className="hero-actions"><button className="dark-button large" onClick={() => openRoleAccess('student')}>Find a project <Icon name="arrow" /></button><button className="outline-button large" onClick={() => openRoleAccess('employer')}>I&apos;m hiring <Icon name="arrow" /></button></div><div className="social-proof"><div className="avatar-stack"><span>JD</span><span>AK</span><span>RM</span><span>+</span></div><p><strong>2,400+</strong> students already building their future</p></div></div>
          <div className="hero-art"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-card main-card"><span className="card-label">PROJECT MATCH</span><div className="match-row"><div className="mini-avatar blue">JL</div><div><strong>Jordan Lee</strong><small>Product Designer</small></div><b>94%</b></div><div className="match-line"><span /></div><div className="match-tags"><span>UX Research</span><span>Figma</span></div></div><div className="art-card floating-card"><Icon name="briefcase" /><span>New opportunity</span><strong>Design a better tomorrow</strong></div><div className="sun-shape" /></div>
        </section>
        <section className="pathways-section">
          <div className="section-heading"><p className="eyebrow">Choose your path</p><h2>One platform.<br /><em>Two ways forward.</em></h2></div>
          <div className="pathway-grid">
            <article className="pathway-card student-pathway">
              <span className="pathway-kicker">FOR STUDENTS</span>
              <h3>Turn your skills into experience.</h3>
              <p>Find real briefs, understand your match, build a portfolio, and follow every application from one focused workspace.</p>
              <ul><li>Search by skill, company, and duration</li><li>Save the opportunities worth revisiting</li><li>Apply and track decisions in one place</li></ul>
              <button className="dark-button" onClick={() => openRoleAccess('student')}>Explore student workspace <Icon name="arrow" /></button>
            </article>
            <article className="pathway-card employer-pathway">
              <span className="pathway-kicker">FOR BUSINESSES</span>
              <h3>Bring fresh thinking to your next challenge.</h3>
              <p>Publish a focused project, reach motivated talent, and move the right applicants through your hiring pipeline.</p>
              <ul><li>Publish a clear project brief in minutes</li><li>Review applicants in one shared view</li><li>Shortlist or accept with transparent status updates</li></ul>
              <button className="outline-button" onClick={() => openRoleAccess('employer')}>Build your talent pipeline <Icon name="arrow" /></button>
            </article>
          </div>
        </section>
        <section className="metrics"><div><strong>1,200+</strong><span>Live projects</span></div><div><strong>380</strong><span>Partner businesses</span></div><div><strong>92%</strong><span>Student success rate</span></div><div><strong>4.9/5</strong><span>Community rating</span></div></section>
        <section className="how-section"><div className="section-heading"><p className="eyebrow">Simple by design</p><h2>Start where you are.<br /><em>Go where you&apos;re needed.</em></h2></div><div className="steps"><article><span className="step-number">01</span><Icon name="users" /><h3>Discover your match</h3><p>Tell us what you&apos;re curious about. We&apos;ll surface projects that fit your skills and ambitions.</p></article><article><span className="step-number">02</span><Icon name="briefcase" /><h3>Do meaningful work</h3><p>Collaborate with real teams on challenges that matter. No coffee runs, just your ideas.</p></article><article><span className="step-number">03</span><Icon name="spark" /><h3>Build what&apos;s next</h3><p>Leave with a stronger portfolio, new connections, and a clearer path forward.</p></article></div></section>
      </main>}

      {view === 'student' && <main className="dashboard"><div className="dashboard-header"><div><p className="eyebrow">Student workspace</p><h1>{studentTab === 'applications' ? <>Track your <em>progress.</em></> : <>Find work that <em>matters.</em></>}</h1><p>{studentTab === 'applications' ? 'Stay up to date with every opportunity you apply for.' : studentTab === 'saved' ? 'Keep your most promising opportunities close.' : 'Explore projects matched to your skills and interests.'}</p></div><button className="profile-pill profile-button" onClick={() => setShowProfile(true)}><div className="mini-avatar peach">{(profile?.fullName || user?.user_metadata.full_name || 'Alex Morgan').slice(0, 2).toUpperCase()}</div><span><strong>{profile?.fullName || user?.user_metadata.full_name || 'Alex Morgan'}</strong><small>Edit student profile</small></span></button></div><div className="dashboard-tabs"><button className={studentTab === 'explore' ? 'active' : ''} onClick={() => setStudentTab('explore')}>Explore projects <span>{projects.length}</span></button><button className={studentTab === 'applications' ? 'active' : ''} onClick={() => setStudentTab('applications')}>My applications <span>{applications.length}</span></button><button className={studentTab === 'saved' ? 'active' : ''} onClick={() => setStudentTab('saved')}>Saved <span>{savedProjectIds.length}</span></button></div>{studentTab !== 'applications' ? <><div className="filter-bar"><div className="search-field"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by skill, role, or company..." /></div><select className="filter-button" value={skillFilter} onChange={(event) => setSkillFilter(event.target.value)} aria-label="Filter by skill"><option value="all">All skills</option>{availableSkills.map((skill) => <option key={skill} value={skill}>{skill}</option>)}</select><select className="filter-button" value={durationFilter} onChange={(event) => setDurationFilter(event.target.value as DurationFilter)} aria-label="Filter by duration"><option value="all">Any duration</option><option value="short">Up to 4 weeks</option><option value="medium">5–8 weeks</option><option value="long">9+ weeks</option></select></div><div className="project-grid">{visibleProjects.length === 0 ? <div className="empty-state project-empty"><h3>{studentTab === 'saved' ? 'No saved projects yet' : 'No projects match those filters'}</h3><p>{studentTab === 'saved' ? 'Use the heart on a project to save it for later.' : 'Try a different keyword, skill, or duration.'}</p><button className="outline-button" onClick={() => { setQuery(''); setSkillFilter('all'); setDurationFilter('all'); setStudentTab('explore') }}>{studentTab === 'saved' ? 'Explore projects' : 'Clear filters'}</button></div> : visibleProjects.map((project) => { const hasApplied = applications.some((application) => application.projectId === project.id); const isSaved = savedProjectIds.includes(project.id); return <article className="project-card" key={project.id}><div className="project-top"><span className="company-badge">{project.company.slice(0, 2).toUpperCase()}</span><button className="save-button" onClick={() => toggleSavedProject(project.id)} aria-label={isSaved ? `Remove ${project.title} from saved projects` : `Save ${project.title}`}>{isSaved ? '♥' : '♡'}</button></div><div className="project-meta"><p className="project-company">{project.company}</p><span className="match-score">{getMatchScore(project)}% match</span></div><h3>{project.title}</h3><p className="project-description">{project.description}</p><div className="tag-row">{project.skills.map((skill) => <span key={skill}>{skill}</span>)}</div><div className="project-footer"><span>{project.duration} <i>·</i> {project.applicants} applicants</span><button disabled={isLoading || hasApplied} className={hasApplied ? 'applied-button' : 'apply-button'} onClick={() => applyToProject(project.id)}>{hasApplied ? <><Icon name="check" /> Applied</> : isLoading ? 'Applying…' : 'Apply now →'}</button></div></article> })}</div></> : <div className="application-list">{applications.length === 0 ? <div className="empty-state"><h3>No applications yet</h3><p>Find a project that matches your goals and send your first application.</p><button className="dark-button" onClick={() => setStudentTab('explore')}>Explore projects <Icon name="arrow" /></button></div> : applications.map((application) => { const project = projects.find((item) => item.id === application.projectId); if (!project) return null; return <article className="application-row" key={application.id}><span className="company-badge">{project.company.slice(0, 2).toUpperCase()}</span><div><strong>{project.title}</strong><small>{project.company} · Applied {new Date(application.submittedAt).toLocaleDateString()}</small></div><span className={`application-status ${application.status}`} aria-label={`Application status: ${applicationLabel(application.status)}`}>{applicationLabel(application.status)}</span></article> })}</div>}</main>}

      {view === 'employer' && <main className="dashboard employer-dashboard"><div className="dashboard-header"><div><p className="eyebrow">Business workspace</p><h1>Build your next <em>great team.</em></h1><p>Connect with curious, capable students ready to make an impact.</p></div><div className="dashboard-actions"><button className="profile-pill profile-button" onClick={() => setShowProfile(true)}><div className="mini-avatar peach">{(profile?.fullName || 'Business').slice(0, 2).toUpperCase()}</div><span><strong>{profile?.fullName || 'Your business'}</strong><small>Edit business profile</small></span></button><button className="dark-button large" onClick={() => { setEditingProjectId(null); setAuthError(''); setShowPublish(true) }}><Icon name="plus" /> Publish a project</button></div></div><div className="employer-stats"><div><span>ACTIVE PROJECTS</span><strong>{projects.filter((project) => project.status !== 'closed').length}</strong><small>Live opportunities</small></div><div><span>TOTAL APPLICANTS</span><strong>{projects.reduce((total, project) => total + project.applicants, 0)}</strong><small>Across your projects</small></div><div><span>SHORTLISTED</span><strong>{applications.filter((application) => application.status === 'shortlisted').length}</strong><small>Awaiting review</small></div></div><div className="section-heading compact"><p className="eyebrow">Your projects</p><h2>Manage your opportunities</h2></div><div className="employer-list">{projects.length === 0 ? <div className="empty-state"><h3>No projects published yet</h3><p>Create your first opportunity to start meeting student talent.</p></div> : projects.map((project) => <div className="employer-row" key={project.id}><span className="company-badge">{project.company.slice(0, 2).toUpperCase()}</span><div><strong>{project.title}</strong><small>{project.applicants} applicants · {project.status === 'closed' ? 'Closed' : 'Live'}</small></div><span className={`status-dot ${project.status === 'closed' ? 'closed' : ''}`}>● {project.status === 'closed' ? 'Closed' : 'Live'}</span><div className="row-actions"><button className="outline-button" onClick={() => openApplicants(project.id)}>Review applicants</button><button className="outline-button" onClick={() => { setEditingProjectId(project.id); setAuthError(''); setShowPublish(true) }}>Edit</button><button className="text-button" onClick={() => toggleProjectStatus(project)}>{project.status === 'closed' ? 'Reopen' : 'Close'}</button></div></div>)}</div></main>}

      {showApplicantsFor !== null && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowApplicantsFor(null)}><div className="publish-modal applicant-modal"><button type="button" className="close-button" onClick={() => setShowApplicantsFor(null)}>×</button><p className="eyebrow">Applicant review</p><h2>{projects.find((project) => project.id === showApplicantsFor)?.title}</h2><p className="modal-intro">Review candidates and move them through your hiring pipeline.</p>{applicantsLoading ? <div className="empty-state"><h3>Refreshing applicants…</h3><p>Loading the latest applications from Supabase.</p></div> : applications.filter((application) => application.projectId === showApplicantsFor).length === 0 ? <div className="empty-state"><h3>No applicants yet</h3><p>Applications will appear here as students apply.</p></div> : <div className="applicant-list">{applications.filter((application) => application.projectId === showApplicantsFor).map((application) => <div className="applicant-row" key={application.id}><div className="mini-avatar peach">{application.studentInitials}</div><div><strong>{application.studentName}</strong><small>{application.studentProfile?.education || 'Student applicant'} · Submitted {new Date(application.submittedAt).toLocaleDateString()}</small><span className="applicant-links">{application.studentProfile?.github && <a href={application.studentProfile.github} target="_blank" rel="noreferrer">GitHub</a>}{application.studentProfile?.linkedin && <a href={application.studentProfile.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>}{application.studentProfile?.resumePath && <button type="button" className="text-button" onClick={() => openResume(application.studentProfile?.resumePath || '')}>Resume{application.studentProfile.resumeName ? ` (${application.studentProfile.resumeName})` : ''}</button>}</span></div><select aria-label={`Status for ${application.studentName}`} value={application.status} onChange={(event) => updateApplicationStatus(application.id, event.target.value as ApplicationStatus)}><option value="submitted">Pending</option><option value="shortlisted">Shortlisted</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option></select></div>)}</div>}</div></div>}

      {showAuth && <div className="modal-backdrop auth-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowAuth(false)}><div className="auth-panel"><div className="auth-visual"><img src="/skillbridge-logo.png" alt="SkillBridge student and business bridge logo" /><p className="eyebrow">Your next opportunity starts here.</p><h2>Connect potential<br />to <em>possibility.</em></h2><p>Join a community where students grow through real work and businesses find their next great idea.</p><span className="auth-visual-note">Students × Businesses × Impact</span></div><form className="publish-modal auth-modal" onSubmit={submitAuth}><button type="button" className="close-button" onClick={() => setShowAuth(false)}>×</button><img className="auth-form-logo" src="/skillbridge-logo.png" alt="" /><p className="eyebrow">{authRecovery ? 'Recover your account' : authMode === 'sign-in' ? 'One login. Your workspace.' : 'Create your account'}</p><h2>{authRecovery ? 'Reset your password.' : authMode === 'sign-in' ? 'Choose your role to sign in.' : 'Choose your role to get started.'}</h2><p className="modal-intro">{authRecovery ? 'Enter your email and we will send a secure reset link.' : 'Your role controls the tools and data you can access.'}</p>{!authRecovery && <div className="role-toggle"><button type="button" className={authRole === 'student' ? 'selected' : ''} onClick={() => setAuthRole('student')}><strong>I&apos;m a student</strong><small>Find projects and track applications</small></button><button type="button" className={authRole === 'employer' ? 'selected' : ''} onClick={() => setAuthRole('employer')}><strong>I&apos;m a business</strong><small>Publish projects and review talent</small></button></div>}{!authRecovery && authMode === 'sign-up' && <label>Full name<input required name="fullName" placeholder="Alex Morgan" /></label>}<label>Email<input required name="email" type="email" placeholder="you@example.com" /></label>{!authRecovery && <label>Password<input required name="password" type="password" minLength={6} placeholder="At least 6 characters" /></label>}{authError && <p className="form-error">{authError}</p>}{authMessage && <p className="form-message">{authMessage}</p>}<button disabled={authLoading} className="dark-button large" type="submit">{authLoading ? 'Connecting…' : authRecovery ? 'Send reset link' : authMode === 'sign-in' ? `Sign in as ${authRole}` : 'Create account'} {!authLoading && <Icon name="arrow" />}</button>{!authRecovery && authMode === 'sign-in' && <button type="button" className="auth-switch" onClick={() => { setAuthRecovery(true); setAuthError(''); setAuthMessage('') }}>Forgot password?</button>}<button type="button" className="auth-switch" onClick={() => { setAuthRecovery(false); setAuthMode(authMode === 'sign-in' ? 'sign-up' : 'sign-in'); setAuthError(''); setAuthMessage('') }}>{authRecovery ? 'Back to sign in' : authMode === 'sign-in' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}</button></form></div></div>}

      {showProfile && profile && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowProfile(false)}><form className="publish-modal" onSubmit={saveProfile}><button type="button" className="close-button" onClick={() => setShowProfile(false)}>×</button><p className="eyebrow">Your profile</p><h2>Make your profile work for you.</h2><p className="modal-intro">Keep your information current so the right people can find you.</p><label>{profile.role === 'student' ? 'Full name' : 'Business name'}<input required name="fullName" defaultValue={profile.fullName} /></label><label>About you<textarea name="bio" defaultValue={profile.bio} rows={3} placeholder="Tell the SkillBridge community about your goals or business." /></label><label>Skills<input name="skills" defaultValue={profile.skills.join(', ')} placeholder="React, Figma, Research" /></label>{profile.role === 'employer' && <label>Industry<input name="industry" defaultValue={profile.industry} placeholder="Technology, climate, healthcare..." /></label>}<label>{profile.role === 'student' ? 'Education' : 'Business website'}<input name={profile.role === 'student' ? 'education' : 'website'} defaultValue={profile.role === 'student' ? profile.education : profile.website} /></label>{profile.role === 'student' && <><label>GitHub profile<input name="github" type="url" defaultValue={profile.github} placeholder="https://github.com/..." /></label><label>LinkedIn profile<input name="linkedin" type="url" defaultValue={profile.linkedin} placeholder="https://linkedin.com/in/..." /></label><label>Portfolio website<input name="website" type="url" defaultValue={profile.website} placeholder="https://..." /></label><label>Resume or CV (PDF, DOC, DOCX · max 5 MB)<input name="resume" type="file" accept=".pdf,.doc,.docx" />{profile.resumeName && <small className="file-note">Current file: {profile.resumeName}</small>}</label></>}{authError && <p className="form-error">{authError}</p>}<div className="modal-actions"><button className="dark-button large" type="submit" disabled={isLoading}>{isLoading ? 'Saving…' : 'Save profile'}</button><button type="button" className="outline-button" onClick={() => { setShowProfile(false); setShowPassword(true); setAuthError(''); setAuthMessage('') }}>Change password</button></div></form></div>}
      {showPassword && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowPassword(false)}><form className="publish-modal" onSubmit={updatePassword}><button type="button" className="close-button" onClick={() => setShowPassword(false)}>×</button><p className="eyebrow">Account security</p><h2>Update your password.</h2><p className="modal-intro">Use a unique password with at least 8 characters.</p><label>New password<input required name="newPassword" type="password" minLength={8} /></label><label>Confirm password<input required name="confirmPassword" type="password" minLength={8} /></label>{authError && <p className="form-error">{authError}</p>}{authMessage && <p className="form-message">{authMessage}</p>}<button className="dark-button large" type="submit" disabled={authLoading}>{authLoading ? 'Updating…' : 'Update password'}</button></form></div>}
      {showPublish && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowPublish(false)}><form className="publish-modal" onSubmit={publishProject}><button type="button" className="close-button" onClick={() => { setShowPublish(false); setEditingProjectId(null) }}>×</button><p className="eyebrow">{editingProjectId === null ? 'New opportunity' : 'Edit opportunity'}</p><h2>{editingProjectId === null ? 'Publish a project' : 'Update your project'}</h2><p className="modal-intro">A specific brief helps the right students decide quickly.</p>{(() => { const editing = projects.find((project) => project.id === editingProjectId); return <><label>Project title<input required name="title" defaultValue={editing?.title} placeholder="e.g. Design our next product launch" /></label><label>What will they work on?<textarea required name="description" defaultValue={editing?.description} placeholder="Describe the challenge, expected outcome, and impact..." rows={3} /></label><div className="form-row"><label>Skills needed<input required name="skills" defaultValue={editing?.skills.join(', ')} placeholder="React, Figma, Research" /></label><label>Duration<select name="duration" defaultValue={editing?.duration}><option>4 weeks</option><option>6 weeks</option><option>8 weeks</option><option>12 weeks</option></select></label></div><div className="form-row"><label>Industry<input required name="industry" defaultValue={editing?.industry} placeholder="Technology, climate..." /></label><label>Work mode<select required name="workMode" defaultValue={editing?.workMode}><option>Remote</option><option>Hybrid</option><option>On-site</option></select></label></div><div className="form-row"><label>Location<input name="location" defaultValue={editing?.location} placeholder="City or remote" /></label><label>Compensation<input name="compensation" defaultValue={editing?.compensation} placeholder="Paid / Stipend / Unpaid" /></label></div></>})()}<button className="dark-button large" type="submit">{editingProjectId === null ? 'Publish project' : 'Save changes'} <Icon name="arrow" /></button></form></div>}
      <footer><div className="footer-main"><div className="footer-brand"><span className="brand"><img className="brand-logo" src="/skillbridge-logo.png" alt="" />skill<span>bridge</span></span><p>Real projects. Real experience.<br />A clearer bridge to what&apos;s next.</p></div><div className="footer-links"><div><strong>Explore</strong><button onClick={() => setView('home')}>How it works</button><button onClick={() => openRoleAccess('student')}>For students</button><button onClick={() => openRoleAccess('employer')}>For businesses</button></div><div><strong>Platform</strong><span>Live project matching</span><span>Application tracking</span><span>Talent connections</span></div></div></div><div className="footer-bottom"><span>© 2026 SkillBridge. Built for meaningful beginnings.</span><span className={`backend-status ${backendStatus}`}><i /> {backendStatus === 'connected' ? 'Backend connected' : backendStatus === 'checking' ? 'Connecting backend' : backendStatus === 'schema-missing' ? 'API connected · schema pending' : backendStatus === 'unavailable' ? 'Backend unavailable' : 'Local mode'}</span><span>Student ambition × Business impact</span></div></footer>
    </div>
  )
}

export default App
