import { CheckCircle2, MessageCircle, ShieldCheck } from 'lucide-react'
import { Badge, Bar, Empty, masteryTone, PageHead, Ring, Stat, useToast } from '../../components/ui'
import { readiness } from '../../lib/engine'
import { DAY, fmtDate, fmtDateTime, isoDay } from '../../lib/util'
import { setConsent } from '../../store/actions'
import { useAppState, useMe } from '../../store/store'
import { StudyCalendar } from '../learner/Progress'

export default function Guardian() {
  const s = useAppState()
  const me = useMe()
  const toast = useToast()
  const children = s.users.filter((u) => me.childIds?.includes(u.id))
  if (!children.length) return <Empty title="No linked learners">When a learner aged 16–17 enters your phone number, their consent request appears here.</Empty>
  return (
    <div>
      <PageHead title="My child" sub="You gave consent for these learners. You see progress only — never their notes or messages." />
      <div className="stack lg">
        {children.map((c) => {
          const r = readiness(s, c.id)
          const week = Array.from({ length: 7 }, (_, i) => isoDay(new Date(Date.now() - i * DAY)))
          const daysThisWeek = (s.studyDays[c.id] ?? []).filter((d) => week.includes(d)).length
          const mocks = s.attempts.filter((a) => a.userId === c.id && a.mode === 'mock' && a.submittedAt).slice(-3).reverse()
          const school = s.schools.find((x) => x.id === c.schoolId)
          return (
            <div key={c.id} className="stack lg">
              {c.consent === 'pending' && (
                <div className="card" style={{ borderColor: 'var(--accent)', borderWidth: 2 }}>
                  <h2>
                    <ShieldCheck size={20} /> Consent requested by {c.name}
                  </h2>
                  <p className="muted">
                    {c.name} ({fmtDate(c.dob)}) wants to use RoadReady{school ? ` with ${school.name}` : ''} to prepare for the provisional theory exam. Their data is protected under Law n° 058/2021; discussions are moderated by teachers and there are no private messages.
                  </p>
                  <div className="row">
                    <button className="btn primary" onClick={() => (setConsent(c.id, true), toast(`Consent given for ${c.name}`))}>
                      <CheckCircle2 size={16} /> I give consent
                    </button>
                    <button className="btn" onClick={() => (setConsent(c.id, false), toast('Consent declined', 'info'))}>
                      Decline
                    </button>
                  </div>
                </div>
              )}
              <div className="card">
                <div className="row wrap between">
                  <div>
                    <h2 style={{ margin: 0 }}>{c.name}</h2>
                    <div className="small muted">
                      {school?.name ?? 'Individual learner'} · exam {c.examDate ? fmtDate(c.examDate) : 'not set'}
                    </div>
                  </div>
                  <Badge tone={c.consent === 'granted' ? 'success' : 'warning'}>{c.consent === 'granted' ? 'Consent given' : 'Consent pending'}</Badge>
                </div>
                <div className="grid g4 mt">
                  <div className="center">
                    <Ring value={r.value} tone={r.tone} label={r.label} size={120} />
                  </div>
                  <Stat label="Study days this week" value={`${daysThisWeek}/7`} />
                  <Stat label="Mocks passed" value={r.mocksPassed} delta="2 needed to be exam-ready" />
                  <Stat label="Lessons viewed" value={`${r.lessonsViewed}/${r.lessonsTotal}`} />
                </div>
              </div>
              <div className="grid g2">
                <div className="card">
                  <h3>Weakest topics</h3>
                  {r.weakest.map((w) => (
                    <div key={w.topicId} className="mb">
                      <div className="row between small">
                        <span>{s.topics.find((t) => t.id === w.topicId)?.title}</span>
                        <span>{w.value}%</span>
                      </div>
                      <Bar value={w.value} tone={masteryTone(w.value)} thin />
                    </div>
                  ))}
                  <h3 className="mt">Recent mocks</h3>
                  {mocks.length === 0 ? (
                    <p className="small muted">No mock exam yet.</p>
                  ) : (
                    mocks.map((a) => (
                      <div key={a.id} className="row between small">
                        <span>{fmtDateTime(a.submittedAt)}</span>
                        <Badge tone={a.passed ? 'success' : 'danger'}>{a.score}%</Badge>
                      </div>
                    ))
                  )}
                </div>
                <div className="card">
                  <h3>Study activity</h3>
                  <StudyCalendar userId={c.id} />
                  <div className="callout small mt">
                    <MessageCircle size={14} /> Every Sunday you receive this summary on WhatsApp.
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
