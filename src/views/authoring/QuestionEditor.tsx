import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import QuestionView from '../../components/QuestionView'
import { signNames } from '../../components/RoadSign'
import { Field, Modal, Seg, useToast } from '../../components/ui'
import { uid } from '../../lib/util'
import { saveQuestion } from '../../store/actions'
import { useAppState, useMe } from '../../store/store'
import type { Question, QuestionType, SceneKind, SignKind } from '../../types'

const SCENES: SceneKind[] = ['roundabout', 'junction', 'zebra', 'bend', 'road', 'night', 'police', 'accident']

export default function QuestionEditor({ question, schoolId, lessonId, topicId, onClose, onSaved }: { question?: Question; schoolId: string | null; lessonId?: string; topicId?: string; onClose: () => void; onSaved?: (q: Question) => void }) {
  const s = useAppState()
  const me = useMe()
  const toast = useToast()
  const national = schoolId === null
  const [q, setQ] = useState<Question>(
    () =>
      question ?? {
        id: uid('q'),
        topicId: topicId ?? s.lessons.find((l) => l.id === lessonId)?.topicId ?? s.topics[0].id,
        lessonId,
        schoolId,
        type: 'single',
        prompt: '',
        options: ['', '', '', ''],
        correct: [0],
        explanation: '',
        difficulty: 2,
        status: national ? 'draft' : 'published',
        version: 1,
        stats: { attempts: 0, correct: 0 },
      },
  )
  const [preview, setPreview] = useState<number[]>([])
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  const setType = (type: QuestionType) => setQ({ ...q, type, options: type === 'truefalse' ? ['True', 'False'] : q.options.length < 2 || q.type === 'truefalse' ? ['', '', '', ''] : q.options, correct: type === 'multi' ? q.correct : [q.correct[0] ?? 0] })
  const errors: string[] = []
  if (q.prompt.trim().length < 10) errors.push('Write the question (10+ characters)')
  if (q.options.filter((o) => o.trim()).length < 2 || q.options.some((o) => !o.trim())) errors.push('Fill every answer option (at least 2)')
  if (!q.correct.length) errors.push('Mark the correct answer')
  if (q.explanation.trim().length < 10) errors.push('Explain why the right answer is right')
  const lessons = s.lessons.filter((l) => l.topicId === q.topicId && (l.schoolId === null || l.schoolId === me.schoolId))

  return (
    <Modal
      wide
      title={question ? 'Edit question' : 'New question'}
      onClose={onClose}
      footer={
        <>
          {errors.length > 0 && <span className="small" style={{ color: 'var(--danger)', marginRight: 'auto' }}>{errors[0]}</span>}
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={errors.length > 0}
            onClick={() => {
              saveQuestion(q, me.id)
              toast(question ? `Question updated${question.status === 'published' ? ` (version ${question.version + 1}; past results keep their version)` : ''}` : 'Question added')
              onSaved?.(q)
              onClose()
            }}
          >
            Save question
          </button>
        </>
      }
    >
      <Seg
        options={[
          { id: 'edit', label: 'Edit' },
          { id: 'preview', label: 'Preview' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="mt">
        {tab === 'preview' ? (
          <QuestionView q={q} selected={preview} onSelect={setPreview} reveal={preview.length > 0 && q.type !== 'multi'} />
        ) : (
          <div className="stack">
            <div className="grid g3">
              <Field label="Topic">
                <select className="input" value={q.topicId} onChange={(e) => setQ({ ...q, topicId: e.target.value, lessonId: undefined })}>
                  {s.topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Linked lesson" hint="Used for 'Watch the explanation'">
                <select className="input" value={q.lessonId ?? ''} onChange={(e) => setQ({ ...q, lessonId: e.target.value || undefined })}>
                  <option value="">None</option>
                  {lessons.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Difficulty">
                <Seg
                  options={[
                    { id: '1', label: 'Easy' },
                    { id: '2', label: 'Medium' },
                    { id: '3', label: 'Hard' },
                  ]}
                  value={String(q.difficulty) as '1' | '2' | '3'}
                  onChange={(v) => setQ({ ...q, difficulty: Number(v) as 1 | 2 | 3 })}
                />
              </Field>
            </div>
            <Field label="Question type">
              <Seg
                options={[
                  { id: 'single', label: 'Single choice' },
                  { id: 'truefalse', label: 'True/false' },
                  { id: 'multi', label: 'Multiple correct' },
                  { id: 'clip', label: 'Scenario clip' },
                  { id: 'hotspot', label: 'Image hotspot' },
                ]}
                value={q.type}
                onChange={setType}
              />
            </Field>
            <Field label="Question (written as a real road scenario)">
              <textarea className="input" value={q.prompt} onChange={(e) => setQ({ ...q, prompt: e.target.value })} placeholder="You are riding toward… What should you do?" />
            </Field>
            <div className="grid g2">
              <Field label="Road sign image (optional)">
                <select className="input" value={q.sign ?? ''} onChange={(e) => setQ({ ...q, sign: (e.target.value || undefined) as SignKind | undefined })}>
                  <option value="">None</option>
                  {Object.entries(signNames).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={q.type === 'clip' ? 'Scenario clip (5–10 s)' : 'Road scene image (optional)'}>
                <select className="input" value={q.scene ?? ''} onChange={(e) => setQ({ ...q, scene: (e.target.value || undefined) as SceneKind | undefined })}>
                  <option value="">None</option>
                  {SCENES.map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label={q.type === 'multi' ? 'Answers — tick every correct one' : 'Answers — select the correct one'}>
              <div className="stack sm">
                {q.options.map((o, i) => (
                  <div key={i} className="row">
                    <input
                      type={q.type === 'multi' ? 'checkbox' : 'radio'}
                      name="correct"
                      checked={q.correct.includes(i)}
                      onChange={(e) => setQ({ ...q, correct: q.type === 'multi' ? (e.target.checked ? [...q.correct, i].sort() : q.correct.filter((x) => x !== i)) : [i] })}
                      aria-label={`Option ${i + 1} correct`}
                    />
                    <span className="bold small">{String.fromCharCode(65 + i)}</span>
                    <input className="input" value={o} disabled={q.type === 'truefalse'} onChange={(e) => setQ({ ...q, options: q.options.map((x, j) => (j === i ? e.target.value : x)) })} />
                    {q.type !== 'truefalse' && q.options.length > 2 && (
                      <button className="btn ghost icon" onClick={() => setQ({ ...q, options: q.options.filter((_, j) => j !== i), correct: q.correct.filter((c) => c !== i).map((c) => (c > i ? c - 1 : c)) })} aria-label="Remove option">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
                {q.type !== 'truefalse' && q.options.length < 5 && (
                  <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setQ({ ...q, options: [...q.options, ''] })}>
                    <Plus size={14} /> Add option
                  </button>
                )}
              </div>
            </Field>
            <Field label="Why the right answer is right">
              <textarea className="input" value={q.explanation} onChange={(e) => setQ({ ...q, explanation: e.target.value })} />
            </Field>
            <Field label="Why the common wrong answer is wrong (optional)">
              <input className="input" value={q.wrongWhy ?? ''} onChange={(e) => setQ({ ...q, wrongWhy: e.target.value || undefined })} />
            </Field>
          </div>
        )}
      </div>
    </Modal>
  )
}
