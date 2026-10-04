import { ArrowDown, ArrowUp, Copy, Download, Eye, EyeOff, Pencil, Plus, QrCode, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Avatar, Badge, Bar, Empty, Field, masteryTone, Modal, PageHead, Seg, Stat, useToast } from '../../components/ui'
import Thread from '../../components/Thread'
import { isCorrect } from '../../lib/engine'
import { moderationQueue, scopeCohorts, scopeStudents, spaceTitle } from '../../lib/scope'
import { exportCSV, fmtDate, fmtDateTime, fmtTime, isoDay, pct, relTime, shuffle, uid } from '../../lib/util'
import { moderatePost, recordAttendance, saveCohort, saveLesson, saveTest, setCohortLessonHidden, setLessonStatus } from '../../store/actions'
import { useAppState, useMe } from '../../store/store'
import type { Lesson, TeacherTest } from '../../types'

const statusTone = { draft: undefined, in_review: 'warning', published: 'success', retired: 'danger', archived: 'danger' } as const

// ─── My lessons (§15) ────────────────────────────────────────────────────
export function MyLessons() {
  const s = useAppState()
  const me = useMe()
  const toast = useToast()
  const mine = s.lessons.filter((l) => l.schoolId === me.schoolId && l.status !== 'archived')
  const archived = s.lessons.filter((l) => l.schoolId === me.schoolId && l.status === 'archived')
  const propose = (l: Lesson) => {
    const copy: Lesson = { ...l, id: uid('l'), schoolId: null, status: 'in_review', title: `${l.title} (proposed by ${s.schools.find((x) => x.id === me.schoolId)?.name})`, authorId: me.id, version: 1 }
    saveLesson(copy, me.id)
    toast('Proposed to the national library — content editors will review it')
  }
  return (
    <div>
      <PageHead
        title="My lessons"
        sub="Build your own lessons in the same format as national content. Only your school's students see them."
        actions={
          <Link className="btn primary" to="/app/teacher/content/lesson/new">
            <Plus size={15} /> New lesson
          </Link>
        }
      />
      {mine.length === 0 ? (
        <Empty title="No school lessons yet">Start from a template: every lesson follows the 8 scenario blocks.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Lesson</th>
                <th>Topic</th>
                <th>Status</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {mine.map((l) => (
                <tr key={l.id}>
                  <td>
                    <strong className="small">{l.title}</strong>
                    <div className="tiny faint">
                      v{l.version} · {l.language?.toUpperCase()} · by {s.users.find((u) => u.id === l.authorId)?.name}
                    </div>
                  </td>
                  <td className="small">{s.topics.find((t) => t.id === l.topicId)?.title}</td>
                  <td>
                    <Badge tone={statusTone[l.status]}>{l.status === 'in_review' ? 'awaiting approval' : l.status.replace('_', ' ')}</Badge>
                  </td>
                  <td className="small muted">{relTime(l.updatedAt)}</td>
                  <td className="nowrap">
                    <Link className="btn sm ghost" to={`/app/learn/lesson/${l.id}`} title="Preview">
                      <Eye size={14} />
                    </Link>
                    <Link className="btn sm ghost" to={`/app/teacher/content/lesson/${l.id}`} title="Edit">
                      <Pencil size={14} />
                    </Link>
                    {l.status === 'published' && (
                      <>
                        <button className="btn sm ghost" title="Propose to national library" onClick={() => propose(l)}>
                          <Copy size={14} />
                        </button>
                        <button className="btn sm" onClick={() => (setLessonStatus(l.id, 'archived', me.id), toast('Archived', 'info'))}>
                          Archive
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {archived.length > 0 && (
        <details className="mt">
          <summary className="small muted">{archived.length} archived</summary>
          {archived.map((l) => (
            <div key={l.id} className="row small mt">
              {l.title}
              <button className="btn sm" onClick={() => setLessonStatus(l.id, 'draft', me.id)}>
                Restore as draft
              </button>
            </div>
          ))}
        </details>
      )}
      <div className="card mt">
        <h3>Record a lesson — quick guide</h3>
        <ul className="small muted" style={{ paddingLeft: 18, margin: 0 }}>
          <li>Hold the phone horizontally, film in daylight, avoid wind noise.</li>
          <li>3–5 minutes, one scenario per lesson.</li>
          <li>Follow the 8 blocks: scene → what would you do → rule → why → on the road → trap → tip → check + mission.</li>
          <li>Blur number plates and faces of passers-by; get consent from anyone identifiable.</li>
          <li>Or reuse a national video and add your own text and class notes.</li>
        </ul>
      </div>
    </div>
  )
}

// ─── Tests, exams & assignments ──────────────────────────────────────────
export function Tests() {
  const s = useAppState()
  const me = useMe()
  const navigate = useNavigate()
  const cohorts = scopeCohorts(s, me).map((c) => c.id)
  const tests = s.tests.filter((t) => t.schoolId === me.schoolId && cohorts.includes(t.cohortId))
  const [kind, setKind] = useState<'all' | TeacherTest['kind']>('all')
  return (
    <div>
      <PageHead
        title="Tests, exams & assignments"
        sub="Pick questions manually, by topic, or auto-generate from class weak topics."
        actions={
          <>
            <Link className="btn" to="/app/teacher/tests/new?kind=assignment">
              <Plus size={15} /> Assignment
            </Link>
            <Link className="btn" to="/app/teacher/tests/new?kind=test">
              <Plus size={15} /> Test
            </Link>
            <Link className="btn primary" to="/app/teacher/tests/new?kind=exam">
              <Plus size={15} /> School exam
            </Link>
          </>
        }
      />
      <Seg
        options={[
          { id: 'all', label: 'All' },
          { id: 'test', label: 'Tests' },
          { id: 'exam', label: 'Exams' },
          { id: 'assignment', label: 'Assignments' },
        ]}
        value={kind}
        onChange={setKind}
      />
      <div className="table-wrap mt">
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Class</th>
              <th>Window</th>
              <th>Submissions</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {tests
              .filter((t) => kind === 'all' || t.kind === kind)
              .map((t) => {
                const subs = new Set(s.attempts.filter((a) => a.testId === t.id && a.submittedAt).map((a) => a.userId)).size
                const size = s.users.filter((u) => u.cohortId === t.cohortId && u.role === 'student').length
                return (
                  <tr key={t.id} className="click" onClick={() => navigate(`/app/teacher/tests/${t.id}`)}>
                    <td>
                      <strong className="small">{t.title}</strong>
                      <div>
                        <Badge tone={t.kind === 'exam' ? 'danger' : t.kind === 'test' ? 'info' : undefined}>{t.kind}</Badge> {t.countsForCertificate && <Badge tone="primary">certificate</Badge>}
                      </div>
                    </td>
                    <td className="small">{s.cohorts.find((c) => c.id === t.cohortId)?.name}</td>
                    <td className="small muted nowrap">
                      {fmtDate(t.opensAt)} → {fmtDate(t.closesAt)}
                    </td>
                    <td className="num">{t.kind === 'assignment' ? '—' : `${subs}/${size}`}</td>
                    <td>
                      <Badge tone={t.status === 'published' ? 'success' : undefined}>{t.status}</Badge>
                    </td>
                    <td>
                      <Link className="btn sm ghost" to={`/app/teacher/tests/${t.id}/edit`} onClick={(e) => e.stopPropagation()}>
                        <Pencil size={14} />
                      </Link>
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function TestEditor() {
  const { testId } = useParams()
  const [params] = useSearchParams()
  const s = useAppState()
  const me = useMe()
  const toast = useToast()
  const navigate = useNavigate()
  const cohorts = scopeCohorts(s, me)
  const existing = s.tests.find((t) => t.id === testId)
  const kind = (existing?.kind ?? params.get('kind') ?? 'test') as TeacherTest['kind']
  const [t, setT] = useState<TeacherTest>(
    () =>
      existing ?? {
        id: uid('tt'),
        schoolId: me.schoolId!,
        authorId: me.id,
        kind,
        title: kind === 'exam' ? `School theory exam — ${cohorts[0]?.name.split('—')[0].trim()}` : '',
        cohortId: cohorts[0]?.id ?? '',
        questionIds: [],
        lessonIds: [],
        timeLimitMin: kind === 'exam' ? 20 : kind === 'test' ? 10 : undefined,
        attemptsAllowed: kind === 'exam' ? 1 : 2,
        showAnswers: kind === 'exam' ? 'after_close' : 'after_each',
        opensAt: new Date().toISOString(),
        closesAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        status: 'draft',
        countsForCertificate: kind === 'exam',
        createdAt: new Date().toISOString(),
      },
  )
  const [topicFilter, setTopicFilter] = useState('')
  const [gen, setGen] = useState({ topic: s.topics[0].id, count: 5 })
  const pool = s.questions.filter((q) => q.status === 'published' && (q.schoolId === null || q.schoolId === me.schoolId))
  const students = scopeStudents(s, me, t.cohortId)
  const toggle = (id: string) => setT({ ...t, questionIds: t.questionIds.includes(id) ? t.questionIds.filter((x) => x !== id) : [...t.questionIds, id] })
  const byTopic = () => {
    const picked = shuffle(pool.filter((q) => q.topicId === gen.topic && !t.questionIds.includes(q.id))).slice(0, gen.count)
    setT({ ...t, questionIds: [...t.questionIds, ...picked.map((q) => q.id)] })
    toast(`Added ${picked.length} questions`)
  }
  const fromWeak = () => {
    const avg = (tid: string) => (students.length ? students.reduce((a, u) => a + (s.mastery[u.id]?.[tid] ?? 0), 0) / students.length : 0)
    const weak = [...s.topics].sort((a, b) => avg(a.id) - avg(b.id)).slice(0, 3)
    const picked = weak.flatMap((w) => shuffle(pool.filter((q) => q.topicId === w.id && !t.questionIds.includes(q.id))).slice(0, 4))
    setT({ ...t, questionIds: [...t.questionIds, ...picked.map((q) => q.id)] })
    toast(`Added ${picked.length} questions from: ${weak.map((w) => w.title).join(', ')}`)
  }
  const valid = t.title.trim().length >= 4 && t.cohortId && (t.kind === 'assignment' ? t.lessonIds.length > 0 : t.questionIds.length > 0) && t.closesAt > t.opensAt
  const save = (status: TeacherTest['status']) => {
    saveTest({ ...t, status }, me.id)
    toast(status === 'published' ? `${t.kind[0].toUpperCase() + t.kind.slice(1)} published — students notified` : 'Saved as draft')
    navigate('/app/teacher/tests')
  }
  const toLocal = (iso: string) => {
    const d = new Date(iso)
    return `${isoDay(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div>
      <PageHead
        crumbs={[{ to: '/app/teacher/tests', label: 'Tests, exams & assignments' }]}
        title={existing ? `Edit ${t.kind}` : `New ${t.kind}`}
        actions={
          <>
            <button className="btn" disabled={!valid} onClick={() => save('draft')}>
              Save draft
            </button>
            <button className="btn primary" disabled={!valid} onClick={() => save('published')}>
              Publish
            </button>
          </>
        }
      />
      <div className="grid g-side">
        <div className="stack lg">
          <div className="card stack">
            <Field label="Title">
              <input className="input" value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} placeholder={t.kind === 'assignment' ? 'Watch lessons 3–5 and finish the topic drill by Friday' : 'Priority rules check — Week 5'} />
            </Field>
            <div className="grid g3">
              <Field label="Class">
                <select className="input" value={t.cohortId} onChange={(e) => setT({ ...t, cohortId: e.target.value })}>
                  {cohorts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Opens">
                <input className="input" type="datetime-local" value={toLocal(t.opensAt)} onChange={(e) => setT({ ...t, opensAt: new Date(e.target.value).toISOString() })} />
              </Field>
              <Field label={t.kind === 'assignment' ? 'Due' : 'Closes'} error={t.closesAt <= t.opensAt ? 'Must be after the opening' : undefined}>
                <input className="input" type="datetime-local" value={toLocal(t.closesAt)} onChange={(e) => setT({ ...t, closesAt: new Date(e.target.value).toISOString() })} />
              </Field>
            </div>
            {t.kind !== 'assignment' && (
              <div className="grid g3">
                <Field label="Timer (minutes)">
                  <input className="input" type="number" min={0} max={120} value={t.timeLimitMin ?? 0} onChange={(e) => setT({ ...t, timeLimitMin: Number(e.target.value) || undefined })} />
                </Field>
                <Field label="Attempts allowed">
                  <input className="input" type="number" min={1} max={5} disabled={t.kind === 'exam'} value={t.attemptsAllowed} onChange={(e) => setT({ ...t, attemptsAllowed: Math.max(1, Number(e.target.value)) })} />
                </Field>
                <Field label="Show answers">
                  <select className="input" value={t.showAnswers} onChange={(e) => setT({ ...t, showAnswers: e.target.value as TeacherTest['showAnswers'] })}>
                    {t.kind !== 'exam' && <option value="after_each">After each question</option>}
                    <option value="after_close">After the window closes</option>
                    <option value="never">Never</option>
                  </select>
                </Field>
              </div>
            )}
            {t.kind === 'exam' && (
              <>
                <div className="callout small">Exam mode: one attempt, no back navigation, questions and options shuffled per student, auto-submit when time ends, app switching logged.</div>
                <label className="check">
                  <input type="checkbox" checked={!!t.countsForCertificate} onChange={(e) => setT({ ...t, countsForCertificate: e.target.checked })} /> Result counts toward certificate eligibility
                </label>
              </>
            )}
          </div>

          {t.kind === 'assignment' ? (
            <div className="card">
              <h3>Lessons to complete</h3>
              {s.topics.map((tp) => {
                const ls = s.lessons.filter((l) => l.topicId === tp.id && l.status === 'published' && (l.schoolId === null || l.schoolId === me.schoolId))
                return (
                  <div key={tp.id} className="mb">
                    <div className="tiny faint bold">{tp.title}</div>
                    {ls.map((l) => (
                      <label key={l.id} className="check small">
                        <input type="checkbox" checked={t.lessonIds.includes(l.id)} onChange={(e) => setT({ ...t, lessonIds: e.target.checked ? [...t.lessonIds, l.id] : t.lessonIds.filter((x) => x !== l.id) })} /> {l.title}
                      </label>
                    ))}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="card stack">
              <div className="card-head">
                <h3>Questions ({t.questionIds.length})</h3>
                <select className="input" style={{ width: 'auto' }} value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)}>
                  <option value="">All topics</option>
                  {s.topics.map((tp) => (
                    <option key={tp.id} value={tp.id}>
                      {tp.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="row wrap">
                <select className="input" style={{ width: 'auto' }} value={gen.topic} onChange={(e) => setGen({ ...gen, topic: e.target.value })}>
                  {s.topics.map((tp) => (
                    <option key={tp.id} value={tp.id}>
                      {tp.title}
                    </option>
                  ))}
                </select>
                <input className="input" type="number" min={1} max={20} style={{ width: 70 }} value={gen.count} onChange={(e) => setGen({ ...gen, count: Number(e.target.value) })} />
                <button className="btn sm" onClick={byTopic}>
                  Add by topic
                </button>
                <button className="btn sm" onClick={fromWeak}>
                  <Sparkles size={14} /> Auto-generate from class weak topics
                </button>
                {t.questionIds.length > 0 && (
                  <button className="btn sm ghost" onClick={() => setT({ ...t, questionIds: [] })}>
                    Clear
                  </button>
                )}
              </div>
              <div style={{ maxHeight: 420, overflow: 'auto' }} className="stack sm">
                {pool
                  .filter((q) => !topicFilter || q.topicId === topicFilter)
                  .sort((a, b) => Number(t.questionIds.includes(b.id)) - Number(t.questionIds.includes(a.id)))
                  .map((q) => (
                    <label key={q.id} className="check small" style={{ alignItems: 'flex-start' }}>
                      <input type="checkbox" checked={t.questionIds.includes(q.id)} onChange={() => toggle(q.id)} style={{ marginTop: 3 }} />
                      <span>
                        {q.prompt} <span className="faint">· {s.topics.find((x) => x.id === q.topicId)?.title.split('—')[0]}</span> {q.schoolId && <Badge tone="info">school</Badge>}
                      </span>
                    </label>
                  ))}
              </div>
            </div>
          )}
        </div>
        <div className="card" style={{ alignSelf: 'start' }}>
          <h3>Summary</h3>
          <dl className="kv small">
            <dt>Type</dt>
            <dd>{t.kind}</dd>
            <dt>Students</dt>
            <dd>{students.length}</dd>
            {t.kind === 'assignment' ? (
              <>
                <dt>Lessons</dt>
                <dd>{t.lessonIds.length}</dd>
              </>
            ) : (
              <>
                <dt>Questions</dt>
                <dd>{t.questionIds.length}</dd>
                <dt>Timer</dt>
                <dd>{t.timeLimitMin ? `${t.timeLimitMin} min` : 'none'}</dd>
                <dt>Attempts</dt>
                <dd>{t.attemptsAllowed}</dd>
              </>
            )}
            <dt>Window</dt>
            <dd>
              {fmtDateTime(t.opensAt)} → {fmtDateTime(t.closesAt)}
            </dd>
          </dl>
        </div>
      </div>
    </div>
  )
}

export function TestResults() {
  const { testId } = useParams()
  const s = useAppState()
  const navigate = useNavigate()
  const t = s.tests.find((x) => x.id === testId)
  if (!t) return <Empty title="Not found" />
  const students = s.users.filter((u) => u.cohortId === t.cohortId && u.role === 'student')
  const attempts = s.attempts.filter((a) => a.testId === t.id && a.submittedAt)
  const best = (uid: string) => attempts.filter((a) => a.userId === uid).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]
  const done = students.filter((u) => best(u.id))
  const avg = done.length ? Math.round(done.reduce((a, u) => a + (best(u.id)!.score ?? 0), 0) / done.length) : 0
  return (
    <div>
      <PageHead
        crumbs={[{ to: '/app/teacher/tests', label: 'Tests, exams & assignments' }]}
        title={t.title}
        sub={`${t.kind} · ${s.cohorts.find((c) => c.id === t.cohortId)?.name} · ${fmtDateTime(t.opensAt)} → ${fmtDateTime(t.closesAt)}`}
        actions={
          <>
            <Link className="btn" to={`/app/teacher/tests/${t.id}/edit`}>
              <Pencil size={15} /> Edit
            </Link>
            <button className="btn" onClick={() => exportCSV(`${t.title}.csv`, students.map((u) => ({ student: u.name, submitted: !!best(u.id), score: best(u.id)?.score ?? '', passed: best(u.id)?.passed ?? '', app_switches: best(u.id)?.appSwitches ?? '' })))}>
              <Download size={15} /> Export
            </button>
          </>
        }
      />
      {t.kind === 'assignment' ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                {t.lessonIds.map((id) => (
                  <th key={id} className="small">
                    {s.lessons.find((l) => l.id === id)?.title.slice(0, 28)}…
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  {t.lessonIds.map((id) => {
                    const p = s.progress[u.id]?.[id]
                    return <td key={id}>{p && (p.videoPct >= 90 || p.textRead) ? <Badge tone="success">done</Badge> : <Badge>{p ? `${p.videoPct}%` : '—'}</Badge>}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="grid g3 mb">
            <Stat label="Submitted" value={`${done.length}/${students.length}`} />
            <Stat label="Average score" value={`${avg}%`} tone={avg >= 60 ? 'success' : 'danger'} />
            <Stat label="App switches logged" value={attempts.reduce((a, x) => a + (x.appSwitches ?? 0), 0)} />
          </div>
          <div className="grid g2">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Score</th>
                    <th>Time</th>
                    <th>Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((u) => {
                    const a = best(u.id)
                    return (
                      <tr key={u.id} className={a ? 'click' : ''} onClick={() => a && navigate(`/app/results/${a.id}`)}>
                        <td>{u.name}</td>
                        <td>{a ? <Badge tone={(a.score ?? 0) >= 60 ? 'success' : 'danger'}>{a.score}%</Badge> : <span className="faint small">not submitted</span>}</td>
                        <td className="small muted">{a ? fmtTime((new Date(a.submittedAt!).getTime() - new Date(a.startedAt).getTime()) / 1000) : ''}</td>
                        <td>{a?.appSwitches ? <Badge tone="danger">switched {a.appSwitches}×</Badge> : ''}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="card">
              <h3>Item analysis</h3>
              <div className="stack sm">
                {t.questionIds.map((qid, i) => {
                  const q = s.questions.find((x) => x.id === qid)!
                  const answered = attempts.filter((a) => a.answers[qid])
                  const p = pct(answered.filter((a) => isCorrect(q, a.answers[qid])).length, answered.length)
                  return (
                    <div key={qid}>
                      <div className="row between small">
                        <span className="ellipsis" title={q.prompt}>
                          {i + 1}. {q.prompt}
                        </span>
                        <span className="num">{answered.length ? `${p}%` : '—'}</span>
                      </div>
                      <Bar value={p} tone={masteryTone(p)} thin />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Syllabus per cohort ─────────────────────────────────────────────────
export function Syllabus() {
  const s = useAppState()
  const me = useMe()
  const toast = useToast()
  const cohorts = scopeCohorts(s, me)
  const [cid, setCid] = useState(cohorts[0]?.id ?? '')
  const c = s.cohorts.find((x) => x.id === cid)
  if (!c) return <Empty title="No classes" />
  const lessons = s.lessons.filter((l) => l.status === 'published' && (l.schoolId === null || l.schoolId === me.schoolId))
  const order = [...c.lessonOrder.filter((id) => lessons.some((l) => l.id === id)), ...lessons.map((l) => l.id).filter((id) => !c.lessonOrder.includes(id))]
  const move = (id: string, d: -1 | 1) => {
    const i = order.indexOf(id)
    const j = i + d
    if (j < 0 || j >= order.length) return
    const next = [...order]
    ;[next[i], next[j]] = [next[j], next[i]]
    saveCohort({ ...c, lessonOrder: next }, me.id)
  }
  return (
    <div>
      <PageHead
        title="Syllabus"
        sub="Order national and school lessons for each cohort, and hide lessons you haven't taught yet."
        actions={
          <select className="input" style={{ width: 'auto' }} value={cid} onChange={(e) => setCid(e.target.value)}>
            {cohorts.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        }
      />
      <div className="card">
        <div className="list">
          {order.map((id, i) => {
            const l = lessons.find((x) => x.id === id)!
            const hidden = c.hiddenLessonIds.includes(id)
            return (
              <div key={id} className="list-item" style={{ opacity: hidden ? 0.5 : 1 }}>
                <span className="num faint small" style={{ width: 24 }}>
                  {i + 1}
                </span>
                <span className="grow">
                  <strong className="small">{l.title}</strong>
                  <span className="tiny faint" style={{ display: 'block' }}>
                    {s.topics.find((t) => t.id === l.topicId)?.title} {l.schoolId ? '· school lesson' : '· national'}
                  </span>
                </span>
                <button className="btn ghost icon" onClick={() => move(id, -1)} disabled={i === 0} aria-label="Move up">
                  <ArrowUp size={14} />
                </button>
                <button className="btn ghost icon" onClick={() => move(id, 1)} disabled={i === order.length - 1} aria-label="Move down">
                  <ArrowDown size={14} />
                </button>
                <button className="btn sm" onClick={() => (setCohortLessonHidden(c.id, id, !hidden), toast(hidden ? 'Visible to students' : 'Hidden until you teach it', 'info'))}>
                  {hidden ? <Eye size={14} /> : <EyeOff size={14} />} {hidden ? 'Show' : 'Hide'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Attendance ──────────────────────────────────────────────────────────
export function Attendance() {
  const s = useAppState()
  const me = useMe()
  const toast = useToast()
  const cohorts = scopeCohorts(s, me)
  const [cid, setCid] = useState(cohorts[0]?.id ?? '')
  const [topic, setTopic] = useState('Priority rules — classroom')
  const [present, setPresent] = useState<string[]>([])
  const [qr, setQr] = useState(false)
  const students = s.users.filter((u) => u.cohortId === cid && u.role === 'student')
  const history = s.attendance.filter((a) => a.cohortId === cid)
  return (
    <div>
      <PageHead
        title="Attendance"
        sub="Optional: classroom theory sessions attended, marked by QR scan or list. Can count toward certificates."
        actions={
          <select className="input" style={{ width: 'auto' }} value={cid} onChange={(e) => (setCid(e.target.value), setPresent([]))}>
            {cohorts.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        }
      />
      <div className="grid g-side">
        <div className="card stack">
          <h2>Today's session</h2>
          <Field label="Session topic">
            <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} />
          </Field>
          <div className="row wrap">
            <button className="btn sm" onClick={() => setQr(true)}>
              <QrCode size={14} /> Show QR for students to scan
            </button>
            <button className="btn sm ghost" onClick={() => setPresent(students.map((u) => u.id))}>
              <Users size={14} /> Mark all present
            </button>
          </div>
          <div className="list">
            {students.map((u) => (
              <label key={u.id} className="list-item check">
                <input type="checkbox" checked={present.includes(u.id)} onChange={(e) => setPresent(e.target.checked ? [...present, u.id] : present.filter((x) => x !== u.id))} />
                <Avatar name={u.name} size="sm" /> {u.name}
              </label>
            ))}
          </div>
          <button
            className="btn primary"
            disabled={!topic.trim()}
            onClick={() => {
              recordAttendance(cid, topic.trim(), present, me.id)
              toast(`Attendance saved: ${present.length}/${students.length} present`)
              setPresent([])
            }}
          >
            Save attendance ({present.length}/{students.length})
          </button>
        </div>
        <div className="card">
          <h3>History</h3>
          {history.length === 0 ? (
            <p className="small muted">No sessions recorded.</p>
          ) : (
            <div className="list">
              {history.map((a) => (
                <div key={a.id} className="list-item small">
                  <span className="grow">
                    <strong>{a.topic}</strong>
                    <span className="faint" style={{ display: 'block' }}>
                      {fmtDate(a.date)}
                    </span>
                  </span>
                  <Badge>
                    {a.present.length}/{students.length}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {qr && (
        <Modal title="Scan to check in" onClose={() => setQr(false)}>
          <div className="stack center">
            <div style={{ background: '#fff', padding: 16, borderRadius: 12, margin: '0 auto' }}>
              <QRCodeSVG value={`${location.origin}/app/checkin/${cid}/${isoDay()}`} size={220} />
            </div>
            <p className="small muted">Students scan this code with the app. Scans appear here live.</p>
            <button
              className="btn"
              onClick={() => {
                const rest = students.filter((u) => !present.includes(u.id))
                if (!rest.length) return toast('Everyone has checked in', 'info')
                const u = rest[Math.floor(Math.random() * rest.length)]
                setPresent([...present, u.id])
                toast(`${u.name} checked in`)
              }}
            >
              Simulate a student scan
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Discussions & moderation ────────────────────────────────────────────
export function TeacherDiscussions() {
  const s = useAppState()
  const me = useMe()
  const toast = useToast()
  const queue = moderationQueue(s, me)
  const cohorts = scopeCohorts(s, me)
  const spaces = [...cohorts.map((c) => `class:${c.id}`), `school:${me.schoolId}`, `teachers:${me.schoolId}`]
  const lessonSpaces = [...new Set(s.posts.filter((p) => p.status !== 'deleted' && (p.spaceId.startsWith('lesson:') || p.spaceId.startsWith('question:')) && p.spaceId.endsWith(`:${me.schoolId}`)).map((p) => p.spaceId))]
  const unanswered = s.posts.filter(
    (p) => !p.parentId && p.status === 'visible' && [...spaces, ...lessonSpaces].includes(p.spaceId) && s.users.find((u) => u.id === p.authorId)?.role === 'student' && !s.posts.some((r) => r.parentId === p.id && ['teacher', 'school_admin'].includes(s.users.find((u) => u.id === r.authorId)?.role ?? '')),
  )
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div>
      <PageHead title="Discussions" sub="Answer questions, pin the best answers and moderate. All teacher–student communication happens in visible spaces." />
      <div className="grid g2 mb">
        <div className="card">
          <div className="card-head">
            <h2>
              <ShieldCheck size={18} /> Moderation queue ({queue.length})
            </h2>
          </div>
          {queue.length === 0 ? (
            <p className="small muted">Nothing to review.</p>
          ) : (
            <div className="list">
              {queue.map((p) => (
                <div key={p.id} className="list-item" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div className="grow">
                    <div className="small">
                      <strong>{s.users.find((u) => u.id === p.authorId)?.name}</strong> in {spaceTitle(s, p.spaceId)}
                    </div>
                    <div className="bubble small">{p.body}</div>
                    <div className="tiny" style={{ color: 'var(--danger)' }}>
                      {p.status === 'held' ? `Held: ${p.flagReason}` : `Reported: ${p.reports.map((r) => r.reason).join(', ')}`}
                    </div>
                  </div>
                  <div className="row">
                    {p.status === 'held' ? (
                      <button className="btn sm" onClick={() => (moderatePost(p.id, me.id, 'approve'), toast('Approved'))}>
                        Approve
                      </button>
                    ) : (
                      <button className="btn sm" onClick={() => (moderatePost(p.id, me.id, 'dismiss_reports'), toast('Reports dismissed'))}>
                        Keep
                      </button>
                    )}
                    <button className="btn sm" onClick={() => (moderatePost(p.id, me.id, 'hide'), toast('Hidden'))}>
                      Hide
                    </button>
                    <button className="btn sm danger" onClick={() => (moderatePost(p.id, me.id, 'delete'), toast('Deleted'))}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <h2>Unanswered questions ({unanswered.length})</h2>
          {unanswered.length === 0 ? (
            <p className="small muted">All student questions have a teacher answer.</p>
          ) : (
            <div className="list">
              {unanswered.map((p) => (
                <button key={p.id} className="list-item" style={{ background: 'none', border: 0, width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }} onClick={() => setOpen(p.spaceId)}>
                  <span className="grow small">
                    <strong>{s.users.find((u) => u.id === p.authorId)?.name}</strong>: {p.body}
                    <span className="tiny faint" style={{ display: 'block' }}>
                      {spaceTitle(s, p.spaceId)} · {relTime(p.createdAt)}
                    </span>
                  </span>
                  <span className="btn sm">Answer</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="card">
        <h2>Spaces</h2>
        <div className="list">
          {[...spaces, ...lessonSpaces].map((id) => (
            <Link key={id} to={id.startsWith('lesson:') ? `/app/learn/lesson/${id.split(':')[1]}#comments` : `/app/discussions/${encodeURIComponent(id)}`} className="list-item">
              <span className="grow small bold">{spaceTitle(s, id)}</span>
              <Badge>{s.posts.filter((p) => p.spaceId === id && p.status === 'visible').length} posts</Badge>
            </Link>
          ))}
        </div>
      </div>
      {open && (
        <Modal wide title={spaceTitle(s, open)} onClose={() => setOpen(null)}>
          <Thread spaceId={open} canModerate />
        </Modal>
      )}
    </div>
  )
}
