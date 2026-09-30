import { BookOpen, CheckCircle2, Circle, Clock, Gauge, Timer } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import RoadSign from '../../components/RoadSign'
import { Badge, Bar, Field, masteryTone, PageHead, Ring, Sparkline, Stat, useToast } from '../../components/ui'
import { readiness, readinessTrend, studentStats } from '../../lib/engine'
import { DAY, fmtDate, fmtDateTime, isoDay } from '../../lib/util'
import { reportExamResult, updateUser } from '../../store/actions'
import { useAppState, useMe } from '../../store/store'
import type { SignKind } from '../../types'

export function StudyCalendar({ userId }: { userId: string }) {
  const s = useAppState()
  const days = new Set(s.studyDays[userId] ?? [])
  const cells = Array.from({ length: 28 }, (_, i) => isoDay(new Date(Date.now() - (27 - i) * DAY)))
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(14, 1fr)', gap: 4 }}>
        {cells.map((d) => (
          <div key={d} title={`${d}${days.has(d) ? ' · studied' : ''}`} style={{ aspectRatio: '1', borderRadius: 4, background: days.has(d) ? 'var(--primary)' : 'var(--surface-3)' }} />
        ))}
      </div>
      <p className="tiny faint" style={{ marginTop: 6 }}>
        Last 4 weeks · {cells.filter((d) => days.has(d)).length} study days
      </p>
    </div>
  )
}

