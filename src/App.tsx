import type { ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import AppShell, { homeFor } from './components/AppShell'
import { Empty, ToastProvider } from './components/ui'
import * as Admin from './pages/admin/Admin'
import LessonEditor from './pages/authoring/LessonEditor'
import QuestionBank from './pages/authoring/QuestionBank'
import Login from './pages/auth/Login'
import Onboarding from './pages/auth/Onboarding'
import RegisterSchool from './pages/auth/RegisterSchool'
import * as Editor from './pages/editor/Editor'
import Guardian from './pages/guardian/Guardian'
import { FindSchool, MyCertificate, Plans, SchoolDetail } from './pages/learner/Account'
import Assignments from './pages/learner/Assignments'
import Discussions, { SpacePage } from './pages/learner/Discussions'
import ExamRunner from './pages/learner/ExamRunner'
import Home from './pages/learner/Home'
import Learn, { TopicPage } from './pages/learner/Learn'
import LessonPage from './pages/learner/Lesson'
import Notes from './pages/learner/Notes'
import Practice, { StartAttempt } from './pages/learner/Practice'
import Progress from './pages/learner/Progress'
import Results from './pages/learner/Results'
import WhatsApp from './pages/learner/WhatsApp'
import Verify, { PublicCertificate } from './pages/public/Certificate'
import Landing from './pages/public/Landing'
import * as School from './pages/school/School'
import { Notifications, Privacy, Settings } from './pages/Shared'
import * as T from './pages/teacher/Dashboard'
import * as Teach from './pages/teacher/Teaching'
import { useCurrentUser } from './store/store'
import type { Role } from './types'

function RequireAuth({ children }: { children: ReactNode }) {
  const me = useCurrentUser()
  if (!me) return <Navigate to="/login" replace />
  if (!me.onboarded || me.status === 'pending_consent') return <Navigate to="/onboarding" replace />
  if (me.status === 'suspended')
    return (
      <Empty title="Account suspended">
        Contact support. <Link to="/">Back</Link>
      </Empty>
    )
  return <>{children}</>
}

function Only({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const me = useCurrentUser()!
  return roles.includes(me.role) ? <>{children}</> : <Navigate to={homeFor(me.role)} replace />
}

const LEARNER: Role[] = ['student', 'individual']
const STAFF: Role[] = ['teacher', 'school_admin']
const CMS: Role[] = ['content_editor', 'super_admin']

function HomeRedirect() {
  const me = useCurrentUser()!
  return <Navigate to={homeFor(me.role)} replace />
}

const NotFound = () => (
  <Empty title="Page not found">
    <Link to="/app">Go to my dashboard</Link>
  </Empty>
)

export default function App() {
  const l = (el: ReactNode) => <Only roles={LEARNER}>{el}</Only>
  const st = (el: ReactNode) => <Only roles={STAFF}>{el}</Only>
  const cms = (el: ReactNode) => <Only roles={CMS}>{el}</Only>
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Login signup />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/register-school" element={<RegisterSchool />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/verify/:number" element={<Verify />} />
          <Route path="/certificate/:number" element={<PublicCertificate />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route
            path="/app"
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route index element={<HomeRedirect />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings" element={<Settings />} />
            <Route path="learn/lesson/:lessonId" element={<LessonPage />} />
            <Route path="results/:attemptId" element={<Results />} />
            <Route path="discussions/:spaceId" element={<SpacePage />} />

            <Route path="home" element={l(<Home />)} />
            <Route path="learn" element={l(<Learn />)} />
            <Route path="learn/topic/:topicId" element={l(<TopicPage />)} />
            <Route path="practice" element={l(<Practice />)} />
            <Route path="practice/start/:mode" element={l(<StartAttempt />)} />
            <Route path="exam/:attemptId" element={l(<ExamRunner />)} />
            <Route path="assignments" element={<Only roles={['student']}><Assignments /></Only>} />
            <Route path="notes" element={l(<Notes />)} />
            <Route path="discussions" element={<Only roles={['student']}><Discussions /></Only>} />
            <Route path="progress" element={l(<Progress />)} />
            <Route path="whatsapp" element={l(<WhatsApp />)} />
            <Route path="certificate" element={<Only roles={['student']}><MyCertificate /></Only>} />
            <Route path="plans" element={l(<Plans />)} />
            <Route path="schools" element={l(<FindSchool />)} />
            <Route path="schools/:schoolId" element={l(<SchoolDetail />)} />

            <Route path="guardian" element={<Only roles={['guardian']}><Guardian /></Only>} />

            <Route path="teacher" element={st(<T.ClassOverview />)} />
            <Route path="teacher/heatmap" element={st(<T.Heatmap />)} />
            <Route path="teacher/engagement" element={st(<T.Engagement />)} />
            <Route path="teacher/students/:studentId" element={st(<T.StudentProfile />)} />
            <Route path="teacher/at-risk" element={st(<T.AtRisk />)} />
            <Route path="teacher/exam-ready" element={st(<T.ExamReady />)} />
            <Route path="teacher/results" element={st(<T.ExamResults />)} />
            <Route path="teacher/content" element={st(<Teach.MyLessons />)} />
            <Route path="teacher/content/lesson/:lessonId" element={st(<LessonEditor />)} />
            <Route path="teacher/questions" element={st(<QuestionBank />)} />
            <Route path="teacher/tests" element={st(<Teach.Tests />)} />
            <Route path="teacher/tests/new" element={st(<Teach.TestEditor />)} />
            <Route path="teacher/tests/:testId" element={st(<Teach.TestResults />)} />
            <Route path="teacher/tests/:testId/edit" element={st(<Teach.TestEditor />)} />
            <Route path="teacher/syllabus" element={st(<Teach.Syllabus />)} />
            <Route path="teacher/attendance" element={st(<Teach.Attendance />)} />
            <Route path="teacher/discussions" element={st(<Teach.TeacherDiscussions />)} />

            <Route path="school" element={<Only roles={['school_admin']}><School.SchoolOverview /></Only>} />
            {(
              [
                ['teachers', School.Teachers],
                ['cohorts', School.Cohorts],
                ['enrolments', School.Enrolments],
                ['approvals', School.Approvals],
                ['certificates', School.Certificates],
                ['billing', School.Billing],
                ['branding', School.Branding],
                ['reports', School.Reports],
                ['announcements', School.Announcements],
              ] as const
            ).map(([path, C]) => (
              <Route key={path} path={`school/${path}`} element={<Only roles={['school_admin']}><C /></Only>} />
            ))}

            <Route path="editor" element={cms(<Editor.ContentLibrary />)} />
            <Route path="editor/lesson/:lessonId" element={cms(<LessonEditor national />)} />
            <Route path="editor/questions" element={cms(<QuestionBank national />)} />
            <Route path="editor/analysis" element={cms(<Editor.ItemAnalysis />)} />
            <Route path="editor/reports" element={cms(<Editor.ReportsQueue />)} />
            <Route path="editor/law" element={cms(<Editor.LawChange />)} />

            <Route path="admin" element={<Only roles={['super_admin']}><Admin.Metrics /></Only>} />
            {(
              [
                ['schools', Admin.Schools],
                ['users', Admin.Users],
                ['plans', Admin.Plans],
                ['finance', Admin.Finance],
                ['moderation', Admin.Moderation],
                ['support', Admin.Support],
                ['audit', Admin.Audit],
              ] as const
            ).map(([path, C]) => (
              <Route key={path} path={`admin/${path}`} element={<Only roles={['super_admin']}><C /></Only>} />
            ))}
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  )
}
