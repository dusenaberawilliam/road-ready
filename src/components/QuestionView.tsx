import { CheckCircle2, Flag, PlayCircle, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { isCorrect } from '../lib/engine'
import { reportContent } from '../store/actions'
import type { Lesson, Question } from '../types'
import RoadSign from './RoadSign'
import Scene from './Scene'
import { Badge, Modal, useToast } from './ui'

const typeLabel: Record<Question['type'], string> = {
  single: 'Single choice',
  truefalse: 'True / false',
  multi: 'Multiple correct answers',
  hotspot: 'Image hotspot · practice only',
  clip: 'Scenario clip · practice only',
}

export function QuestionMedia({ q }: { q: Question }) {
  const [replay, setReplay] = useState(0)
  if (q.sign && !q.scene)
    return (
      <div className="row" style={{ justifyContent: 'center', padding: 8 }}>
        <RoadSign kind={q.sign} size={120} title="Road sign in question" />
      </div>
    )
  if (q.scene)
    return (
      <div className="player" style={{ maxWidth: 520 }}>
        <div className={`player-stage ${q.type === 'clip' ? '' : 'paused'}`} key={replay}>
          <Scene kind={q.scene} sign={q.sign} animate={q.type === 'clip'} />
          {q.type === 'clip' && (
            <button className="btn sm" style={{ position: 'absolute', bottom: 8, right: 8 }} onClick={() => setReplay((r) => r + 1)}>
              <PlayCircle size={14} /> Replay clip
            </button>
          )}
        </div>
      </div>
    )
  return null
}

export default function QuestionView({
  q,
  index,
  total,
  selected,
  onSelect,
  reveal,
  lesson,
  userId,
}: {
  q: Question
  index?: number
  total?: number
  selected: number[]
  onSelect: (ans: number[]) => void
  reveal: boolean
  lesson?: Lesson
  userId?: string
}) {
  const [reporting, setReporting] = useState(false)
  const [reason, setReason] = useState('')
  const toast = useToast()
  const multi = q.type === 'multi'
  const ok = isCorrect(q, selected)

  const toggle = (i: number) => {
    if (reveal) return
    if (multi) onSelect(selected.includes(i) ? selected.filter((x) => x !== i) : [...selected, i].sort())
    else onSelect([i])
  }

  return (
    <div className="stack">
      <div className="row between wrap">
        <span className="small faint">
          {index !== undefined && total ? `Question ${index + 1} of ${total} · ` : ''}
          {typeLabel[q.type]}
        </span>
        {q.schoolId && <Badge tone="info">School question</Badge>}
      </div>
      <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>{q.prompt}</h2>
      <QuestionMedia q={q} />
      {multi && !reveal && <p className="small muted" style={{ margin: 0 }}>Select all answers that apply.</p>}
      <div className="options" role={multi ? 'group' : 'radiogroup'}>
        {q.options.map((o, i) => {
          const isSel = selected.includes(i)
          const cls = reveal ? (q.correct.includes(i) ? 'correct' : isSel ? 'wrong' : '') : isSel ? 'selected' : ''
          return (
            <button key={i} className={`option ${cls}`} onClick={() => toggle(i)} disabled={reveal} role={multi ? 'checkbox' : 'radio'} aria-checked={isSel}>
              <span className="key">{String.fromCharCode(65 + i)}</span>
              <span className="grow">{o}</span>
              {reveal && q.correct.includes(i) && <CheckCircle2 size={18} color="var(--success)" />}
              {reveal && isSel && !q.correct.includes(i) && <XCircle size={18} color="var(--danger)" />}
            </button>
          )
        })}
      </div>
      {reveal && (
        <div className={`callout ${ok ? 'success' : 'danger'}`}>
          <div className="row" style={{ marginBottom: 6 }}>
            {ok ? <CheckCircle2 size={18} color="var(--success)" /> : <XCircle size={18} color="var(--danger)" />}
            <strong>{ok ? 'Correct' : selected.length ? 'Not quite' : 'Not answered'}</strong>
          </div>
          <p style={{ marginBottom: 6 }}>
            <strong>Why the right answer is right:</strong> {q.explanation}
          </p>
          {!ok && selected.length > 0 && (
            <p style={{ marginBottom: 6 }}>
              <strong>Why "{q.options[selected[0]]}" is wrong:</strong>{' '}
              {q.wrongWhy ?? 'It does not match the rule that applies in this road situation — re-read the rule and the common trap.'}
            </p>
          )}
          <div className="row wrap" style={{ marginTop: 8 }}>
            {lesson && (
              <Link className="btn sm" to={`/app/learn/lesson/${lesson.id}?t=${Math.round((lesson.durationSec / 8) * 2)}`}>
                <PlayCircle size={14} /> Watch the explanation
              </Link>
            )}
            {userId && (
              <button className="btn sm ghost" onClick={() => setReporting(true)}>
                <Flag size={14} /> Report a problem
              </button>
            )}
          </div>
        </div>
      )}
      {reporting && userId && (
        <Modal
          title="Report a problem with this question"
          onClose={() => setReporting(false)}
          footer={
            <>
              <button className="btn" onClick={() => setReporting(false)}>
                Cancel
              </button>
              <button
                className="btn primary"
                disabled={reason.trim().length < 5}
                onClick={() => {
                  reportContent(userId, 'question', q.id, reason)
                  setReporting(false)
                  setReason('')
                  toast('Thanks — sent to the content team')
                }}
              >
                Send report
              </button>
            </>
          }
        >
          <div className="stack">
            <p className="muted small">"{q.prompt}"</p>
            <div className="row wrap">
              {['Wrong answer marked correct', 'Unclear wording', 'Outdated after law change', 'Translation problem'].map((r) => (
                <button key={r} className={`chip ${reason === r ? 'on' : ''}`} onClick={() => setReason(r)}>
                  {r}
                </button>
              ))}
            </div>
            <textarea className="input" placeholder="Describe the problem…" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </Modal>
      )}
    </div>
  )
}
