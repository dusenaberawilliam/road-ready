import { AlertTriangle, CheckCircle2, ClipboardPlus, Download, Gauge, MessageCircle, NotebookPen, UserCheck, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Avatar, Badge, Bar, Bars, Empty, Field, heatColor, masteryTone, Modal, PageHead, Sparkline, Stat, useToast } from '../../components/ui'
import { lessonViewed, readiness, readinessTrend, studentStats, visibleLessons } from '../../lib/engine'
import { scopeCohorts, scopeStudents, visibleAttempts } from '../../lib/scope'
import { DAY, exportCSV, fmtDate, fmtDateTime, isoDay, relTime } from '../../lib/util'
import { addNote, addStudentNote, assignWork, confirmExamResult, confirmReadiness, sendNudge } from '../../store/actions'
import { useAppState, useMe } from '../../store/store'
import type { User } from '../../types'
import { StudyCalendar } from '../learner/Progress'

export function useCohortFilter() {
  const s = useAppState()
  const me = useMe()
  const [params, setParams] = useSearchParams()
  const cohorts = scopeCohorts(s, me)
  const cohortId = params.get('cohort') ?? ''
  const students = scopeStudents(s, me, cohortId || undefined)
  const picker = (
    <select className="input" style={{ width: 'auto' }} value={cohortId} onChange={(e) => setParams(e.target.value ? { cohort: e.target.value } : {})} aria-label="Cohort">
      <option value="">{me.role === 'school_admin' ? 'All cohorts (whole school)' : 'All my classes'}</option>
      {cohorts.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  )
  return { cohorts, cohortId, students, picker }
}

const inactiveDays = (u: User) => Math.floor((Date.now() - new Date(u.lastActive).getTime()) / DAY)

// ─── Class overview ──────────────────────────────────────────────────────
export function ClassOverview() {
  const s = useAppState()
  const me = useMe()
  const navigate = useNavigate()
  const { students, picker } = useCohortFilter()
  const rows = students.map((u) => ({ u, r: readiness(s, u.id), inactive: inactiveDays(u) }))
  const avgR = rows.length ? Math.round(rows.reduce((a, x) => a + x.r.value, 0) / rows.length) : 0
  const active = rows.filter((x) => x.inactive < 7).length
  const dist = [
    { label: 'Not ready', value: rows.filter((x) => x.r.label === 'Not ready').length, tone: 'danger' },
    { label: 'Almost', value: rows.filter((x) => x.r.label === 'Almost ready').length, tone: 'accent' },
    { label: 'Exam-ready', value: rows.filter((x) => x.r.label === 'Exam-ready').length, tone: 'success' },
  ]
  const buckets = [0, 20, 40, 60, 80].map((lo) => ({ label: `${lo}–${lo + 19}`, value: rows.filter((x) => x.r.value >= lo && x.r.value < lo + 20 + (lo === 80 ? 1 : 0)).length, tone: lo >= 80 ? 'success' : lo >= 60 ? 'accent' : 'danger' }))
  const pending = s.posts.filter((p) => p.spaceId.startsWith('class:') && !p.parentId && p.status === 'visible' && scopeCohorts(s, me).some((c) => p.spaceId === `class:${c.id}`) && !s.posts.some((r) => r.parentId === p.id && s.users.find((u) => u.id === r.authorId)?.role === 'teacher') && s.users.find((u) => u.id === p.authorId)?.role === 'student')

  return (
    <div>
      <PageHead
        title="Class overview"
        sub={`${me.role === 'school_admin' ? 'Whole school' : 'Your classes'} — who is ready, who is stuck, and what the class is failing.`}
        actions={
          <>
            {picker}
            <button className="btn" onClick={() => exportCSV('class-overview.csv', rows.map(({ u, r, inactive }) => ({ name: u.name, phone: u.phone, cohort: s.cohorts.find((c) => c.id === u.cohortId)?.name, readiness: r.value, status: r.label, mocks_passed: r.mocksPassed, weakest_topic: s.topics.find((t) => t.id === r.weakest[0]?.topicId)?.title, inactive_days: inactive })))}>
              <Download size={15} /> Export
            </button>
          </>
        }
      />
      <div className="grid g4 mb">
        <Stat icon={<Users size={19} />} label="Students" value={rows.length} delta={`${active} active this week · ${rows.length - active} inactive`} />
        <Stat icon={<Gauge size={19} />} label="Class average readiness" value={`${avgR}%`} tone={avgR >= 80 ? 'success' : avgR >= 60 ? 'warning' : 'danger'} />
        <Stat icon={<UserCheck size={19} />} label="Exam-ready" value={dist[2].value} delta={<Link to="/app/teacher/exam-ready">see list →</Link>} tone="success" />
        <Stat icon={<AlertTriangle size={19} />} label="At risk" value={rows.filter((x) => x.inactive >= 5 || x.r.value < 50).length} delta={<Link to="/app/teacher/at-risk">nudge them →</Link>} tone="danger" />
      </div>
      <div className="grid g2 mb">
        <div className="card">
          <h3>Readiness distribution</h3>
          <Bars data={buckets} />
        </div>
        <div className="card">
          <h3>Status</h3>
          <div className="stack sm">
            {dist.map((d) => (
              <div key={d.label}>
                <div className="row between small">
                  <span>{d.label}</span>
                  <strong>{d.value}</strong>
                </div>
                <div className="bar">
                  <span style={{ width: `${rows.length ? (d.value / rows.length) * 100 : 0}%`, background: `var(--${d.tone})` }} />
                </div>
              </div>
            ))}
          </div>
          {pending.length > 0 && (
            <div className="callout warning small mt">
              {pending.length} unanswered question{pending.length > 1 ? 's' : ''} in class boards.{' '}
              <Link to="/app/teacher/discussions">Answer now</Link>
            </div>
          )}
        </div>
      </div>
      {rows.length === 0 ? (
        <Empty title="No students yet">Share your school code so students can join.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Cohort</th>
                <th>Readiness</th>
                <th>Mocks</th>
                <th>Weakest topic</th>
                <th>Last active</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .sort((a, b) => b.r.value - a.r.value)
                .map(({ u, r, inactive }) => (
                  <tr key={u.id} className="click" onClick={() => navigate(`/app/teacher/students/${u.id}`)}>
                    <td>
                      <div className="row">
                        <Avatar name={u.name} size="sm" />
                        <strong>{u.name}</strong>
                      </div>
                    </td>
                    <td className="small muted">{s.cohorts.find((c) => c.id === u.cohortId)?.name.split('—')[0]}</td>
                    <td style={{ minWidth: 150 }}>
                      <div className="row">
                        <div className="grow">
                          <Bar value={r.value} tone={r.tone} thin />
                        </div>
                        <span className="num small">{r.value}%</span>
                      </div>
                    </td>
                    <td className="num">{r.mocksPassed} passed</td>
                    <td className="small">{s.topics.find((t) => t.id === r.weakest[0]?.topicId)?.title}</td>
                    <td>{inactive >= 5 ? <Badge tone="danger">{inactive} days</Badge> : <span className="small muted">{relTime(u.lastActive)}</span>}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Assign work modal (used by heatmap, profile, engagement) ────────────
export function AssignModal({ studentIds, topicId, lessonIds: preset, onClose }: { studentIds: string[]; topicId?: string; lessonIds?: string[]; onClose: () => void }) {
  const s = useAppState()
  const me = useMe()
  const toast = useToast()
  const lessons = s.lessons.filter((l) => l.status === 'published' && (l.schoolId === null || l.schoolId === me.schoolId))
  const [picked, setPicked] = useState<string[]>(preset ?? lessons.filter((l) => l.topicId === topicId).map((l) => l.id))
  const [drill, setDrill] = useState(!!topicId)
  const [due, setDue] = useState(isoDay(new Date(Date.now() + 3 * DAY)))
  const topic = s.topics.find((t) => t.id === topicId)
  const [note, setNote] = useState(topic ? `Watch the ${topic.title} lessons and finish the weak-topic drill` : 'Please complete these lessons')
  const [selected, setSelected] = useState(studentIds)
  return (
    <Modal
      title="Assign work"
      wide
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!selected.length || (!picked.length && !drill)}
            onClick={() => {
              assignWork(me.id, selected, picked, note, new Date(due).toISOString(), drill ? topicId : undefined)
              toast(`Assigned to ${selected.length} student${selected.length > 1 ? 's' : ''}`)
              onClose()
            }}
          >
            Assign to {selected.length}
          </button>
        </>
      }
    >
      <div className="grid g2">
        <div className="stack">
          <Field label="Students">
            <div className="stack sm" style={{ maxHeight: 220, overflow: 'auto' }}>
              {studentIds.map((id) => {
                const u = s.users.find((x) => x.id === id)!
                return (
                  <label key={id} className="check small">
                    <input type="checkbox" checked={selected.includes(id)} onChange={(e) => setSelected(e.target.checked ? [...selected, id] : selected.filter((x) => x !== id))} />
                    {u.name} {topicId && <span className="faint">· {Math.round(s.mastery[id]?.[topicId] ?? 0)}%</span>}
                  </label>
                )
              })}
            </div>
          </Field>
          <Field label="Message">
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <Field label="Due date">
            <input className="input" type="date" value={due} min={isoDay()} onChange={(e) => setDue(e.target.value)} />
          </Field>
          {topicId && (
            <label className="check">
              <input type="checkbox" checked={drill} onChange={(e) => setDrill(e.target.checked)} /> Include a weak-topic drill on {topic?.title}
            </label>
          )}
        </div>
        <Field label="Lessons">
          <div className="stack sm" style={{ maxHeight: 360, overflow: 'auto' }}>
            {s.topics.map((t) => {
              const tl = lessons.filter((l) => l.topicId === t.id)
              return (
                <div key={t.id}>
                  <div className="tiny faint bold">{t.title}</div>
                  {tl.map((l) => (
                    <label key={l.id} className="check small">
                      <input type="checkbox" checked={picked.includes(l.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, l.id] : picked.filter((x) => x !== l.id))} />
                      {l.title}
                    </label>
                  ))}
                </div>
              )
            })}
          </div>
        </Field>
      </div>
    </Modal>
  )
}

// ─── Topic heatmap ───────────────────────────────────────────────────────
export function Heatmap() {
  const s = useAppState()
  const navigate = useNavigate()
  const { students, picker } = useCohortFilter()
  const [assign, setAssign] = useState<{ topicId: string; ids: string[] } | null>(null)
  const topics = [...s.topics].sort((a, b) => a.order - b.order)
  const avg = (tid: string) => (students.length ? Math.round(students.reduce((a, u) => a + (s.mastery[u.id]?.[tid] ?? 0), 0) / students.length) : 0)
  const weakTopic = [...topics].sort((a, b) => avg(a.id) - avg(b.id))[0]
  return (
    <div>
      <PageHead title="Topic heatmap" sub="Students × topics, coloured by mastery. Click a topic to assign a lesson + drill to the students below 60%." actions={picker} />
      {weakTopic && (
        <div className="callout warning mb row between wrap">
          <span>
            <AlertTriangle size={15} /> The class is weakest on <strong>{weakTopic.title}</strong> (average {avg(weakTopic.id)}%).
          </span>
          <button className="btn sm" onClick={() => setAssign({ topicId: weakTopic.id, ids: students.filter((u) => (s.mastery[u.id]?.[weakTopic.id] ?? 0) < 60).map((u) => u.id) })}>
            <ClipboardPlus size={14} /> Assign lesson + drill
          </button>
        </div>
      )}
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="heat">
          <thead>
            <tr>
              <th />
              {topics.map((t) => (
                <th key={t.id} className="rot">
                  <button className="linkbtn" style={{ fontWeight: 500 }} onClick={() => setAssign({ topicId: t.id, ids: students.filter((u) => (s.mastery[u.id]?.[t.id] ?? 0) < 60).map((u) => u.id) })}>
                    {t.title.replace('Road signs — ', 'Signs: ')}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((u) => (
              <tr key={u.id}>
                <td className="name">
                  <Link to={`/app/teacher/students/${u.id}`}>{u.name}</Link>
                </td>
                {topics.map((t) => {
                  const v = s.mastery[u.id]?.[t.id]
                  return (
                    <td key={t.id} style={heatColor(v)} title={`${u.name} · ${t.title}: ${v === undefined ? 'not attempted' : `${Math.round(v)}%`}`} onClick={() => navigate(`/app/teacher/students/${u.id}`)}>
                      {v === undefined ? '–' : Math.round(v)}
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr>
              <td className="name bold">Class average</td>
              {topics.map((t) => (
                <td key={t.id} style={{ ...heatColor(avg(t.id)), outline: '2px solid var(--border)' }}>
                  {avg(t.id)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <div className="row wrap small mt">
          <span className="faint">Legend:</span>
          {[
            ['< 40', 20],
            ['40–59', 50],
            ['60–79', 70],
            ['80+', 90],
          ].map(([l, v]) => (
            <span key={l} className="row" style={{ gap: 4 }}>
              <span style={{ ...heatColor(v as number), width: 18, height: 12, borderRadius: 3, display: 'inline-block' }} /> {l}
            </span>
          ))}
        </div>
      </div>
      {assign && <AssignModal studentIds={assign.ids.length ? assign.ids : students.map((u) => u.id)} topicId={assign.topicId} onClose={() => setAssign(null)} />}
    </div>
  )
}

// ─── Lesson engagement ───────────────────────────────────────────────────
export function Engagement() {
  const s = useAppState()
  const me = useMe()
  const toast = useToast()
  const { students, picker, cohortId, cohorts } = useCohortFilter()
  const [assign, setAssign] = useState<{ lessonId: string; ids: string[] } | null>(null)
  const [classNote, setClassNote] = useState<{ lessonId: string; body: string; cohortId: string } | null>(null)
  const lessons = s.lessons.filter((l) => l.status === 'published' && (l.schoolId === null || l.schoolId === me.schoolId))
  const rows = lessons.map((l) => {
    const n = students.length || 1
    const watched = students.filter((u) => (s.progress[u.id]?.[l.id]?.videoPct ?? 0) >= 90).length
    const read = students.filter((u) => s.progress[u.id]?.[l.id]?.textRead).length
    const checks = s.attempts.filter((a) => a.mode === 'lesson_check' && a.lessonId === l.id && a.submittedAt && students.some((u) => u.id === a.userId))
    const avgCheck = checks.length ? Math.round(checks.reduce((a, x) => a + (x.score ?? 0), 0) / checks.length) : null
    return {
      l,
      watched: Math.round((watched / n) * 100),
      read: Math.round((read / n) * 100),
      notes: s.notes.filter((x) => x.itemId === l.id && students.some((u) => u.id === x.userId)).length,
      comments: s.posts.filter((p) => p.spaceId === `lesson:${l.id}:${me.schoolId}`).length,
      downloads: students.filter((u) => l.attachments.some((a) => s.downloads[u.id]?.includes(a.id))).length,
      avgCheck,
      notViewed: students.filter((u) => !lessonViewed(s, u.id, l.id)).map((u) => u.id),
    }
  })
  return (
    <div>
      <PageHead
        title="Lesson engagement"
        sub="Per lesson: % watched the video, % read the text, notes, comments and average lesson-check score."
        actions={
          <>
            {picker}
            <button className="btn" onClick={() => exportCSV('lesson-engagement.csv', rows.map((r) => ({ lesson: r.l.title, video_watched_pct: r.watched, text_read_pct: r.read, notes: r.notes, comments: r.comments, downloads: r.downloads, avg_check: r.avgCheck ?? '' })))}>
              <Download size={15} /> Export
            </button>
          </>
        }
      />
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Lesson</th>
              <th>Video watched</th>
              <th>Text read</th>
              <th>Notes</th>
              <th>Comments</th>
              <th>Avg check</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows
              .sort((a, b) => a.watched - b.watched)
              .map((r) => (
                <tr key={r.l.id}>
                  <td>
                    <Link to={`/app/learn/lesson/${r.l.id}`} className="small bold">
                      {r.l.title}
                    </Link>
                    <div className="tiny faint">{s.topics.find((t) => t.id === r.l.topicId)?.title}{r.l.schoolId ? ' · school lesson' : ''}</div>
                  </td>
                  <td style={{ minWidth: 110 }}>
                    <Bar value={r.watched} tone={masteryTone(r.watched)} thin /> <span className="tiny">{r.watched}%</span>
                  </td>
                  <td style={{ minWidth: 110 }}>
                    <Bar value={r.read} thin /> <span className="tiny">{r.read}%</span>
                  </td>
                  <td className="num">{r.notes}</td>
                  <td className="num">{r.comments}</td>
                  <td className="num">{r.avgCheck === null ? '—' : `${r.avgCheck}%`}</td>
                  <td className="nowrap">
                    <button className="btn sm" disabled={!r.notViewed.length} onClick={() => setAssign({ lessonId: r.l.id, ids: r.notViewed })} title="Re-assign to students who have not watched or read it">
                      Re-assign ({r.notViewed.length})
                    </button>{' '}
                    <button className="btn sm ghost" onClick={() => setClassNote({ lessonId: r.l.id, body: '', cohortId: cohortId || cohorts[0]?.id })} title="Add class note">
                      <NotebookPen size={14} />
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {assign && <AssignModal studentIds={assign.ids} lessonIds={[assign.lessonId]} onClose={() => setAssign(null)} />}
      {classNote && (
        <Modal
          title="Add a class note"
          onClose={() => setClassNote(null)}
          footer={
            <button
              className="btn primary"
              disabled={classNote.body.trim().length < 3}
              onClick={() => {
                const l = s.lessons.find((x) => x.id === classNote.lessonId)!
                addNote({ userId: me.id, itemId: l.id, itemTitle: l.title, topicId: l.topicId, body: classNote.body.trim(), visibility: 'class', cohortId: classNote.cohortId })
                setClassNote(null)
                toast('Class note added — students were notified')
              }}
            >
              Add note
            </button>
          }
        >
          <div className="stack">
            <p className="small muted">{s.lessons.find((x) => x.id === classNote.lessonId)?.title} — visible to your students only.</p>
            <Field label="Class">
              <select className="input" value={classNote.cohortId} onChange={(e) => setClassNote({ ...classNote, cohortId: e.target.value })}>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <textarea className="input" value={classNote.body} onChange={(e) => setClassNote({ ...classNote, body: e.target.value })} placeholder="e.g. We will practise this at Sonatubes on Thursday." autoFocus />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Student profile ─────────────────────────────────────────────────────
export function StudentProfile() {
  const { studentId } = useParams()
  const s = useAppState()
  const me = useMe()
  const toast = useToast()
  const navigate = useNavigate()
  const [note, setNote] = useState('')
  const [assign, setAssign] = useState(false)
  const [nudge, setNudge] = useState(false)
  const u = scopeStudents(s, me).find((x) => x.id === studentId)
  if (!u) return <Empty title="Student not found in your classes" />
  const { r, studyMinutes } = studentStats(s, u.id)
  const trend = readinessTrend(s, u.id)
  const attempts = visibleAttempts(s, u).sort((a, b) => b.submittedAt!.localeCompare(a.submittedAt!))
  const lessons = visibleLessons(s, u)
  const cert = s.certificates.find((c) => c.userId === u.id && c.status !== 'revoked')
  const notes = s.studentNotes.filter((n) => n.studentId === u.id)
  const attended = s.attendance.filter((a) => a.cohortId === u.cohortId)
  const flagged = attempts.filter((a) => (a.appSwitches ?? 0) > 0)
  return (
    <div>
      <PageHead
        crumbs={[{ to: '/app/teacher', label: 'Class overview' }]}
        title={u.name}
        sub={`${s.cohorts.find((c) => c.id === u.cohortId)?.name} · ${u.phone} · exam ${u.examDate ? fmtDate(u.examDate) : 'not set'} · last active ${relTime(u.lastActive)}`}
        actions={
          <>
            <button className="btn" onClick={() => setNudge(true)}>
              <MessageCircle size={15} /> Nudge
            </button>
            <button className="btn" onClick={() => setAssign(true)}>
              <ClipboardPlus size={15} /> Assign work
            </button>
            {cert?.status === 'teacher_confirmed' || cert?.status === 'issued' ? (
              <Badge tone="success">{cert.status === 'issued' ? 'Certificate issued' : 'Marked exam-ready'}</Badge>
            ) : (
              <button
                className="btn primary"
                onClick={() => {
                  if (!r.examReady && !confirm(`${u.name} does not meet all readiness rules yet:\n• ${r.missing.join('\n• ')}\n\nMark exam-ready anyway?`)) return
                  confirmReadiness(u.id, me.id)
                  toast(`${u.name} marked exam-ready — sent to the school admin for the certificate`)
                }}
              >
                <UserCheck size={15} /> Mark exam-ready
              </button>
            )}
          </>
        }
      />
      {u.historyVisibleFrom && <div className="callout small mb">This learner joined from the marketplace without sharing previous history — you see activity since {fmtDate(u.historyVisibleFrom)}.</div>}
      <div className="grid g4 mb">
        <Stat label="Readiness" value={`${r.value}%`} delta={r.label} tone={r.tone} />
        <Stat label="Lessons completed" value={`${lessons.filter((l) => s.progress[u.id]?.[l.id]?.checkPassed).length}/${lessons.length}`} />
        <Stat label="Mocks passed" value={`${r.mocksPassed}/${attempts.filter((a) => a.mode === 'mock').length}`} />
        <Stat label="Time studied" value={`${Math.round(studyMinutes / 60)} h`} delta={`${attended.filter((a) => a.present.includes(u.id)).length}/${attended.length} classroom sessions`} />
      </div>
      <div className="grid g-side">
        <div className="stack lg">
          <div className="card">
            <h3>Readiness trend</h3>
            <Sparkline values={trend.map((p) => p.value)} height={80} />
            {!r.examReady && (
              <div className="small muted mt">
                Missing for exam-ready: {r.missing.join(' · ')}
              </div>
            )}
          </div>
          <div className="card">
            <h3>Topic mastery</h3>
            <div className="grid g2" style={{ gap: 10 }}>
              {s.topics.map((t) => {
                const v = s.mastery[u.id]?.[t.id]
                return (
                  <div key={t.id}>
                    <div className="row between small">
                      <span className="ellipsis">{t.title}</span>
                      <span className="num">{v === undefined ? '—' : `${Math.round(v)}%`}</span>
                    </div>
                    <Bar value={v ?? 0} tone={v === undefined ? undefined : masteryTone(v)} thin />
                  </div>
                )
              })}
            </div>
          </div>
          <div className="card">
            <h3>Attempts</h3>
            {flagged.length > 0 && <div className="callout danger small mb">App switching was logged in {flagged.length} exam attempt(s).</div>}
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>What</th>
                    <th>Score</th>
                    <th>Channel</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.slice(0, 12).map((a) => (
                    <tr key={a.id} className="click" onClick={() => navigate(`/app/results/${a.id}`)}>
                      <td className="small nowrap">{fmtDateTime(a.submittedAt)}</td>
                      <td className="small">
                        {a.title} {(a.appSwitches ?? 0) > 0 && <Badge tone="danger">switched {a.appSwitches}×</Badge>}
                      </td>
                      <td>{a.mode === 'mock' || a.examMode ? <Badge tone={a.passed ? 'success' : 'danger'}>{a.score}%</Badge> : `${a.score}%`}</td>
                      <td className="small muted">{a.channel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="stack lg">
          <div className="card">
            <h3>Teacher notes</h3>
            <div className="row">
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Private note about this student" />
              <button className="btn" disabled={note.trim().length < 3} onClick={() => (addStudentNote(u.id, me.id, note.trim()), setNote(''), toast('Note added'))}>
                Add
              </button>
            </div>
            <div className="list mt">
              {notes.map((n) => (
                <div key={n.id} className="list-item small" style={{ alignItems: 'flex-start' }}>
                  <div>
                    {n.body}
                    <div className="tiny faint">
                      {s.users.find((x) => x.id === n.authorId)?.name} · {relTime(n.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h3>Study days</h3>
            <StudyCalendar userId={u.id} />
          </div>
          <div className="card">
            <h3>Lessons</h3>
            <div className="stack sm">
              {lessons.map((l) => {
                const p = s.progress[u.id]?.[l.id]
                return (
                  <div key={l.id} className="row small">
                    {p?.checkPassed ? <CheckCircle2 size={15} color="var(--success)" /> : <span style={{ width: 15, height: 15, borderRadius: 99, border: '2px solid var(--border)', display: 'inline-block' }} />}
                    <span className="grow ellipsis">{l.title}</span>
                    <span className="faint">{p ? `${p.videoPct}%${p.textRead ? ' · read' : ''}` : '—'}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      {assign && <AssignModal studentIds={[u.id]} topicId={r.weakest[0]?.topicId} onClose={() => setAssign(false)} />}
      {nudge && <NudgeModal ids={[u.id]} onClose={() => setNudge(false)} />}
    </div>
  )
}

export function NudgeModal({ ids, onClose, preset }: { ids: string[]; onClose: () => void; preset?: string }) {
  const s = useAppState()
  const me = useMe()
  const toast = useToast()
  const first = s.users.find((u) => u.id === ids[0])?.name.split(' ')[0]
  const [msg, setMsg] = useState(preset ?? `Muraho${ids.length === 1 ? ` ${first}` : ''}! We missed you this week. 10 minutes today makes a difference — open your plan and do your quick quiz. — ${me.name.split(' ')[0]}`)
  return (
    <Modal
      title={`WhatsApp nudge to ${ids.length} student${ids.length > 1 ? 's' : ''}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={msg.trim().length < 5}
            onClick={() => {
              sendNudge(me.id, ids, msg.trim())
              toast(`Sent to ${ids.length} student${ids.length > 1 ? 's' : ''} on WhatsApp`)
              onClose()
            }}
          >
            <MessageCircle size={15} /> Send
          </button>
        </>
      }
    >
      <textarea className="input" rows={4} value={msg} onChange={(e) => setMsg(e.target.value)} />
      <p className="tiny faint">Sent as an approved WhatsApp template. Quiet hours (9 pm–7 am) are respected automatically.</p>
    </Modal>
  )
}

// ─── At-risk ─────────────────────────────────────────────────────────────
export function AtRisk() {
  const s = useAppState()
  const { students, picker } = useCohortFilter()
  const [sel, setSel] = useState<string[]>([])
  const [nudge, setNudge] = useState(false)
  const rows = students
    .map((u) => {
      const mocks = s.attempts.filter((a) => a.userId === u.id && a.mode === 'mock' && a.submittedAt).sort((a, b) => a.submittedAt!.localeCompare(b.submittedAt!))
      const falling = mocks.length >= 2 && (mocks[mocks.length - 1].score ?? 0) < (mocks[mocks.length - 2].score ?? 0) - 5
      return { u, inactive: inactiveDays(u), falling, r: readiness(s, u.id), last2: mocks.slice(-2).map((m) => m.score) }
    })
    .filter((x) => x.inactive >= 5 || x.falling)
  return (
    <div>
      <PageHead
        title="At-risk students"
        sub="Inactive 5+ days or readiness falling."
        actions={
          <>
            {picker}
            <button className="btn primary" disabled={!sel.length} onClick={() => setNudge(true)}>
              <MessageCircle size={15} /> Send WhatsApp nudge ({sel.length})
            </button>
          </>
        }
      />
      {rows.length === 0 ? (
        <Empty title="No one at risk right now 🎉" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>
                  <input type="checkbox" checked={sel.length === rows.length} onChange={(e) => setSel(e.target.checked ? rows.map((x) => x.u.id) : [])} aria-label="Select all" />
                </th>
                <th>Student</th>
                <th>Reason</th>
                <th>Readiness</th>
                <th>Last active</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ u, inactive, falling, r, last2 }) => (
                <tr key={u.id}>
                  <td>
                    <input type="checkbox" checked={sel.includes(u.id)} onChange={(e) => setSel(e.target.checked ? [...sel, u.id] : sel.filter((x) => x !== u.id))} aria-label={`Select ${u.name}`} />
                  </td>
                  <td>
                    <Link to={`/app/teacher/students/${u.id}`}>{u.name}</Link>
                  </td>
                  <td>
                    {inactive >= 5 && <Badge tone="danger">Inactive {inactive} days</Badge>} {falling && <Badge tone="warning">Mock fell {last2.join('% → ')}%</Badge>}
                  </td>
                  <td className="num">{r.value}%</td>
                  <td className="small muted">{relTime(u.lastActive)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {nudge && <NudgeModal ids={sel} onClose={() => (setNudge(false), setSel([]))} />}
    </div>
  )
}

// ─── Exam-ready list ─────────────────────────────────────────────────────
export function ExamReady() {
  const s = useAppState()
  const me = useMe()
  const toast = useToast()
  const { students, picker } = useCohortFilter()
  const [remind, setRemind] = useState<string[] | null>(null)
  const rows = students.map((u) => ({ u, r: readiness(s, u.id), cert: s.certificates.find((c) => c.userId === u.id && c.status !== 'revoked') }))
  const ready = rows.filter((x) => x.r.examReady)
  const almost = rows.filter((x) => !x.r.examReady && x.r.value >= 70).sort((a, b) => b.r.value - a.r.value)
  const Row = ({ u, r, cert }: (typeof rows)[number]) => (
    <div className="list-item" style={{ flexWrap: 'wrap' }}>
      <Avatar name={u.name} size="sm" />
      <div className="grow">
        <Link to={`/app/teacher/students/${u.id}`} className="bold">
          {u.name}
        </Link>
        <div className="small muted">
          Readiness {r.value}% · {r.mocksPassed} mocks passed · exam {u.examDate ? fmtDate(u.examDate) : 'not set'}
          {!r.examReady && ` · missing: ${r.missing.join(', ')}`}
        </div>
      </div>
      {cert && cert.status !== 'eligible' ? (
        <Badge tone="success">{cert.status === 'issued' ? 'Certificate issued' : 'Confirmed'}</Badge>
      ) : (
        <button className="btn sm primary" disabled={!r.examReady} onClick={() => (confirmReadiness(u.id, me.id), toast(`${u.name} confirmed — school admin notified`))}>
          <UserCheck size={14} /> Confirm readiness
        </button>
      )}
      <button className="btn sm" onClick={() => setRemind([u.id])}>
        Exam reminder
      </button>
    </div>
  )
  return (
    <div>
      <PageHead title="Exam-ready list" sub="Readiness 80%+, 2 full mocks passed, every topic attempted and every lesson watched or read." actions={picker} />
      <div className="card mb">
        <div className="card-head">
          <h2>Exam-ready ({ready.length})</h2>
          {ready.length > 0 && (
            <button className="btn sm" onClick={() => setRemind(ready.map((x) => x.u.id))}>
              Remind all
            </button>
          )}
        </div>
        {ready.length === 0 ? <p className="muted small">No student meets all the rules yet.</p> : <div className="list">{ready.map((x) => <Row key={x.u.id} {...x} />)}</div>}
      </div>
      <div className="card">
        <h2>Almost there (70%+)</h2>
        {almost.length === 0 ? <p className="muted small">Nobody close yet.</p> : <div className="list">{almost.map((x) => <Row key={x.u.id} {...x} />)}</div>}
      </div>
      {remind && <NudgeModal ids={remind} preset="Your provisional theory exam is coming soon. Take one more full mock this week and review your notes. Good luck! 🍀" onClose={() => setRemind(null)} />}
    </div>
  )
}

// ─── Exam results loop ───────────────────────────────────────────────────
export function ExamResults() {
  const s = useAppState()
  const me = useMe()
  const toast = useToast()
  const { students } = useCohortFilter()
  const results = s.examResults.filter((r) => students.some((u) => u.id === r.userId)).sort((a, b) => b.date.localeCompare(a.date))
  const school = s.schools.find((x) => x.id === me.schoolId)
  return (
    <div>
      <PageHead title="Real exam results" sub="Students report pass/fail after the real exam; you confirm. Confirmed results feed the school's pass rate." />
      <div className="grid g3 mb">
        <Stat label="School pass rate (confirmed)" value={`${school?.passRate ?? 0}%`} delta={`${school?.confirmedResults ?? 0} confirmed results`} />
        <Stat label="Awaiting confirmation" value={results.filter((r) => !r.confirmedBy).length} tone="warning" />
        <Stat label="Reported this month" value={results.filter((r) => r.date.slice(0, 7) === new Date().toISOString().slice(0, 7)).length} />
      </div>
      {results.length === 0 ? (
        <Empty title="No results reported yet" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Exam date</th>
                <th>Result</th>
                <th>Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const u = s.users.find((x) => x.id === r.userId)!
                return (
                  <tr key={r.id}>
                    <td>
                      <Link to={`/app/teacher/students/${u.id}`}>{u.name}</Link>
                    </td>
                    <td>{fmtDate(r.date)}</td>
                    <td>
                      <Badge tone={r.passed ? 'success' : 'danger'}>{r.passed ? 'Passed' : 'Not passed'}</Badge>
                    </td>
                    <td className="num">{r.score ? `${r.score}%` : '—'}</td>
                    <td>
                      {r.confirmedBy ? (
                        <span className="small muted">Confirmed by {s.users.find((x) => x.id === r.confirmedBy)?.name}</span>
                      ) : (
                        <button className="btn sm primary" onClick={() => (confirmExamResult(r.id, me.id), toast('Result confirmed'))}>
                          Confirm
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="small faint mt">If RNP/Irembo offers an official result check later, it will replace self-reporting.</p>
    </div>
  )
}
