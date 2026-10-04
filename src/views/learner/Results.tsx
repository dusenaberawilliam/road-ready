import { CheckCircle2, Clock, Home, PlayCircle, RotateCcw, Target, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import QuestionView from '../../components/QuestionView'
import { Badge, Bar, Empty, masteryTone, PageHead, Ring, Seg } from '../../components/ui'
import { isCorrect, PASS_MARK, readiness } from '../../lib/engine'
import { fmtDateTime, fmtTime } from '../../lib/util'
import { useAppState, useMe } from '../../store/store'

export default function Results() {
  const { attemptId } = useParams()
  const s = useAppState()
  const me = useMe()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<'wrong' | 'all'>('wrong')
  const a = s.attempts.find((x) => x.id === attemptId)
  if (!a || !a.submittedAt) return <Empty title="Result not found" />
  const own = a.userId === me.id
  const test = a.testId ? s.tests.find((t) => t.id === a.testId) : undefined
  const hideAnswers = test && ((test.showAnswers === 'after_close' && new Date(test.closesAt) > new Date()) || test.showAnswers === 'never') && own
  const used = (new Date(a.submittedAt).getTime() - new Date(a.startedAt).getTime()) / 1000
  const correct = a.questionIds.filter((id) => isCorrect(s.questions.find((q) => q.id === id)!, a.answers[id])).length
  const r = readiness(s, a.userId)
  const isExam = a.mode === 'mock' || a.examMode
  const shown = a.questionIds.filter((id) => filter === 'all' || !isCorrect(s.questions.find((q) => q.id === id)!, a.answers[id]))
  const weakestHere = Object.entries(a.perTopic ?? {}).sort((x, y) => x[1].correct / x[1].total - y[1].correct / y[1].total)[0]
  const retry = a.mode === 'lesson_check' ? `/app/practice/start/lesson_check?lesson=${a.lessonId}` : a.mode === 'topic' || a.mode === 'weak_drill' ? `/app/practice/start/${a.mode}?topic=${a.topicId}` : a.testId ? null : `/app/practice/start/${a.mode}`

  return (
    <div>
      <PageHead
        crumbs={own ? [{ to: '/app/practice', label: 'Practice & exams' }] : [{ to: '/app/teacher', label: 'Class overview' }]}
        title={a.mode === 'diagnostic' ? 'Your starting point' : a.title}
        sub={`${fmtDateTime(a.submittedAt)} · ${a.channel}${a.appSwitches ? ` · app switched ${a.appSwitches}×` : ''}`}
      />
      <div className="grid g-side">
        <div className="card">
          <div className="row wrap" style={{ gap: 28 }}>
            <Ring value={a.score ?? 0} tone={isExam ? (a.passed ? 'success' : 'danger') : masteryTone(a.score ?? 0)} label="score" size={150} />
            <div className="stack sm grow">
              {isExam ? (
                <div className="row">
                  {a.passed ? <CheckCircle2 color="var(--success)" /> : <XCircle color="var(--danger)" />}
                  <h2 style={{ margin: 0, color: a.passed ? 'var(--success)' : 'var(--danger)' }}>{a.passed ? 'Pass' : 'Not passed yet'}</h2>
                  <Badge>pass mark {PASS_MARK}%</Badge>
                </div>
              ) : a.mode === 'diagnostic' ? (
                <h2 style={{ margin: 0 }}>Your first readiness score is {r.value}%</h2>
              ) : (
                <h2 style={{ margin: 0 }}>
                  {correct} of {a.questionIds.length} correct
                </h2>
              )}
              <div className="row wrap small muted">
                <span>
                  <Clock size={14} /> Time used {fmtTime(used)}
                  {a.timeLimitSec ? ` of ${fmtTime(a.timeLimitSec)}` : ''}
                </span>
                <span>
                  {correct}/{a.questionIds.length} correct
                </span>
              </div>
              {own && (
                <p className="small" style={{ margin: 0 }}>
                  Readiness now <strong>{r.value}%</strong> ({r.label}).{' '}
                  {a.mode === 'diagnostic' ? 'Your personal study plan is ready on the home page.' : ''}
                </p>
              )}
              {own && (
                <div className="row wrap mt">
                  {retry && (
                    <button className="btn" onClick={() => navigate(retry)}>
                      <RotateCcw size={15} /> {a.mode === 'mock' ? 'New mock' : 'Try again'}
                    </button>
                  )}
                  {weakestHere && weakestHere[1].correct < weakestHere[1].total && (
                    <Link className="btn" to={`/app/practice/start/weak_drill?topic=${weakestHere[0]}`}>
                      <Target size={15} /> Drill {s.topics.find((t) => t.id === weakestHere[0])?.title.split('—')[0]}
                    </Link>
                  )}
                  {a.lessonId && (
                    <Link className="btn" to={`/app/learn/lesson/${a.lessonId}`}>
                      <PlayCircle size={15} /> Back to lesson
                    </Link>
                  )}
                  <Link className="btn primary" to="/app/home">
                    <Home size={15} /> Home
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="card">
          <h3>Score by topic</h3>
          <div className="stack sm">
            {Object.entries(a.perTopic ?? {}).map(([tid, v]) => {
              const p = Math.round((v.correct / v.total) * 100)
              return (
                <div key={tid}>
                  <div className="row between small">
                    <span className="ellipsis">{s.topics.find((t) => t.id === tid)?.title}</span>
                    <span className="num">
                      {v.correct}/{v.total}
                    </span>
                  </div>
                  <Bar value={p} tone={masteryTone(p)} thin />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="card mt">
        <div className="card-head">
          <h2>Review</h2>
          {!hideAnswers && (
            <Seg
              options={[
                { id: 'wrong', label: `Wrong answers (${a.questionIds.length - correct})` },
                { id: 'all', label: 'All questions' },
              ]}
              value={filter}
              onChange={setFilter}
            />
          )}
        </div>
        {hideAnswers ? (
          <p className="muted">Your teacher will release the answers after the {test?.kind} closes on {fmtDateTime(test?.closesAt)}.</p>
        ) : shown.length === 0 ? (
          <Empty title="Nothing wrong — well done!" icon={<CheckCircle2 />} />
        ) : (
          <div className="stack lg">
            {shown.map((id) => {
              const q = s.questions.find((x) => x.id === id)!
              return (
                <div key={id} style={{ borderTop: '1px solid var(--border)', paddingTop: 18 }}>
                  <QuestionView q={q} index={a.questionIds.indexOf(id)} total={a.questionIds.length} selected={a.answers[id] ?? []} onSelect={() => {}} reveal lesson={s.lessons.find((l) => l.id === q.lessonId)} userId={own ? me.id : undefined} />
                  {a.confidence[id] && <p className="small faint mt">You marked this as “{a.confidence[id] === 'sure' ? "I'm sure" : 'I guessed'}”.</p>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