export default function Progress() {
  const s = useAppState()
  const me = useMe()
  const toast = useToast()
  const navigate = useNavigate()
  const r = readiness(s, me.id)
  const { mocks, studyMinutes } = studentStats(s, me.id)
  const trend = readinessTrend(s, me.id)
  const m = s.mastery[me.id] ?? {}
  const [exam, setExam] = useState(me.examDate ? isoDay(me.examDate) : '')
  const [result, setResult] = useState<{ passed: '' | 'yes' | 'no'; score: string; date: string }>({ passed: '', score: '', date: isoDay() })
  const reported = s.examResults.filter((x) => x.userId === me.id)
  const progress = Object.values(s.progress[me.id] ?? {})
  const reqs = [
    { ok: r.value >= 80, label: `Readiness 80%+ (now ${r.value}%)` },
    { ok: r.mocksPassed >= 2, label: `At least 2 full mocks passed (${r.mocksPassed})` },
    { ok: r.topicsAttempted === r.topicsTotal, label: `Every topic attempted (${r.topicsAttempted}/${r.topicsTotal})` },
    { ok: r.lessonsViewed === r.lessonsTotal, label: `Every lesson watched or read (${r.lessonsViewed}/${r.lessonsTotal})` },
  ]

  return (
    <div>
      <PageHead title="My progress" sub="Your readiness score is the chance of passing the real exam today." />
      <div className="grid g4 mb">
        <Stat icon={<Gauge size={19} />} label="Readiness" value={`${r.value}%`} delta={r.label} tone={r.tone} />
        <Stat icon={<Timer size={19} />} label="Mocks passed" value={`${r.mocksPassed}/${mocks.length}`} delta={mocks.length ? `last ${mocks[mocks.length - 1]?.score ?? 0}%` : 'none yet'} />
        <Stat icon={<BookOpen size={19} />} label="Lessons completed" value={`${progress.filter((p) => p.checkPassed).length}`} delta={`${progress.filter((p) => p.videoPct >= 90).length} videos watched`} />
        <Stat icon={<Clock size={19} />} label="Study time" value={`${Math.round(studyMinutes / 60)} h`} delta={`${s.notes.filter((n) => n.userId === me.id).length} notes · ${s.posts.filter((p) => p.authorId === me.id).length} comments`} />
      </div>
      <div className="grid g-side">
        <div className="stack lg">
          <div className="card">
            <div className="card-head">
              <h2>Topic mastery</h2>
              <span className="small faint">weighted by share of the real exam</span>
            </div>
            <div className="stack sm">
              {[...s.topics]
                .sort((a, b) => a.order - b.order)
                .map((t) => {
                  const v = Math.round(m[t.id] ?? 0)
                  return (
                    <Link key={t.id} to={`/app/learn/topic/${t.id}`} className="row" style={{ color: 'inherit', textDecoration: 'none' }}>
                      <RoadSign kind={t.icon as SignKind} size={26} />
                      <span className="small" style={{ width: 230 }}>
                        {t.title}
                      </span>
                      <div className="grow">
                        <Bar value={v} tone={m[t.id] === undefined ? undefined : masteryTone(v)} />
                      </div>
                      <span className="small num" style={{ width: 70, textAlign: 'right' }}>
                        {m[t.id] === undefined ? 'not tried' : `${v}%`}
                      </span>
                    </Link>
                  )
                })}
            </div>
          </div>
          <div className="card">
            <h2>Mock exams</h2>
            {mocks.length === 0 ? (
              <p className="muted">No mock yet. <Link to="/app/practice/start/mock">Take your first mock</Link>.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Score</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...mocks].reverse().map((a) => (
                      <tr key={a.id} className="click" onClick={() => navigate(`/app/results/${a.id}`)}>
                        <td>{fmtDateTime(a.submittedAt)}</td>
                        <td className="num">{a.score}%</td>
                        <td>
                          <Badge tone={a.passed ? 'success' : 'danger'}>{a.passed ? 'Pass' : 'Fail'}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        <div className="stack lg">
          <div className="card center">
            <Ring value={r.value} tone={r.tone} label={r.label} size={150} />
            <div className="mt">
              <Sparkline values={trend.map((p) => p.value)} />
              <span className="tiny faint">Readiness trend (dashed line = 60%)</span>
            </div>
          </div>
          <div className="card">
            <h3>Exam-ready checklist</h3>
            <div className="stack sm">
              {reqs.map((x) => (
                <div key={x.label} className="row small">
                  {x.ok ? <CheckCircle2 size={17} color="var(--success)" /> : <Circle size={17} className="faint" />}
                  {x.label}
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h3>Study days</h3>
            <StudyCalendar userId={me.id} />
          </div>
          <div className="card">
            <h3>Exam date</h3>
            <div className="row">
              <input className="input" type="date" value={exam} onChange={(e) => setExam(e.target.value)} />
              <button
                className="btn"
                onClick={() => {
                  updateUser(me.id, { examDate: exam ? new Date(exam).toISOString() : undefined })
                  toast('Exam date saved — your plan adapts to it')
                }}
              >
                Save
              </button>
            </div>
            <p className="tiny faint" style={{ marginBottom: 0 }}>In the last 7 days your plan switches to more mocks and fewer new lessons.</p>
          </div>
          <div className="card" id="result">
            <h3>Report my real exam result</h3>
            {reported.map((x) => (
              <div key={x.id} className="callout small mb">
                {fmtDate(x.date)}: <strong>{x.passed ? 'Passed' : 'Not passed'}</strong>
                {x.score ? ` (${x.score}%)` : ''} · {x.confirmedBy ? <Badge tone="success">confirmed by teacher</Badge> : me.schoolId ? <Badge tone="warning">awaiting teacher</Badge> : null}
              </div>
            ))}
            <div className="stack sm">
              <Field label="Result">
                <div className="row">
                  <button className={`chip ${result.passed === 'yes' ? 'on' : ''}`} onClick={() => setResult({ ...result, passed: 'yes' })}>
                    I passed 🎉
                  </button>
                  <button className={`chip ${result.passed === 'no' ? 'on' : ''}`} onClick={() => setResult({ ...result, passed: 'no' })}>
                    Not this time
                  </button>
                </div>
              </Field>
              <div className="grid g2">
                <Field label="Score (if known)">
                  <input className="input" inputMode="numeric" value={result.score} onChange={(e) => setResult({ ...result, score: e.target.value.replace(/\D/g, '').slice(0, 3) })} />
                </Field>
                <Field label="Exam date">
                  <input className="input" type="date" value={result.date} max={isoDay()} onChange={(e) => setResult({ ...result, date: e.target.value })} />
                </Field>
              </div>
              <button
                className="btn primary"
                disabled={!result.passed}
                onClick={() => {
                  reportExamResult(me.id, result.passed === 'yes', result.score ? Number(result.score) : undefined, new Date(result.date).toISOString())
                  setResult({ passed: '', score: '', date: isoDay() })
                  toast(me.schoolId ? 'Sent to your teacher for confirmation' : 'Result saved')
                }}
              >
                Submit result
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
