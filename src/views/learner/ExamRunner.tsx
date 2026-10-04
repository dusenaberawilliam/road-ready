import { AlertTriangle, ArrowLeft, ArrowRight, Flag, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import QuestionView from '../../components/QuestionView'
import { Modal, useToast } from '../../components/ui'
import { modeInfo } from '../../lib/engine'
import { useT } from '../../lib/i18n'
import { fmtTime } from '../../lib/util'
import { checkAnswer, logAppSwitch, setAnswer, setConfidence, submitAttempt } from '../../store/actions'
import { useAppState, useMe } from '../../store/store'

export default function ExamRunner() {
  const { attemptId } = useParams()
  const s = useAppState()
  const me = useMe()
  const t = useT()
  const navigate = useNavigate()
  const toast = useToast()
  const a = s.attempts.find((x) => x.id === attemptId && x.userId === me.id)
  const [idx, setIdx] = useState(() => (a ? Math.max(0, a.questionIds.findIndex((q) => !a.answers[q])) : 0))
  const [confirm, setConfirm] = useState(false)
  const [quit, setQuit] = useState(false)
  const [now, setNow] = useState(Date.now())
  const submitted = useRef(false)

  const submit = useCallback(
    (auto = false) => {
      if (!a || submitted.current) return
      submitted.current = true
      submitAttempt(a.id)
      if (auto) toast('Time is up — your exam was submitted automatically', 'info')
      navigate(`/app/results/${a.id}`, { replace: true })
    },
    [a, navigate, toast],
  )

  const remaining = a?.timeLimitSec ? a.timeLimitSec - (now - new Date(a.startedAt).getTime()) / 1000 : null

  useEffect(() => {
    if (!a?.timeLimitSec || a.submittedAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [a?.timeLimitSec, a?.submittedAt])

  useEffect(() => {
    if (remaining !== null && remaining <= 0) submit(true)
  }, [remaining, submit])

  // Anti-cheat: app switching is logged during exams (§6)
  useEffect(() => {
    if (!a?.examMode || a.submittedAt) return
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        logAppSwitch(a.id)
        toast('Leaving the exam screen is logged', 'error')
      }
    }
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [a?.examMode, a?.id, a?.submittedAt, toast])

  if (!a) return <Navigate to="/app/practice" replace />
  if (a.submittedAt) return <Navigate to={`/app/results/${a.id}`} replace />

  const qid = a.questionIds[idx]
  const q = s.questions.find((x) => x.id === qid)!
  const selected = a.answers[qid] ?? []
  const each = a.showExplanations === 'each'
  const revealed = each && !!a.checked?.includes(qid)
  const answered = a.questionIds.filter((id) => (a.answers[id] ?? []).length > 0).length
  const last = idx === a.questionIds.length - 1
  const lesson = s.lessons.find((l) => l.id === q.lessonId)
  const low = remaining !== null && remaining < 120

  return (
    <div className="exam-focus">
      <header className="exam-head">
        <button className="btn ghost icon" onClick={() => setQuit(true)} aria-label="Leave">
          <X size={20} />
        </button>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="bold ellipsis">{a.title}</div>
          <div className="tiny faint">
            {modeInfo[a.mode].label}
            {a.examMode ? ' · exam mode: no going back, no pausing' : ''}
          </div>
        </div>
        {remaining !== null && (
          <div className={`timer ${low ? 'low' : ''}`} aria-live="polite">
            {fmtTime(remaining)}
          </div>
        )}
      </header>
      <div className="exam-body">
        <div className="bar thin" style={{ marginBottom: 18 }}>
          <span style={{ width: `${((idx + (revealed || !each ? 1 : 0)) / a.questionIds.length) * 100}%` }} />
        </div>
        <QuestionView
          q={q}
          index={idx}
          total={a.questionIds.length}
          selected={selected}
          onSelect={(ans) => setAnswer(a.id, qid, ans)}
          reveal={revealed}
          lesson={lesson}
          userId={me.id}
        />
        {!revealed && selected.length > 0 && a.mode !== 'mock' && !a.examMode && (
          <div className="row small mt">
            <span className="muted">How sure are you?</span>
            {(['sure', 'guess'] as const).map((c) => (
              <button key={c} className={`chip ${a.confidence[qid] === c ? 'on' : ''}`} onClick={() => setConfidence(a.id, qid, c)}>
                {c === 'sure' ? "I'm sure" : 'I guessed'}
              </button>
            ))}
          </div>
        )}
        {a.examMode && (a.appSwitches ?? 0) > 0 && (
          <div className="callout danger small mt">
            <AlertTriangle size={14} /> App switching logged {a.appSwitches} time(s). Your teacher can see this.
          </div>
        )}
        <div className="row between mt" style={{ paddingBottom: 24 }}>
          {!a.examMode ? (
            <button className="btn" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
              <ArrowLeft size={16} /> {t('back')}
            </button>
          ) : (
            <span className="small faint">{answered}/{a.questionIds.length} answered</span>
          )}
          {each && !revealed ? (
            <button className="btn primary lg" disabled={!selected.length} onClick={() => checkAnswer(a.id, qid)}>
              {t('check')}
            </button>
          ) : last ? (
            <button className="btn primary lg" onClick={() => (each ? submit() : setConfirm(true))}>
              <Flag size={16} /> {each ? 'See results' : t('submit')}
            </button>
          ) : (
            <button className="btn primary lg" onClick={() => setIdx(idx + 1)}>
              {t('next')} <ArrowRight size={16} />
            </button>
          )}
        </div>
        {!a.examMode && a.questionIds.length > 1 && (
          <div className="qnav" aria-label="Questions">
            {a.questionIds.map((id, i) => {
              const done = (a.answers[id] ?? []).length > 0
              const checked = a.checked?.includes(id)
              const ok = checked && (() => {
                const qq = s.questions.find((x) => x.id === id)!
                return [...(a.answers[id] ?? [])].sort().join() === [...qq.correct].sort().join()
              })()
              return (
                <button key={id} className={`${i === idx ? 'current' : ''} ${checked ? (ok ? 'ok' : 'ko') : done ? 'answered' : ''}`} onClick={() => setIdx(i)}>
                  {i + 1}
                </button>
              )
            })}
          </div>
        )}
        {!each && !last && (
          <div className="row mt">
            <button className="btn ghost sm" onClick={() => setConfirm(true)}>
              Submit now
            </button>
          </div>
        )}
      </div>

      {confirm && (
        <Modal
          title="Submit your answers?"
          onClose={() => setConfirm(false)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirm(false)}>
                Keep going
              </button>
              <button className="btn primary" onClick={() => submit()}>
                Submit
              </button>
            </>
          }
        >
          <p>
            You answered <strong>{answered}</strong> of {a.questionIds.length} questions.
            {answered < a.questionIds.length && ' Unanswered questions count as wrong.'}
          </p>
          {remaining !== null && <p className="small muted">Time left: {fmtTime(remaining)}</p>}
        </Modal>
      )}
      {quit && (
        <Modal
          title={a.examMode ? 'Leave the exam?' : 'Leave this practice?'}
          onClose={() => setQuit(false)}
          footer={
            <>
              <button className="btn" onClick={() => setQuit(false)}>
                Stay
              </button>
              {a.examMode ? (
                <button className="btn danger" onClick={() => submit()}>
                  Submit and leave
                </button>
              ) : (
                <button className="btn danger" onClick={() => navigate(a.mode === 'lesson_check' && a.lessonId ? `/app/learn/lesson/${a.lessonId}` : '/app/practice')}>
                  Leave (progress kept)
                </button>
              )}
            </>
          }
        >
          {a.examMode ? <p>Like the real computer-based test, you cannot pause. Leaving now submits your answers.</p> : <p>Answers you already checked still count toward your mastery. You can come back from the Practice page.</p>}
        </Modal>
      )}
    </div>
  )
}
