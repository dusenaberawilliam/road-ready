import { Download, Pencil, Plus, Upload } from 'lucide-react'
import { useState } from 'react'
import { Badge, Empty, Field, Modal, PageHead, useToast } from '../../components/ui'
import { exportCSV, parseCSV, pct } from '../../lib/util'
import { importQuestions, setQuestionStatus } from '../../store/actions'
import { useAppState, useMe } from '../../store/store'
import type { Question } from '../../types'
import QuestionEditor from './QuestionEditor'

const statusTone = { draft: undefined, in_review: 'warning', published: 'success', retired: 'danger', archived: 'danger' } as const

const TEMPLATE = `prompt,topic_id,type,option_a,option_b,option_c,option_d,correct,explanation,difficulty
"A cyclist is on your right at an unmarked junction. Who goes first?",t-priority,single,You,The cyclist,Whoever is faster,Nobody,B,"Give way to traffic from your right at unmarked junctions.",2
"You may use your phone while riding if you stop at red lights.",t-offences,truefalse,True,False,,,B,"Holding a phone while riding is forbidden.",1`

export default function QuestionBank({ national }: { national?: boolean }) {
  const s = useAppState()
  const me = useMe()
  const toast = useToast()
  const schoolId = national ? null : me.schoolId!
  const [topic, setTopic] = useState('')
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Question | 'new' | null>(null)
  const [importing, setImporting] = useState(false)
  const [csv, setCsv] = useState('')
  const own = s.questions.filter((x) => x.schoolId === schoolId)
  const list = own.filter((x) => (!topic || x.topicId === topic) && (!status || x.status === status) && (!q || x.prompt.toLowerCase().includes(q.toLowerCase())))

  const parsed = (() => {
    if (!csv.trim()) return { rows: [] as Omit<Question, 'id' | 'stats' | 'version'>[], errors: [] as string[] }
    const rows = parseCSV(csv)
    const [head, ...body] = rows
    const idx = (k: string) => head.map((h) => h.trim().toLowerCase()).indexOf(k)
    const errors: string[] = []
    const out: Omit<Question, 'id' | 'stats' | 'version'>[] = []
    body.forEach((r, i) => {
      const get = (k: string) => (r[idx(k)] ?? '').trim()
      const options = ['option_a', 'option_b', 'option_c', 'option_d'].map(get).filter(Boolean)
      const correct = get('correct').toUpperCase().split(/[;|/ ]+/).filter(Boolean).map((c) => c.charCodeAt(0) - 65)
      const type = (get('type') || 'single') as Question['type']
      if (!s.topics.some((t) => t.id === get('topic_id'))) return errors.push(`Row ${i + 2}: unknown topic_id "${get('topic_id')}"`)
      if (options.length < 2) return errors.push(`Row ${i + 2}: needs at least 2 options`)
      if (!correct.length || correct.some((c) => c < 0 || c >= options.length)) return errors.push(`Row ${i + 2}: correct must be letters A–${String.fromCharCode(64 + options.length)}`)
      out.push({ topicId: get('topic_id'), schoolId, type, prompt: get('prompt'), options, correct, explanation: get('explanation'), difficulty: (Number(get('difficulty')) || 2) as 1 | 2 | 3, status: national ? 'draft' : 'published' })
    })
    return { rows: out, errors }
  })()

  return (
    <div>
      <PageHead
        title={national ? 'National question bank' : 'School question bank'}
        sub={national ? 'Every question has an explanation, a difficulty and a status. Item analysis shows how learners answer.' : 'Your school questions are seen by your students only. Use them in tests and exams.'}
        actions={
          <>
            <button className="btn" onClick={() => exportCSV(national ? 'national-questions.csv' : 'school-questions.csv', own.map((x) => ({ id: x.id, prompt: x.prompt, topic_id: x.topicId, type: x.type, option_a: x.options[0], option_b: x.options[1], option_c: x.options[2], option_d: x.options[3], correct: x.correct.map((c) => String.fromCharCode(65 + c)).join(';'), explanation: x.explanation, difficulty: x.difficulty, status: x.status, attempts: x.stats.attempts, pct_correct: pct(x.stats.correct, x.stats.attempts) })))}>
              <Download size={15} /> Export
            </button>
            <button className="btn" onClick={() => setImporting(true)}>
              <Upload size={15} /> Bulk import
            </button>
            <button className="btn primary" onClick={() => setEditing('new')}>
              <Plus size={15} /> New question
            </button>
          </>
        }
      />
      <div className="row wrap mb">
        <input className="input" style={{ maxWidth: 280 }} placeholder="Search questions…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" style={{ width: 'auto' }} value={topic} onChange={(e) => setTopic(e.target.value)}>
          <option value="">All topics</option>
          {s.topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
        <select className="input" style={{ width: 'auto' }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          {['draft', 'in_review', 'published', 'retired'].map((x) => (
            <option key={x} value={x}>
              {x.replace('_', ' ')}
            </option>
          ))}
        </select>
        <span className="small muted">{list.length} questions</span>
      </div>
      {list.length === 0 ? (
        <Empty title="No questions yet">Create one or import a spreadsheet.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Question</th>
                <th>Topic</th>
                <th>Type</th>
                <th>Diff.</th>
                <th>% correct</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((x) => {
                const p = x.stats.attempts ? pct(x.stats.correct, x.stats.attempts) : null
                return (
                  <tr key={x.id}>
                    <td style={{ maxWidth: 380 }}>
                      <div className="small ellipsis" title={x.prompt}>
                        {x.prompt}
                      </div>
                      <div className="tiny faint">v{x.version}{x.lessonId ? ` · ${s.lessons.find((l) => l.id === x.lessonId)?.title}` : ''}</div>
                    </td>
                    <td className="small">{s.topics.find((t) => t.id === x.topicId)?.title}</td>
                    <td className="small">{x.type}</td>
                    <td>{'●'.repeat(x.difficulty)}</td>
                    <td className="num small">{p === null ? '—' : <span style={{ color: p < 40 ? 'var(--danger)' : p > 90 ? 'var(--warning)' : undefined }}>{p}% ({x.stats.attempts})</span>}</td>
                    <td>
                      <Badge tone={statusTone[x.status]}>{x.status.replace('_', ' ')}</Badge>
                    </td>
                    <td className="nowrap">
                      <button className="btn sm ghost" onClick={() => setEditing(x)} aria-label="Edit">
                        <Pencil size={14} />
                      </button>
                      {national && x.status === 'draft' && (
                        <button className="btn sm" onClick={() => (setQuestionStatus(x.id, 'in_review', me.id), toast('Sent for review'))}>
                          Submit
                        </button>
                      )}
                      {national && x.status === 'in_review' && (
                        <button className="btn sm primary" onClick={() => (setQuestionStatus(x.id, 'published', me.id), toast('Published'))}>
                          Publish
                        </button>
                      )}
                      {x.status === 'published' && (
                        <button className="btn sm" onClick={() => (setQuestionStatus(x.id, 'retired', me.id), toast('Retired — no longer used in new tests', 'info'))}>
                          Retire
                        </button>
                      )}
                      {x.status === 'retired' && (
                        <button className="btn sm" onClick={() => (setQuestionStatus(x.id, 'published', me.id), toast('Restored'))}>
                          Restore
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {editing && <QuestionEditor question={editing === 'new' ? undefined : editing} schoolId={schoolId} onClose={() => setEditing(null)} />}
      {importing && (
        <Modal
          wide
          title="Bulk import questions from a spreadsheet"
          onClose={() => setImporting(false)}
          footer={
            <>
              <button className="btn" onClick={() => setCsv(TEMPLATE)}>
                Load example
              </button>
              <button
                className="btn primary"
                disabled={!parsed.rows.length || parsed.errors.length > 0}
                onClick={() => {
                  importQuestions(parsed.rows, me.id)
                  toast(`${parsed.rows.length} questions imported`)
                  setImporting(false)
                  setCsv('')
                }}
              >
                Import {parsed.rows.length || ''} questions
              </button>
            </>
          }
        >
          <div className="stack">
            <p className="small muted">
              Save your spreadsheet as CSV with the columns: <code>prompt, topic_id, type, option_a…option_d, correct, explanation, difficulty</code>. Topic ids: {s.topics.map((t) => t.id).join(', ')}.
            </p>
            <Field label="Upload CSV file">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) f.text().then(setCsv)
                }}
              />
            </Field>
            <Field label="…or paste CSV">
              <textarea className="input" rows={8} style={{ fontFamily: 'monospace', fontSize: 12 }} value={csv} onChange={(e) => setCsv(e.target.value)} />
            </Field>
            {parsed.errors.length > 0 && (
              <div className="callout danger small">
                {parsed.errors.map((e) => (
                  <div key={e}>{e}</div>
                ))}
              </div>
            )}
            {parsed.rows.length > 0 && !parsed.errors.length && <div className="callout success small">{parsed.rows.length} valid questions ready to import.</div>}
          </div>
        </Modal>
      )}
    </div>
  )
}
