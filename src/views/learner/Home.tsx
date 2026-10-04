import { BookOpen, CalendarClock, CheckCircle2, ClipboardList, Lightbulb, Repeat, School, Sparkles, Target, Timer } from 'lucide-react'
import { Link } from 'react-router-dom'
import RoadSign from '../../components/RoadSign'
import { Badge, Bar, masteryTone, Ring } from '../../components/ui'
import { tips } from '../../data/content'
import { hasExamPass } from '../../lib/access'
import { readiness, studyPlan } from '../../lib/engine'
import { readinessLabel, useT } from '../../lib/i18n'
import { DAY, fmtDate } from '../../lib/util'
import { useAppState, useMe } from '../../store/store'
import type { SignKind } from '../../types'

export const tipOfDay = () => tips[Math.floor(Date.now() / DAY) % tips.length]

const planIcon = { lesson: <BookOpen size={18} />, drill: <Target size={18} />, review: <Repeat size={18} />, tip: <Lightbulb size={18} />, mock: <Timer size={18} /> }
const planColor = { lesson: 'primary', drill: 'danger', review: 'info', tip: 'warning', mock: 'success' } as const

export default function Home() {
  const s = useAppState()
  const me = useMe()
  const t = useT()
  const r = readiness(s, me.id)
  const plan = studyPlan(s, me.id)
  const tip = tipOfDay()
  const daysToExam = me.examDate ? Math.ceil((new Date(me.examDate).getTime() - Date.now()) / DAY) : null
  const school = s.schools.find((x) => x.id === me.schoolId)
  const openTests = s.tests.filter((x) => x.cohortId === me.cohortId && x.status === 'published' && new Date(x.closesAt) > new Date() && !s.attempts.some((a) => a.testId === x.id && a.userId === me.id && a.submittedAt))
  const openAssign = s.assignments.filter((a) => a.userId === me.id && !a.done)
  const reported = s.examResults.some((x) => x.userId === me.id)

  return (
    <div className="stack lg">
      <div className="hero-card">
        <div className="row between wrap" style={{ gap: 16 }}>
          <div>
            <h1>
              {t('greeting')}, {me.name.split(' ')[0]} 👋
            </h1>
            <p>{school ? `${school.name} · ${s.cohorts.find((c) => c.id === me.cohortId)?.name}` : hasExamPass(me) ? 'Individual learner · Exam Pass' : 'Individual learner · Free plan'}</p>
            <div className="row wrap" style={{ marginTop: 14 }}>
              {daysToExam !== null && daysToExam >= 0 && (
                <span className="hero-pill">
                  <CalendarClock size={14} /> Exam in {daysToExam} day{daysToExam === 1 ? '' : 's'} · {fmtDate(me.examDate)}
                </span>
              )}
              <span className="hero-pill">
                <Target size={14} /> Readiness {r.value}%
              </span>
            </div>
          </div>
          <Link className="btn lg" to="/app/practice/start/quick">
            <Sparkles size={16} /> Quick quiz
          </Link>
        </div>
      </div>

      {daysToExam !== null && daysToExam < 0 && !reported && me.role === 'student' && (
        <div className="callout warning row wrap between">
          <span>
            <strong>Your exam date has passed.</strong> How did it go? Your teacher confirms the result for the school's pass rate.
          </span>
          <Link className="btn sm" to="/app/progress#result">
            Report my result
          </Link>
        </div>
      )}

      <div className="grid g-side">
        <div className="stack lg">
          <div className="card">
            <div className="row wrap" style={{ gap: 24 }}>
              <Ring value={r.value} tone={r.tone} label={t('readiness')} size={140} />
              <div className="grow stack sm" style={{ minWidth: 220 }}>
                <div className="row wrap">
                  <h2 style={{ margin: 0 }}>{readinessLabel(r.label, t.lang)}</h2>
                  <Badge tone={r.tone}>{r.value}% chance of passing today</Badge>
                </div>
                <p className="small muted" style={{ margin: 0 }}>
                  Weighted topic mastery {r.weighted}%{r.mockAvg !== null ? ` · last mocks avg ${r.mockAvg}%` : ' · no mock yet'}. Exam-ready needs 80%+, 2 passed mocks, every topic attempted and every lesson watched or read.
                </p>
                <div className="row wrap small">
                  <span className="badge">{r.mocksPassed}/2 mocks passed</span>
                  <span className="badge">
                    {r.topicsAttempted}/{r.topicsTotal} topics
                  </span>
                  <span className="badge">
                    {r.lessonsViewed}/{r.lessonsTotal} lessons
                  </span>
                </div>
                <Link to="/app/progress" className="small">
                  See full progress →
                </Link>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>{t('todayPlan')}</h2>
              <span className="small faint">Updated each morning</span>
            </div>
            <div className="stack sm">
              {plan.map((p) => (
                <Link key={p.kind + p.title} to={p.to} className={`plan-item ${p.done ? 'done' : ''}`}>
                  <span className="plan-icon" style={{ background: `var(--${planColor[p.kind]}-soft)`, color: `var(--${planColor[p.kind] === 'primary' ? 'primary-text' : planColor[p.kind]})` }}>
                    {planIcon[p.kind]}
                  </span>
                  <span className="grow">
                    <strong>{p.title}</strong>
                    <span className="small muted" style={{ display: 'block' }}>
                      {p.detail}
                    </span>
                  </span>
                  {p.done ? <CheckCircle2 color="var(--success)" size={20} /> : <span className="btn sm">{t('start')}</span>}
                </Link>
              ))}
            </div>
          </div>

          <div className="card" id="tip" style={{ borderLeft: '4px solid var(--accent)' }}>
            <div className="card-head">
              <h2>
                <Lightbulb size={18} color="var(--accent)" /> {t('tip')} — Inama y'uyu munsi
              </h2>
            </div>
            <p style={{ fontWeight: 500 }}>{tip.rw}</p>
            {me.language !== 'rw' && <p className="muted small" style={{ margin: 0 }}>{me.language === 'fr' ? tip.fr : tip.en}</p>}
          </div>
        </div>

        <div className="stack lg">
          <div className="card">
            <div className="card-head">
              <h3>{t('weakest')}</h3>
            </div>
            <div className="stack">
              {r.weakest.map((w) => {
                const topic = s.topics.find((x) => x.id === w.topicId)!
                return (
                  <div key={w.topicId} className="row">
                    <RoadSign kind={topic.icon as SignKind} size={34} />
                    <div className="grow">
                      <div className="small bold ellipsis">{topic.title}</div>
                      <Bar value={w.value} tone={masteryTone(w.value)} thin />
                    </div>
                    <Link className="btn sm" to={hasExamPass(me) ? `/app/practice/start/weak_drill?topic=${w.topicId}` : `/app/learn/topic/${w.topicId}`}>
                      {hasExamPass(me) ? 'Drill' : 'Learn'}
                    </Link>
                  </div>
                )
              })}
            </div>
          </div>

          {me.role === 'student' && (openTests.length > 0 || openAssign.length > 0) && (
            <div className="card">
              <div className="card-head">
                <h3>
                  <ClipboardList size={17} /> {t('assignments')}
                </h3>
                <Link to="/app/assignments" className="small">
                  All
                </Link>
              </div>
              <div className="list">
                {openTests.map((x) => (
                  <Link key={x.id} to="/app/assignments" className="list-item">
                    <CalendarClock size={16} className="faint" />
                    <span className="grow small">
                      <strong>{x.title}</strong>
                      <span className="faint" style={{ display: 'block' }}>
                        {x.kind} · closes {fmtDate(x.closesAt)}
                      </span>
                    </span>
                  </Link>
                ))}
                {openAssign.map((a) => (
                  <Link key={a.id} to="/app/assignments" className="list-item">
                    <CalendarClock size={16} className="faint" />
                    <span className="grow small">
                      <strong>{a.note}</strong>
                      <span className="faint" style={{ display: 'block' }}>
                        due {fmtDate(a.dueAt)}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {me.role === 'individual' && !hasExamPass(me) && (
            <div className="card" style={{ background: 'var(--primary-soft)', borderColor: 'transparent' }}>
              <h3>Unlock everything with the Exam Pass</h3>
              <p className="small muted">All lessons, notes, unlimited mocks and weak-topic drills for {s.pricing.examPassDays} days.</p>
              <Link className="btn primary block" to="/app/plans">
                See Exam Pass
              </Link>
            </div>
          )}
          {me.role === 'individual' && (
            <div className="card">
              <h3>
                <School size={17} /> Ready for a school?
              </h3>
              <p className="small muted">
                {r.value >= 70
                  ? `You're at ${r.value}% — great time to join a partner school for your certificate and practical lessons.`
                  : 'When you need a certificate or practical lessons, partner schools near you can take over — your study history moves with you.'}
              </p>
              <Link className="btn block" to="/app/schools">
                Find a school
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
