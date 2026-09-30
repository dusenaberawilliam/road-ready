import { CalendarClock, CheckCircle2, ClipboardList, FileCheck2, PlayCircle } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge, Empty, PageHead } from '../../components/ui'
import { lessonViewed } from '../../lib/engine'
import { fmtDateTime } from '../../lib/util'
import { completeAssignment } from '../../store/actions'
import { useAppState, useMe } from '../../store/store'

export default function Assignments() {
  const s = useAppState()
  const me = useMe()
  const navigate = useNavigate()
  const now = new Date()
  const tests = s.tests.filter((t) => t.cohortId === me.cohortId && t.status === 'published').sort((a, b) => a.closesAt.localeCompare(b.closesAt))
  const personal = s.assignments.filter((a) => a.userId === me.id)

  return (
    <div>
      <PageHead title="From my teacher" sub="Tests, exams and assignments set for your class." />
      <div className="stack lg">
        <div className="card">
          <div className="card-head">
            <h2>
              <FileCheck2 size={18} /> Tests & exams
            </h2>
          </div>
          {tests.filter((t) => t.kind !== 'assignment').length === 0 ? (
            <Empty title="No tests yet" />
          ) : (
            <div className="list">
              {tests
                .filter((t) => t.kind !== 'assignment')
                .map((t) => {
                  const attempts = s.attempts.filter((a) => a.testId === t.id && a.userId === me.id && a.submittedAt)
                  const open = new Date(t.opensAt) <= now && new Date(t.closesAt) > now
                  const upcoming = new Date(t.opensAt) > now
                  const left = t.attemptsAllowed - attempts.length
                  const best = attempts.length ? Math.max(...attempts.map((a) => a.score ?? 0)) : null
                  return (
                    <div key={t.id} className="list-item wrap" style={{ flexWrap: 'wrap' }}>
                      <div className="grow">
                        <div className="row wrap">
                          <strong>{t.title}</strong>
                          <Badge tone={t.kind === 'exam' ? 'danger' : 'info'}>{t.kind}</Badge>
                          {t.countsForCertificate && <Badge tone="primary">counts for certificate</Badge>}
                        </div>
                        <div className="small muted">
                          {t.questionIds.length} questions · {t.timeLimitMin ? `${t.timeLimitMin} min` : 'no timer'} · {t.attemptsAllowed} attempt{t.attemptsAllowed > 1 ? 's' : ''} ·{' '}
                          {upcoming ? `opens ${fmtDateTime(t.opensAt)}` : `closes ${fmtDateTime(t.closesAt)}`}
                          {t.kind === 'exam' && ' · exam mode: shuffled, no going back, auto-submit'}
                        </div>
                      </div>
                      {best !== null && (
                        <button className="btn sm ghost" onClick={() => navigate(`/app/results/${attempts[attempts.length - 1].id}`)}>
                          Best {best}%
                        </button>
                      )}
                      {open && left > 0 ? (
                        <Link className="btn primary sm" to={`/app/practice/start/teacher?test=${t.id}`}>
                          {attempts.length ? 'Retake' : 'Start'} ({left} left)
                        </Link>
                      ) : (
                        <Badge tone={left <= 0 ? 'success' : undefined}>{left <= 0 ? 'Completed' : upcoming ? 'Not open yet' : 'Closed'}</Badge>
                      )}
                    </div>
                  )
                })}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <h2>
              <ClipboardList size={18} /> Assignments
            </h2>
          </div>
          {tests.filter((t) => t.kind === 'assignment').length + personal.length === 0 ? (
            <Empty title="No assignments" />
          ) : (
            <div className="stack">
              {tests
                .filter((t) => t.kind === 'assignment')
                .map((t) => {
                  const done = t.lessonIds.filter((id) => lessonViewed(s, me.id, id)).length
                  return (
                    <div key={t.id} className="card flat">
                      <div className="row between wrap">
                        <strong>{t.title}</strong>
                        <span className="small muted">
                          <CalendarClock size={13} /> due {fmtDateTime(t.closesAt)}
                        </span>
                      </div>
                      <div className="list mt">
                        {t.lessonIds.map((id) => {
                          const l = s.lessons.find((x) => x.id === id)
                          if (!l) return null
                          return (
                            <Link key={id} to={`/app/learn/lesson/${id}`} className="list-item">
                              {lessonViewed(s, me.id, id) ? <CheckCircle2 size={17} color="var(--success)" /> : <PlayCircle size={17} className="faint" />}
                              <span className="grow small">{l.title}</span>
                            </Link>
                          )
                        })}
                      </div>
                      <div className="row between mt">
                        <span className="small muted">
                          {done}/{t.lessonIds.length} lessons done
                        </span>
                        <Link className="btn sm" to={`/app/practice/start/topic?topic=${s.lessons.find((l) => l.id === t.lessonIds[0])?.topicId}`}>
                          Topic drill
                        </Link>
                      </div>
                    </div>
                  )
                })}
              {personal.map((a) => (
                <div key={a.id} className="card flat">
                  <div className="row between wrap">
                    <div>
                      <strong>{a.note}</strong>
                      <div className="small muted">
                        From {s.users.find((u) => u.id === a.assignedBy)?.name} · due {fmtDateTime(a.dueAt)}
                      </div>
                    </div>
                    {a.done ? (
                      <Badge tone="success">Done</Badge>
                    ) : (
                      <button className="btn sm" onClick={() => completeAssignment(a.id)}>
                        Mark done
                      </button>
                    )}
                  </div>
                  <div className="row wrap mt">
                    {a.lessonIds.map((id) => (
                      <Link key={id} className="chip" to={`/app/learn/lesson/${id}`}>
                        {lessonViewed(s, me.id, id) ? '✓ ' : ''}
                        {s.lessons.find((l) => l.id === id)?.title}
                      </Link>
                    ))}
                    {a.testId && (
                      <Link className="chip on" to={`/app/practice/start/weak_drill?topic=${a.testId}`}>
                        Drill: {s.topics.find((t) => t.id === a.testId)?.title}
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
