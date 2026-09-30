import { BookOpenCheck, Clock, Lock, Repeat, Sparkles, Target, Timer } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Badge, Empty, PageHead, useToast } from '../../components/ui'
import { modeLocked } from '../../lib/access'
import { dueReviews, MOCK_LENGTH, MOCK_MINUTES, modeInfo, PASS_MARK, readiness } from '../../lib/engine'
import { useT } from '../../lib/i18n'
import { fmtDateTime } from '../../lib/util'
import { startAttempt } from '../../store/actions'
import { getState, useAppState, useMe } from '../../store/store'
import type { PracticeMode } from '../../types'

const icons: Partial<Record<PracticeMode, React.ReactNode>> = {
  lesson_check: <BookOpenCheck />,
  topic: <Target />,
  weak_drill: <Repeat />,
  quick: <Sparkles />,
  mock: <Timer />,
}

function Card({ mode, children, to }: { mode: PracticeMode; children?: React.ReactNode; to: string }) {
  const s = useAppState()
  const me = useMe()
  const t = useT()
  const navigate = useNavigate()
  const info = modeInfo[mode]
  const lock = modeLocked(s, me, mode)
  return (
    <div className="card stack sm">
      <div className="row">
        <span className="plan-icon" style={{ background: 'var(--primary-soft)', color: 'var(--primary-text)' }}>
          {icons[mode]}
        </span>
        <div className="grow">
          <h3 style={{ margin: 0 }}>{info.label}</h3>
          <span className="small muted">{info.purpose}</span>
        </div>
      </div>
      <div className="row wrap small">
        <Badge>{info.length}</Badge>
        <Badge>{info.timer ? 'Timed' : 'No timer'}</Badge>
        <Badge>{info.explanations === 'each' ? 'Explanation after each question' : 'Explanations after submission'}</Badge>
      </div>
      {children}
      {lock ? (
        <Link to="/app/plans" className="btn">
          <Lock size={14} /> {lock}
        </Link>
      ) : (
        <button className="btn primary" onClick={() => navigate(to)}>
          {t('start')}
        </button>
      )}
    </div>
  )
}

export default function Practice() {
  const s = useAppState()
  const me = useMe()
  const t = useT()
  const navigate = useNavigate()
  const [topic, setTopic] = useState(s.topics[0].id)
  const r = readiness(s, me.id)
  const due = dueReviews(s, me.id)
  const history = s.attempts.filter((a) => a.userId === me.id && a.submittedAt).sort((a, b) => b.submittedAt!.localeCompare(a.submittedAt!))
  const mocks = history.filter((a) => a.mode === 'mock')

  return (
    <div>
      <PageHead title={t('practice')} sub="Questions are written as real road scenarios. Mock exams mirror the official computer-based test." />
      {due.length > 0 && (
        <div className="callout info row between wrap mb">
          <span>
            <Repeat size={15} /> <strong>{due.length} missed question{due.length > 1 ? 's' : ''} due for review</strong> — spaced repetition brings them back after 1, 3, 7 and 14 days until you get them right twice in a row.
          </span>
          <Link className="btn sm" to="/app/practice/start/quick?review=1">
            Review now
          </Link>
        </div>
      )}
      <div className="grid g3">
        <Card mode="mock" to="/app/practice/start/mock">
          <p className="small muted" style={{ margin: 0 }}>
            {MOCK_LENGTH} random questions with the real exam's topic mix · {MOCK_MINUTES} minutes · pass mark {PASS_MARK}% (Busanza centre, per Irembo — confirm current rule). No going back, no pause.
          </p>
        </Card>
        <Card mode="quick" to="/app/practice/start/quick">
          <p className="small muted" style={{ margin: 0 }}>
            Your daily habit: review due questions first, then your weakest topics.
          </p>
        </Card>
        <Card mode="weak_drill" to={`/app/practice/start/weak_drill?topic=${r.weakest[0]?.topicId}`}>
          <p className="small muted" style={{ margin: 0 }}>
            The engine picked <strong>{s.topics.find((x) => x.id === r.weakest[0]?.topicId)?.title}</strong> ({r.weakest[0]?.value}% mastery).
          </p>
        </Card>
        <Card mode="topic" to={`/app/practice/start/topic?topic=${topic}`}>
          <select className="input" value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Topic">
            {s.topics.map((x) => (
              <option key={x.id} value={x.id}>
                {x.title} — {Math.round(s.mastery[me.id]?.[x.id] ?? 0)}%
              </option>
            ))}
          </select>
        </Card>
        <div className="card stack sm">
          <div className="row">
            <span className="plan-icon" style={{ background: 'var(--primary-soft)', color: 'var(--primary-text)' }}>
              <BookOpenCheck />
            </span>
            <div>
              <h3 style={{ margin: 0 }}>Lesson check</h3>
              <span className="small muted">3–5 questions at the end of each lesson</span>
            </div>
          </div>
          <Link to="/app/learn" className="btn">
            Go to lessons
          </Link>
        </div>
        {me.role === 'student' && (
          <div className="card stack sm">
            <div className="row">
              <span className="plan-icon" style={{ background: 'var(--primary-soft)', color: 'var(--primary-text)' }}>
                <Clock />
              </span>
              <div>
                <h3 style={{ margin: 0 }}>Teacher tests & exams</h3>
                <span className="small muted">Set by your teacher, with the teacher's rules</span>
              </div>
            </div>
            <Link to="/app/assignments" className="btn">
              Open
            </Link>
          </div>
        )}
      </div>

      <div className="card mt">
        <div className="card-head">
          <h2>History</h2>
          <span className="small muted">
            {mocks.length} mock{mocks.length === 1 ? '' : 's'} · {mocks.filter((m) => m.passed).length} passed
          </span>
        </div>
        {history.length === 0 ? (
          <Empty title="No attempts yet">Start with a quick quiz.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Mode</th>
                  <th>Score</th>
                  <th>Result</th>
                  <th>Channel</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 15).map((a) => (
                  <tr key={a.id} className="click" onClick={() => navigate(`/app/results/${a.id}`)}>
                    <td className="nowrap">{fmtDateTime(a.submittedAt)}</td>
                    <td>{a.title}</td>
                    <td className="num">{a.score}%</td>
                    <td>{a.mode === 'mock' || a.examMode ? <Badge tone={a.passed ? 'success' : 'danger'}>{a.passed ? 'Pass' : 'Fail'}</Badge> : <Badge>{a.questionIds.length} q</Badge>}</td>
                    <td className="small muted">{a.channel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/** Creates the attempt once, then replaces the URL with the runner. */
export function StartAttempt() {
  const { mode } = useParams() as { mode: PracticeMode }
  const [params] = useSearchParams()
  const s = useAppState()
  const me = useMe()
  const navigate = useNavigate()
  const toast = useToast()
  const done = useRef(false)
  const lock = modeLocked(s, me, mode)
  useEffect(() => {
    if (done.current || lock) return
    done.current = true
    const testId = params.get('test') ?? undefined
    const id = startAttempt(me.id, mode, { topicId: params.get('topic') ?? undefined, lessonId: params.get('lesson') ?? undefined, review: params.get('review') === '1', testId })
    const a = getState().attempts.find((x) => x.id === id)
    if (a && a.questionIds.length === 0) {
      toast('No questions available for this selection yet', 'error')
      navigate('/app/practice', { replace: true })
      return
    }
    navigate(`/app/exam/${id}`, { replace: true })
  }, [lock, me.id, mode, navigate, params, toast])
  if (lock) return <Navigate to="/app/plans" replace />
  return <div className="center muted" style={{ padding: 60 }}>Preparing your questions…</div>
}
