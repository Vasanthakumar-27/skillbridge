import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import './App.css'
import { supabase } from './lib/supabase'

type View = 'home' | 'student' | 'employer'
type Theme = 'light' | 'dark'
type ApplicationStatus = 'submitted' | 'shortlisted' | 'accepted' | 'rejected'
type Project = {
  id: number
  title: string
  company: string
  description: string
  skills: string[]
  duration: string
  applicants: number
}
type Application = {
  id: number
  projectId: number
  studentName: string
  studentInitials: string
  submittedAt: string
  status: ApplicationStatus
}

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
  const [showPublish, setShowPublish] = useState(false)
  const [showApplicantsFor, setShowApplicantsFor] = useState<number | null>(null)
  const [studentTab, setStudentTab] = useState<'explore' | 'applications'>('explore')
  const [backendStatus, setBackendStatus] = useState<'not-configured' | 'checking' | 'connected' | 'unavailable'>(supabase ? 'checking' : 'not-configured')
  const [user, setUser] = useState<User | null>(null)
  const [showAuth, setShowAuth] = useState(false)
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [authRole, setAuthRole] = useState<'student' | 'employer'>('student')
  const [authError, setAuthError] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [mobileNav, setMobileNav] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('skillbridge.theme') as Theme) || 'light')
  const userRole = user?.user_metadata.role === 'employer' ? 'employer' : 'student'

  const filteredProjects = useMemo(() => projects.filter((project) =>
    `${project.title} ${project.company} ${project.skills.join(' ')}`.toLowerCase().includes(query.toLowerCase()),
  ), [projects, query])

  useEffect(() => {
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects))
  }, [projects])

  useEffect(() => {
    localStorage.setItem(APPLICATIONS_STORAGE_KEY, JSON.stringify(applications))
  }, [applications])

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    let active = true
    const loadBackend = async () => {
      const [{ data }, { error }] = await Promise.all([
        client.auth.getSession(),
        client.from('projects').select('id').limit(1),
      ])
      if (!active) return
      setUser(data.session?.user ?? null)
      if (error) {
        setBackendStatus('unavailable')
      } else {
        setBackendStatus('connected')
      }
    }
    loadBackend().catch((error: unknown) => {
        console.error('Unable to reach Supabase.', error)
        if (active) setBackendStatus('unavailable')
      })
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      if (active) setUser(session?.user ?? null)
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('skillbridge.theme', theme)
  }, [theme])

  function openRoleAccess(role: 'student' | 'employer') {
    if (user) {
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
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email'))
    const password = String(data.get('password'))
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
    if (authMode === 'sign-in') setShowAuth(false)
  }

  async function signOut() {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Unable to sign out.', error)
      return
    }
    setUser(null)
  }

  function applyToProject(id: number) {
    if (applications.some((application) => application.projectId === id && application.studentName === 'Alex Morgan')) return
    setApplications((current) => [...current, {
      id: Date.now(),
      projectId: id,
      studentName: 'Alex Morgan',
      studentInitials: 'AM',
      submittedAt: new Date().toISOString(),
      status: 'submitted',
    }])
    setProjects((current) => current.map((project) => project.id === id ? { ...project, applicants: project.applicants + 1 } : project))
  }

  function updateApplicationStatus(applicationId: number, status: ApplicationStatus) {
    setApplications((current) => current.map((application) => application.id === applicationId ? { ...application, status } : application))
  }

  function publishProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setProjects((current) => [{
      id: Date.now(),
      title: String(data.get('title')),
      company: 'Your company',
      description: String(data.get('description')),
      skills: String(data.get('skills')).split(',').map((skill) => skill.trim()).filter(Boolean),
      duration: String(data.get('duration')),
      applicants: 0,
    }, ...current])
    setShowPublish(false)
    setView('employer')
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
      {backendStatus === 'unavailable' && <div className="setup-banner" role="status"><strong>Demo mode active.</strong><span>Supabase is connected, but the database tables are not applied yet. Run the migration in <code>supabase/migrations/20261021120000_initial_schema.sql</code> to enable live accounts and shared data.</span></div>}

      {view === 'home' && <main>
        <section className="hero-section">
          <div className="hero-copy"><p className="eyebrow"><span className="eyebrow-dot" /> Real projects. Real experience.</p><h1>Bridge the gap<br />between <em>talent</em><br />and opportunity.</h1><p className="hero-description">SkillBridge connects ambitious students with businesses that need fresh thinking. Build your portfolio while making an impact.</p><div className="hero-actions"><button className="dark-button large" onClick={() => openRoleAccess('student')}>Find a project <Icon name="arrow" /></button><button className="outline-button large" onClick={() => openRoleAccess('employer')}>I&apos;m hiring <Icon name="arrow" /></button></div><div className="social-proof"><div className="avatar-stack"><span>JD</span><span>AK</span><span>RM</span><span>+</span></div><p><strong>2,400+</strong> students already building their future</p></div></div>
          <div className="hero-art"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-card main-card"><span className="card-label">PROJECT MATCH</span><div className="match-row"><div className="mini-avatar blue">JL</div><div><strong>Jordan Lee</strong><small>Product Designer</small></div><b>94%</b></div><div className="match-line"><span /></div><div className="match-tags"><span>UX Research</span><span>Figma</span></div></div><div className="art-card floating-card"><Icon name="briefcase" /><span>New opportunity</span><strong>Design a better tomorrow</strong></div><div className="sun-shape" /></div>
        </section>
        <section className="metrics"><div><strong>1,200+</strong><span>Live projects</span></div><div><strong>380</strong><span>Partner businesses</span></div><div><strong>92%</strong><span>Student success rate</span></div><div><strong>4.9/5</strong><span>Community rating</span></div></section>
        <section className="how-section"><div className="section-heading"><p className="eyebrow">Simple by design</p><h2>Start where you are.<br /><em>Go where you&apos;re needed.</em></h2></div><div className="steps"><article><span className="step-number">01</span><Icon name="users" /><h3>Discover your match</h3><p>Tell us what you&apos;re curious about. We&apos;ll surface projects that fit your skills and ambitions.</p></article><article><span className="step-number">02</span><Icon name="briefcase" /><h3>Do meaningful work</h3><p>Collaborate with real teams on challenges that matter. No coffee runs, just your ideas.</p></article><article><span className="step-number">03</span><Icon name="spark" /><h3>Build what&apos;s next</h3><p>Leave with a stronger portfolio, new connections, and a clearer path forward.</p></article></div></section>
      </main>}

      {view === 'student' && <main className="dashboard"><div className="dashboard-header"><div><p className="eyebrow">Student workspace</p><h1>{studentTab === 'explore' ? <>Find work that <em>matters.</em></> : <>Track your <em>progress.</em></>}</h1><p>{studentTab === 'explore' ? 'Explore projects matched to your skills and interests.' : 'Stay up to date with every opportunity you apply for.'}</p></div><div className="profile-pill"><div className="mini-avatar peach">AM</div><span><strong>Alex Morgan</strong><small>Product design student</small></span></div></div><div className="dashboard-tabs"><button className={studentTab === 'explore' ? 'active' : ''} onClick={() => setStudentTab('explore')}>Explore projects <span>{projects.length}</span></button><button className={studentTab === 'applications' ? 'active' : ''} onClick={() => setStudentTab('applications')}>My applications <span>{applications.length}</span></button><button>Saved <span>4</span></button></div>{studentTab === 'explore' ? <><div className="filter-bar"><div className="search-field"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by skill, role, or company..." /></div><button className="filter-button">All categories⌄</button><button className="filter-button">Duration⌄</button></div><div className="project-grid">{filteredProjects.map((project) => { const hasApplied = applications.some((application) => application.projectId === project.id && application.studentName === 'Alex Morgan'); return <article className="project-card" key={project.id}><div className="project-top"><span className="company-badge">{project.company.slice(0, 2).toUpperCase()}</span><button className="save-button">♡</button></div><p className="project-company">{project.company}</p><h3>{project.title}</h3><p className="project-description">{project.description}</p><div className="tag-row">{project.skills.map((skill) => <span key={skill}>{skill}</span>)}</div><div className="project-footer"><span>{project.duration} <i>·</i> {project.applicants} applicants</span><button className={hasApplied ? 'applied-button' : 'apply-button'} onClick={() => applyToProject(project.id)}>{hasApplied ? <><Icon name="check" /> Applied</> : 'Apply now →'}</button></div></article> })}</div></> : <div className="application-list">{applications.length === 0 ? <div className="empty-state"><h3>No applications yet</h3><p>Find a project that matches your goals and send your first application.</p><button className="dark-button" onClick={() => setStudentTab('explore')}>Explore projects <Icon name="arrow" /></button></div> : applications.map((application) => { const project = projects.find((item) => item.id === application.projectId); if (!project) return null; return <article className="application-row" key={application.id}><span className="company-badge">{project.company.slice(0, 2).toUpperCase()}</span><div><strong>{project.title}</strong><small>{project.company} · Applied {new Date(application.submittedAt).toLocaleDateString()}</small></div><span className={`application-status ${application.status}`}>{application.status}</span></article> })}</div>}</main>}

      {view === 'employer' && <main className="dashboard employer-dashboard"><div className="dashboard-header"><div><p className="eyebrow">Business workspace</p><h1>Build your next <em>great team.</em></h1><p>Connect with curious, capable students ready to make an impact.</p></div><button className="dark-button large" onClick={() => setShowPublish(true)}><Icon name="plus" /> Publish a project</button></div><div className="employer-stats"><div><span>ACTIVE PROJECTS</span><strong>{projects.length}</strong><small>↑ 2 this month</small></div><div><span>TOTAL APPLICANTS</span><strong>{applications.length}</strong><small>Across all projects</small></div><div><span>SHORTLISTED</span><strong>{applications.filter((application) => application.status === 'shortlisted').length}</strong><small>Awaiting review</small></div></div><div className="section-heading compact"><p className="eyebrow">Your projects</p><h2>Manage your opportunities</h2></div><div className="employer-list">{projects.slice(0, 3).map((project) => <div className="employer-row" key={project.id}><span className="company-badge">{project.company.slice(0, 2).toUpperCase()}</span><div><strong>{project.title}</strong><small>Published recently · {applications.filter((application) => application.projectId === project.id).length} applicants</small></div><span className="status-dot">● Live</span><button className="outline-button" onClick={() => setShowApplicantsFor(project.id)}>Review applicants →</button></div>)}</div></main>}

      {showApplicantsFor !== null && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowApplicantsFor(null)}><div className="publish-modal applicant-modal"><button type="button" className="close-button" onClick={() => setShowApplicantsFor(null)}>×</button><p className="eyebrow">Applicant review</p><h2>{projects.find((project) => project.id === showApplicantsFor)?.title}</h2><p className="modal-intro">Review candidates and move them through your hiring pipeline.</p>{applications.filter((application) => application.projectId === showApplicantsFor).length === 0 ? <div className="empty-state"><h3>No applicants yet</h3><p>Applications will appear here as students apply.</p></div> : <div className="applicant-list">{applications.filter((application) => application.projectId === showApplicantsFor).map((application) => <div className="applicant-row" key={application.id}><div className="mini-avatar peach">{application.studentInitials}</div><div><strong>{application.studentName}</strong><small>Product design · Submitted {new Date(application.submittedAt).toLocaleDateString()}</small></div><select aria-label={`Status for ${application.studentName}`} value={application.status} onChange={(event) => updateApplicationStatus(application.id, event.target.value as ApplicationStatus)}><option value="submitted">Submitted</option><option value="shortlisted">Shortlisted</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option></select></div>)}</div>}</div></div>}

      {showAuth && <div className="modal-backdrop auth-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowAuth(false)}><div className="auth-panel"><div className="auth-visual"><img src="/skillbridge-logo.png" alt="SkillBridge student and business bridge logo" /><p className="eyebrow">Your next opportunity starts here.</p><h2>Connect potential<br />to <em>possibility.</em></h2><p>Join a community where students grow through real work and businesses find their next great idea.</p><span className="auth-visual-note">Students × Businesses × Impact</span></div><form className="publish-modal auth-modal" onSubmit={submitAuth}><button type="button" className="close-button" onClick={() => setShowAuth(false)}>×</button><img className="auth-form-logo" src="/skillbridge-logo.png" alt="" /><p className="eyebrow">{authMode === 'sign-in' ? 'Welcome back' : 'Join SkillBridge'}</p><h2>{authMode === 'sign-in' ? 'Sign in to continue.' : 'Create your account.'}</h2><p className="modal-intro">Access your projects, applications, and opportunities.</p><div className="role-toggle"><button type="button" className={authRole === 'student' ? 'selected' : ''} onClick={() => setAuthRole('student')}>I&apos;m a student</button><button type="button" className={authRole === 'employer' ? 'selected' : ''} onClick={() => setAuthRole('employer')}>I&apos;m a business</button></div>{authMode === 'sign-up' && <label>Full name<input required name="fullName" placeholder="Alex Morgan" /></label>}<label>Email<input required name="email" type="email" placeholder="you@example.com" /></label><label>Password<input required name="password" type="password" minLength={6} placeholder="At least 6 characters" /></label>{authError && <p className="form-error">{authError}</p>}{authMessage && <p className="form-message">{authMessage}</p>}<button className="dark-button large" type="submit">{authMode === 'sign-in' ? `Sign in as ${authRole}` : 'Create account'} <Icon name="arrow" /></button><button type="button" className="auth-switch" onClick={() => { setAuthMode(authMode === 'sign-in' ? 'sign-up' : 'sign-in'); setAuthError(''); setAuthMessage('') }}>{authMode === 'sign-in' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}</button></form></div></div>}

      {showPublish && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowPublish(false)}><form className="publish-modal" onSubmit={publishProject}><button type="button" className="close-button" onClick={() => setShowPublish(false)}>×</button><p className="eyebrow">New opportunity</p><h2>Publish a project</h2><p className="modal-intro">Give talented students a chance to do their best work.</p><label>Project title<input required name="title" placeholder="e.g. Design our next product launch" /></label><label>What will they work on?<textarea required name="description" placeholder="Describe the challenge and the impact..." rows={3} /></label><div className="form-row"><label>Skills needed<input required name="skills" placeholder="React, Figma, Research" /></label><label>Duration<select name="duration"><option>4 weeks</option><option>6 weeks</option><option>8 weeks</option><option>12 weeks</option></select></label></div><button className="dark-button large" type="submit">Publish project <Icon name="arrow" /></button></form></div>}
      <footer><span className="brand"><img className="brand-logo" src="/skillbridge-logo.png" alt="" />skill<span>bridge</span></span><span>Connecting potential to possibility.</span><span className={`backend-status ${backendStatus}`}><i /> {backendStatus === 'connected' ? 'Backend connected' : backendStatus === 'checking' ? 'Connecting backend' : backendStatus === 'unavailable' ? 'Backend unavailable' : 'Local mode'}</span><span>© 2024 SkillBridge</span></footer>
    </div>
  )
}

export default App
