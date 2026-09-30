import {
  AlertTriangle,
  Award,
  Bell,
  BookOpen,
  Building2,
  CalendarCheck,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileQuestion,
  FileText,
  Flag,
  Gauge,
  GraduationCap,
  Grid3x3,
  Home,
  Inbox,
  LayoutDashboard,
  Library,
  LineChart,
  ListChecks,
  LogOut,
  Megaphone,
  Menu,
  MessageCircle,
  MessagesSquare,
  NotebookPen,
  Palette,
  PlaySquare,
  Receipt,
  Scale,
  School as SchoolIcon,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Tag,
  UserCheck,
  Users,
  UsersRound,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { isTKey, useT, type TKey } from '../lib/i18n'
import { moderationQueue, scopeCohorts } from '../lib/scope'
import { login, logout, setLanguage } from '../store/actions'
import { resetDemo, useAppState, useMe } from '../store/store'
import type { Lang, Role } from '../types'
import { Avatar, Modal, useToast } from './ui'

interface NavItem {
  to: string
  label: string | TKey
  icon: ReactNode
  count?: number
  end?: boolean
}

export const roleLabel: Record<Role, string> = {
  student: 'School student',
  individual: 'Individual learner',
  guardian: 'Guardian',
  teacher: 'Teacher',
  school_admin: 'School admin',
  content_editor: 'Content editor',
  super_admin: 'Super admin',
}

export const homeFor = (role: Role) =>
  ({
    student: '/app/home',
    individual: '/app/home',
    guardian: '/app/guardian',
    teacher: '/app/teacher',
    school_admin: '/app/school',
    content_editor: '/app/editor',
    super_admin: '/app/admin',
  })[role]

export const DEMO_ACCOUNTS: { id: string; role: Role; blurb: string }[] = [
  { id: 'u-student', role: 'student', blurb: 'Aline · Kigali Safe Drive, Cohort A (motos)' },
  { id: 'u-individual', role: 'individual', blurb: 'Eric · studying alone on the free plan' },
  { id: 'u-guardian', role: 'guardian', blurb: 'Jeanne · parent of Kevin (17)' },
  { id: 'u-teacher', role: 'teacher', blurb: 'Jean-Paul · teaches Cohort A' },
  { id: 'u-admin', role: 'school_admin', blurb: 'Diane · runs Kigali Safe Drive School' },
  { id: 'u-editor', role: 'content_editor', blurb: 'Patrick · national content team' },
  { id: 'u-super', role: 'super_admin', blurb: 'Mugabo · platform owner' },
]

function useNav(): { section?: string; items: NavItem[] }[] {
  const s = useAppState()
  const me = useMe()
  const i = 18
  switch (me.role) {
    case 'student':
    case 'individual': {
      const openTests = s.tests.filter((t) => t.cohortId === me.cohortId && t.status === 'published' && new Date(t.closesAt) > new Date() && !s.attempts.some((a) => a.testId === t.id && a.userId === me.id && a.submittedAt)).length
      const openAssign = s.assignments.filter((a) => a.userId === me.id && !a.done).length
      const learner: NavItem[] = [
        { to: '/app/home', label: 'home', icon: <Home size={i} /> },
        { to: '/app/learn', label: 'learn', icon: <BookOpen size={i} /> },
        { to: '/app/practice', label: 'practice', icon: <ClipboardCheck size={i} /> },
      ]
      if (me.role === 'student') learner.push({ to: '/app/assignments', label: 'assignments', icon: <ClipboardList size={i} />, count: openTests + openAssign })
      learner.push({ to: '/app/notes', label: 'notes', icon: <NotebookPen size={i} /> })
      if (me.role === 'student') learner.push({ to: '/app/discussions', label: 'discussions', icon: <MessagesSquare size={i} /> })
      learner.push({ to: '/app/progress', label: 'progress', icon: <LineChart size={i} /> }, { to: '/app/whatsapp', label: 'whatsapp', icon: <MessageCircle size={i} /> })
      const more: NavItem[] =
        me.role === 'student'
          ? [{ to: '/app/certificate', label: 'certificate', icon: <Award size={i} /> }]
          : [
              { to: '/app/plans', label: 'plans', icon: <CreditCard size={i} /> },
              { to: '/app/schools', label: 'findSchool', icon: <Search size={i} /> },
            ]
      return [{ items: learner }, { section: 'Account', items: more }]
    }
    case 'guardian':
      return [{ items: [{ to: '/app/guardian', label: 'guardian', icon: <UsersRound size={i} /> }] }]
    case 'teacher':
    case 'school_admin': {
      const schoolId = me.schoolId
      const classes = scopeCohorts(s, me).map((c) => c.id)
      const heldAll = moderationQueue(s, me).length
      const toConfirm = s.examResults.filter((r) => !r.confirmedBy && s.users.find((u) => u.id === r.userId && u.cohortId && classes.includes(u.cohortId))).length
      const teaching: { section?: string; items: NavItem[] }[] = [
        {
          section: me.role === 'school_admin' ? 'Classes (whole school)' : 'My classes',
          items: [
            { to: '/app/teacher', label: 'Class overview', icon: <LayoutDashboard size={i} />, end: true },
            { to: '/app/teacher/heatmap', label: 'Topic heatmap', icon: <Grid3x3 size={i} /> },
            { to: '/app/teacher/engagement', label: 'Lesson engagement', icon: <PlaySquare size={i} /> },
            { to: '/app/teacher/at-risk', label: 'At-risk students', icon: <AlertTriangle size={i} /> },
            { to: '/app/teacher/exam-ready', label: 'Exam-ready list', icon: <UserCheck size={i} /> },
            { to: '/app/teacher/results', label: 'Exam results', icon: <ListChecks size={i} />, count: toConfirm },
          ],
        },
        {
          section: 'Teaching',
          items: [
            { to: '/app/teacher/content', label: 'My lessons', icon: <FileText size={i} /> },
            { to: '/app/teacher/questions', label: 'Question bank', icon: <FileQuestion size={i} /> },
            { to: '/app/teacher/tests', label: 'Tests, exams & assignments', icon: <ClipboardList size={i} /> },
            { to: '/app/teacher/syllabus', label: 'Syllabus', icon: <Library size={i} /> },
            { to: '/app/teacher/attendance', label: 'Attendance', icon: <CalendarCheck size={i} /> },
            { to: '/app/teacher/discussions', label: 'Discussions', icon: <MessagesSquare size={i} />, count: heldAll },
          ],
        },
      ]
      if (me.role === 'teacher') return teaching
      const pendingApprovals = s.lessons.filter((l) => l.schoolId === schoolId && l.status === 'in_review').length
      const pendingCerts = s.certificates.filter((c) => c.schoolId === schoolId && c.status === 'teacher_confirmed').length
      const pendingEnrol = s.enrolmentRequests.filter((r) => r.schoolId === schoolId && r.status === 'requested').length
      return [
        {
          section: 'School',
          items: [
            { to: '/app/school', label: 'School overview', icon: <Gauge size={i} />, end: true },
            { to: '/app/school/teachers', label: 'Teachers', icon: <GraduationCap size={i} /> },
            { to: '/app/school/cohorts', label: 'Cohorts & students', icon: <Users size={i} /> },
            { to: '/app/school/enrolments', label: 'Enrolment requests', icon: <Inbox size={i} />, count: pendingEnrol },
            { to: '/app/school/approvals', label: 'Content approval', icon: <ShieldCheck size={i} />, count: pendingApprovals },
            { to: '/app/school/certificates', label: 'Certificates', icon: <Award size={i} />, count: pendingCerts },
            { to: '/app/school/billing', label: 'Billing', icon: <Receipt size={i} /> },
            { to: '/app/school/branding', label: 'Branding', icon: <Palette size={i} /> },
            { to: '/app/school/reports', label: 'Reports', icon: <ScrollText size={i} /> },
            { to: '/app/school/announcements', label: 'Announcements', icon: <Megaphone size={i} /> },
          ],
        },
        ...teaching,
      ]
    }
    case 'content_editor':
    case 'super_admin': {
      const openReports = s.reports.filter((r) => r.status === 'open').length
      const inReview = s.lessons.filter((l) => l.schoolId === null && l.status === 'in_review').length
      const cms: { section?: string; items: NavItem[] } = {
        section: 'National content (CMS)',
        items: [
          { to: '/app/editor', label: 'Content library', icon: <Library size={i} />, end: true, count: inReview },
          { to: '/app/editor/questions', label: 'Question bank', icon: <FileQuestion size={i} /> },
          { to: '/app/editor/analysis', label: 'Item analysis', icon: <LineChart size={i} /> },
          { to: '/app/editor/reports', label: 'Reports queue', icon: <Flag size={i} />, count: openReports },
          { to: '/app/editor/law', label: 'Law-change mode', icon: <Scale size={i} /> },
        ],
      }
      if (me.role === 'content_editor') return [cms]
      const pendingSchools = s.schools.filter((x) => x.status === 'pending').length
      const openTickets = s.tickets.filter((t) => t.status === 'open').length
      const modQueue = s.posts.filter((p) => p.status === 'held' || (p.reports.length > 0 && p.status === 'visible')).length
      return [
        {
          section: 'Platform',
          items: [
            { to: '/app/admin', label: 'Platform metrics', icon: <Gauge size={i} />, end: true },
            { to: '/app/admin/schools', label: 'Schools', icon: <SchoolIcon size={i} />, count: pendingSchools },
            { to: '/app/admin/users', label: 'Users', icon: <Users size={i} /> },
            { to: '/app/admin/plans', label: 'Plans & discounts', icon: <Tag size={i} /> },
            { to: '/app/admin/finance', label: 'Finance', icon: <CreditCard size={i} /> },
            { to: '/app/admin/moderation', label: 'Moderation', icon: <ShieldCheck size={i} />, count: modQueue },
            { to: '/app/admin/support', label: 'Support inbox', icon: <Inbox size={i} />, count: openTickets },
            { to: '/app/admin/audit', label: 'Audit log', icon: <ScrollText size={i} /> },
          ],
        },
        cms,
      ]
    }
  }
}

export function AccountSwitcher({ onClose }: { onClose: () => void }) {
  const s = useAppState()
  const navigate = useNavigate()
  const toast = useToast()
  return (
    <Modal title="Switch demo account" onClose={onClose}>
      <p className="small muted">Every role is fully clickable. Changes you make are saved in this browser and visible across roles.</p>
      <div className="stack sm">
        {DEMO_ACCOUNTS.map((a) => {
          const u = s.users.find((x) => x.id === a.id)
          if (!u) return null
          return (
            <button
              key={a.id}
              className="btn role-card"
              style={{ justifyContent: 'flex-start', padding: 12 }}
              onClick={() => {
                login(u.id)
                onClose()
                navigate(homeFor(u.role))
                toast(`Signed in as ${u.name} (${roleLabel[u.role]})`, 'info')
              }}
            >
              <Avatar name={u.name} />
              <span className="grow" style={{ whiteSpace: 'normal' }}>
                <strong>{roleLabel[a.role]}</strong>
                <span className="small muted" style={{ display: 'block', fontWeight: 400 }}>
                  {a.blurb}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </Modal>
  )
}

export default function AppShell() {
  const s = useAppState()
  const me = useMe()
  const t = useT()
  const nav = useNav()
  const navigate = useNavigate()
  const loc = useLocation()
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const toast = useToast()
  const unread = s.notifications.filter((n) => n.userId === me.id && !n.read).length
  const school = s.schools.find((x) => x.id === me.schoolId)

  useEffect(() => {
    setOpen(false)
    if (!loc.hash) window.scrollTo(0, 0)
  }, [loc.pathname, loc.hash])

  useEffect(() => {
    if (school?.color) document.documentElement.style.setProperty('--school-color', school.color)
  }, [school?.color])

  const label = (l: string) => (isTKey(l) ? t(l) : l)

  return (
    <div className="shell">
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <Link to={homeFor(me.role)} className="brand" style={{ color: 'inherit', textDecoration: 'none' }}>
          <span className="brand-mark" style={school && me.role !== 'super_admin' ? { background: school.color, color: '#fff' } : undefined}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M5 21 L10 3 M19 21 L14 3 M12 7 v2 M12 12 v2 M12 17 v2" />
            </svg>
          </span>
          <span>
            {school && me.role !== 'super_admin' ? school.name : 'RoadReady'}
            <small>{school && me.role !== 'super_admin' ? 'on RoadReady' : 'Driving school learning platform'}</small>
          </span>
        </Link>
        <nav className="nav" aria-label="Main">
          {nav.map((sec, si) => (
            <div key={si} style={{ display: 'contents' }}>
              {sec.section && <div className="nav-section">{sec.section}</div>}
              {sec.items.map((it) => (
                <NavLink key={it.to} to={it.to} end={it.end}>
                  <span className="nav-icon">{it.icon}</span>
                  <span className="ellipsis">{label(it.label)}</span>
                  {!!it.count && <span className="count">{it.count}</span>}
                </NavLink>
              ))}
            </div>
          ))}
          <div className="nav-section">&nbsp;</div>
          <NavLink to="/app/notifications">
            <span className="nav-icon">
              <Bell size={18} />
            </span>
            {t('notifications')}
            {!!unread && <span className="count">{unread}</span>}
          </NavLink>
          <NavLink to="/app/settings">
            <span className="nav-icon">
              <Settings size={18} />
            </span>
            {t('settings')}
          </NavLink>
        </nav>
        <div className="sidebar-foot">
          <div className="row">
            <Avatar name={me.name || me.phone} />
            <div className="grow">
              <div className="bold small ellipsis">{me.name || me.phone}</div>
              <div className="tiny faint">{roleLabel[me.role]}</div>
            </div>
            <button
              className="btn ghost icon"
              title={t('logout')}
              onClick={() => {
                logout()
                navigate('/')
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main">
        <div className="demo-banner no-print">
          <span>
            Demo mode · signed in as <strong>{roleLabel[me.role]}</strong>. Data is saved in this browser only.
          </span>
          <button className="linkbtn" onClick={() => setSwitching(true)}>
            Switch role
          </button>
          <button
            className="linkbtn"
            onClick={() => {
              if (confirm('Reset all demo data to the original state?')) {
                resetDemo()
                toast('Demo data reset', 'info')
              }
            }}
          >
            Reset data
          </button>
        </div>
        <header className="topbar">
          <button className="btn ghost icon menu-btn" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <div className="grow" />
          <select className="input" style={{ width: 'auto' }} value={me.language} onChange={(e) => setLanguage(me.id, e.target.value as Lang)} aria-label={t('language')}>
            <option value="rw">RW</option>
            <option value="en">EN</option>
            <option value="fr">FR</option>
          </select>
          <Link to="/app/notifications" className="btn ghost icon" aria-label={t('notifications')} style={{ position: 'relative' }}>
            <Bell size={19} />
            {!!unread && (
              <span className="count" style={{ position: 'absolute', top: 0, right: 0, background: 'var(--danger)', color: '#fff', borderRadius: 99, fontSize: 10, padding: '0 5px', fontWeight: 700 }}>
                {unread}
              </span>
            )}
          </Link>
          <button className="btn sm hide-sm" onClick={() => setSwitching(true)}>
            <Building2 size={15} /> {roleLabel[me.role]}
          </button>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
      {switching && <AccountSwitcher onClose={() => setSwitching(false)} />}
    </div>
  )
}
