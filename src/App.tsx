import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type View = 'home' | 'student' | 'employer'
type Project = {
  id: number
  title: string
  company: string
  description: string
  skills: string[]
  duration: string
  applicants: number
  applied?: boolean
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
  const [projects, setProjects] = useState(initialProjects)
  const [query, setQuery] = useState('')
  const [showPublish, setShowPublish] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)

  const filteredProjects = useMemo(() => projects.filter((project) =>
    `${project.title} ${project.company} ${project.skills.join(' ')}`.toLowerCase().includes(query.toLowerCase()),
  ), [projects, query])

  function applyToProject(id: number) {
    setProjects((current) => current.map((project) => project.id === id ? { ...project, applied: true, applicants: project.applicants + 1 } : project))
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
          <span className="brand-mark"><Icon name="spark" /></span><span>skill<span>bridge</span></span>
        </button>
        <button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation"><Icon name="menu" /></button>
        <nav className={mobileNav ? 'nav-links open' : 'nav-links'}>
          <button className={view === 'home' ? 'active' : ''} onClick={() => { setView('home'); setMobileNav(false) }}>How it works</button>
          <button className={view === 'student' ? 'active' : ''} onClick={() => { setView('student'); setMobileNav(false) }}>For students</button>
          <button className={view === 'employer' ? 'active' : ''} onClick={() => { setView('employer'); setMobileNav(false) }}>For businesses</button>
        </nav>
        <div className="top-actions"><button className="text-button">Log in</button><button className="dark-button" onClick={() => setView('student')}>Get started <Icon name="arrow" /></button></div>
      </header>

      {view === 'home' && <main>
        <section className="hero-section">
          <div className="hero-copy"><p className="eyebrow"><span className="eyebrow-dot" /> Real projects. Real experience.</p><h1>Bridge the gap<br />between <em>talent</em><br />and opportunity.</h1><p className="hero-description">SkillBridge connects ambitious students with businesses that need fresh thinking. Build your portfolio while making an impact.</p><div className="hero-actions"><button className="dark-button large" onClick={() => setView('student')}>Find a project <Icon name="arrow" /></button><button className="outline-button large" onClick={() => setShowPublish(true)}>I&apos;m hiring <Icon name="arrow" /></button></div><div className="social-proof"><div className="avatar-stack"><span>JD</span><span>AK</span><span>RM</span><span>+</span></div><p><strong>2,400+</strong> students already building their future</p></div></div>
          <div className="hero-art"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-card main-card"><span className="card-label">PROJECT MATCH</span><div className="match-row"><div className="mini-avatar blue">JL</div><div><strong>Jordan Lee</strong><small>Product Designer</small></div><b>94%</b></div><div className="match-line"><span /></div><div className="match-tags"><span>UX Research</span><span>Figma</span></div></div><div className="art-card floating-card"><Icon name="briefcase" /><span>New opportunity</span><strong>Design a better tomorrow</strong></div><div className="sun-shape" /></div>
        </section>
        <section className="metrics"><div><strong>1,200+</strong><span>Live projects</span></div><div><strong>380</strong><span>Partner businesses</span></div><div><strong>92%</strong><span>Student success rate</span></div><div><strong>4.9/5</strong><span>Community rating</span></div></section>
        <section className="how-section"><div className="section-heading"><p className="eyebrow">Simple by design</p><h2>Start where you are.<br /><em>Go where you&apos;re needed.</em></h2></div><div className="steps"><article><span className="step-number">01</span><Icon name="users" /><h3>Discover your match</h3><p>Tell us what you&apos;re curious about. We&apos;ll surface projects that fit your skills and ambitions.</p></article><article><span className="step-number">02</span><Icon name="briefcase" /><h3>Do meaningful work</h3><p>Collaborate with real teams on challenges that matter. No coffee runs, just your ideas.</p></article><article><span className="step-number">03</span><Icon name="spark" /><h3>Build what&apos;s next</h3><p>Leave with a stronger portfolio, new connections, and a clearer path forward.</p></article></div></section>
      </main>}

      {view === 'student' && <main className="dashboard"><div className="dashboard-header"><div><p className="eyebrow">Student workspace</p><h1>Find work that <em>matters.</em></h1><p>Explore projects matched to your skills and interests.</p></div><div className="profile-pill"><div className="mini-avatar peach">AM</div><span><strong>Alex Morgan</strong><small>Product design student</small></span></div></div><div className="dashboard-tabs"><button className="active">Explore projects <span>{projects.length}</span></button><button>My applications <span>2</span></button><button>Saved <span>4</span></button></div><div className="filter-bar"><div className="search-field"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by skill, role, or company..." /></div><button className="filter-button">All categories⌄</button><button className="filter-button">Duration⌄</button></div><div className="project-grid">{filteredProjects.map((project) => <article className="project-card" key={project.id}><div className="project-top"><span className="company-badge">{project.company.slice(0, 2).toUpperCase()}</span><button className="save-button">♡</button></div><p className="project-company">{project.company}</p><h3>{project.title}</h3><p className="project-description">{project.description}</p><div className="tag-row">{project.skills.map((skill) => <span key={skill}>{skill}</span>)}</div><div className="project-footer"><span>{project.duration} <i>·</i> {project.applicants} applicants</span><button className={project.applied ? 'applied-button' : 'apply-button'} onClick={() => applyToProject(project.id)}>{project.applied ? <><Icon name="check" /> Applied</> : 'View project →'}</button></div></article>)}</div></main>}

      {view === 'employer' && <main className="dashboard employer-dashboard"><div className="dashboard-header"><div><p className="eyebrow">Business workspace</p><h1>Build your next <em>great team.</em></h1><p>Connect with curious, capable students ready to make an impact.</p></div><button className="dark-button large" onClick={() => setShowPublish(true)}><Icon name="plus" /> Publish a project</button></div><div className="employer-stats"><div><span>ACTIVE PROJECTS</span><strong>{projects.length}</strong><small>↑ 2 this month</small></div><div><span>TOTAL APPLICANTS</span><strong>{projects.reduce((sum, project) => sum + project.applicants, 0)}</strong><small>Across all projects</small></div><div><span>SHORTLISTED</span><strong>18</strong><small>5 awaiting review</small></div></div><div className="section-heading compact"><p className="eyebrow">Your projects</p><h2>Manage your opportunities</h2></div><div className="employer-list">{projects.slice(0, 3).map((project) => <div className="employer-row" key={project.id}><span className="company-badge">{project.company.slice(0, 2).toUpperCase()}</span><div><strong>{project.title}</strong><small>Published recently · {project.applicants} applicants</small></div><span className="status-dot">● Live</span><button className="outline-button">Manage →</button></div>)}</div></main>}

      {showPublish && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowPublish(false)}><form className="publish-modal" onSubmit={publishProject}><button type="button" className="close-button" onClick={() => setShowPublish(false)}>×</button><p className="eyebrow">New opportunity</p><h2>Publish a project</h2><p className="modal-intro">Give talented students a chance to do their best work.</p><label>Project title<input required name="title" placeholder="e.g. Design our next product launch" /></label><label>What will they work on?<textarea required name="description" placeholder="Describe the challenge and the impact..." rows={3} /></label><div className="form-row"><label>Skills needed<input required name="skills" placeholder="React, Figma, Research" /></label><label>Duration<select name="duration"><option>4 weeks</option><option>6 weeks</option><option>8 weeks</option><option>12 weeks</option></select></label></div><button className="dark-button large" type="submit">Publish project <Icon name="arrow" /></button></form></div>}
      <footer><span className="brand"><span className="brand-mark"><Icon name="spark" /></span>skill<span>bridge</span></span><span>Connecting potential to possibility.</span><span>© 2024 SkillBridge</span></footer>
    </div>
  )
}

export default App
