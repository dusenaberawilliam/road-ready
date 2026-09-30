import { AlertTriangle, CheckCircle2, Eye, FileQuestion, Film, Flag, Pencil, PlayCircle, Plus, Scale } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Bar, Empty, masteryTone, PageHead, Seg, Stat, useToast } from '../../components/ui'
import { isCorrect } from '../../lib/engine'
import { pct, relTime } from '../../lib/util'
import { publishProblems, resolveReport, setLessonStatus, tagLawChange } from '../../store/actions'
import { useAppState, useMe } from '../../store/store'

const statusTone = { draft: undefined, in_review: 'warning', published: 'success', retired: 'danger', archived: 'danger' } as const

export function ContentLibrary() {
  const s = useAppState()
  const me = useMe()
  const toast = useToast()
  const [status, setStatus] = useState<'all' | 'in_review' | 'draft' | 'published' | 'retired'>('all')
  const national = s.lessons.filter((l) => l.schoolId === null)
  const list = national.filter((l) => status === 'all' || l.status === status)
  const topicsWithIntro = s.topics.length
  const published = national.filter((l) => l.status === 'published').length
  const qPublished = s.questions.filter((q) => q.schoolId === null && q.status === 'published').length
  return (
    <div>
      <PageHead
        title="National content library"
        sub="Every item is produced once, translated into three languages, reviewed by a second person and linked to its legal source."
        actions={
          <Link className="btn primary" to="/app/editor/lesson/new">
            <Plus size={15} /> New lesson
          </Link>
        }
      />
      <div className="grid g4 mb">
        <Stat icon={<Film size={19} />} label="Topics with intro videos" value={`${topicsWithIntro}/${s.topics.length}`} delta="launch target: all" />
        <Stat icon={<PlayCircle size={19} />} label="Published lesson videos" value={published} delta="launch target: 60+" tone={published >= 60 ? 'success' : 'warning'} />
        <Stat icon={<FileQuestion size={19} />} label="Published questions" value={qPublished} delta="launch target: 600+" tone={qPublished >= 600 ? 'success' : 'warning'} />
        <Stat icon={<Eye size={19} />} label="Awaiting review" value={national.filter((l) => l.status === 'in_review').length} tone="warning" />
      </div>
      <Seg
        options={[
          { id: 'all', label: 'All' },
          { id: 'in_review', label: 'In review' },
          { id: 'draft', label: 'Drafts' },
          { id: 'published', label: 'Published' },
          { id: 'retired', label: 'Retired' },
        ]}
        value={status}
        onChange={setStatus}
      />
      <div className="table-wrap mt">
        <table className="table">
          <thead>
            <tr>
              <th>Lesson</th>
              <th>Topic</th>
              <th>Legal ref.</th>
              <th>Status</th>
              <th>Updated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((l) => {
              const problems = publishProblems(s, l)
              const canPublish = l.status === 'in_review' && l.authorId !== me.id && problems.length === 0
              return (
                <tr key={l.id}>
                  <td>
                    <strong className="small">{l.title}</strong>
                    <div className="tiny faint">
                      v{l.version} · by {s.users.find((u) => u.id === l.authorId)?.name ?? '—'}
                      {l.lawTagged && (
                        <>
                          {' '}
                          · <span style={{ color: 'var(--danger)' }}>law changed</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="small">{s.topics.find((t) => t.id === l.topicId)?.title}</td>
                  <td className="small">{l.legalRef || <Badge tone="danger">missing</Badge>}</td>
                  <td>
                    <Badge tone={statusTone[l.status]}>{l.status.replace('_', ' ')}</Badge>
                  </td>
                  <td className="small muted">{relTime(l.updatedAt)}</td>
                  <td className="nowrap">
                    <Link className="btn sm ghost" to={`/app/learn/lesson/${l.id}`} title="Preview">
                      <Eye size={14} />
                    </Link>
                    <Link className="btn sm ghost" to={`/app/editor/lesson/${l.id}`} title="Edit">
                      <Pencil size={14} />
                    </Link>
                    {l.status === 'in_review' && (
                      <>
                        <button className="btn sm" onClick={() => (setLessonStatus(l.id, 'draft', me.id), toast('Sent back to draft', 'info'))}>
                          Request changes
                        </button>{' '}
                        <button
                          className="btn sm primary"
                          disabled={!canPublish}
                          title={l.authorId === me.id ? 'A second person must publish your own content' : problems[0]}
                          onClick={() => (setLessonStatus(l.id, 'published', me.id), toast('Published to all learners'))}
                        >
                          Publish
                        </button>
                      </>
                    )}
                    {l.status === 'published' && (
                      <button className="btn sm" onClick={() => (setLessonStatus(l.id, 'retired', me.id), toast('Retired', 'info'))}>
                        Retire
                      </button>
                    )}
                    {l.status === 'retired' && (
                      <button className="btn sm" onClick={() => setLessonStatus(l.id, 'draft', me.id)}>
                        Reopen
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="card mt">
        <h3>Production workflow</h3>
        <div className="row wrap small">
          {['Script: 8 lesson blocks', 'Legal/expert review', 'Film or animate', 'Edit + narration RW', 'Subtitles RW/EN/FR', 'Text + questions', 'Final review', 'Published'].map((x, i, arr) => (
            <span key={x} className="row" style={{ gap: 6 }}>
              <Badge tone={i === arr.length - 1 ? 'success' : 'primary'}>{x}</Badge>
              {i < arr.length - 1 && '→'}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ItemAnalysis() {
  const s = useAppState()
  const [tab, setTab] = useState<'questions' | 'lessons'>('questions')
  const attempts = s.attempts.filter((a) => a.submittedAt)
  const qRows = s.questions
    .filter((q) => q.schoolId === null && q.status === 'published')
    .map((q) => {
      const answered = attempts.filter((a) => a.questionIds.includes(q.id) && a.answers[q.id])
      const dist = q.options.map((_, i) => answered.filter((a) => a.answers[q.id]?.includes(i)).length)
      const p = answered.length ? pct(answered.filter((a) => isCorrect(q, a.answers[q.id])).length, answered.length) : null
      const topWrong = dist.map((n, i) => ({ n, i })).filter((x) => !q.correct.includes(x.i)).sort((a, b) => b.n - a.n)[0]
      return { q, n: answered.length, p, dist, topWrong }
    })
    .sort((a, b) => (a.p ?? 101) - (b.p ?? 101))
  const learners = s.users.filter((u) => u.role === 'student' || u.role === 'individual')
  const lRows = s.lessons
    .filter((l) => l.schoolId === null && l.status === 'published')
    .map((l) => {
      const ps = learners.map((u) => s.progress[u.id]?.[l.id]).filter(Boolean)
      const avgWatch = ps.length ? Math.round(ps.reduce((a, p) => a + p!.videoPct, 0) / ps.length) : 0
      const checks = attempts.filter((a) => a.mode === 'lesson_check' && a.lessonId === l.id)
      const avgCheck = checks.length ? Math.round(checks.reduce((a, x) => a + (x.score ?? 0), 0) / checks.length) : null
      const dropChapter = avgWatch < 100 ? Math.min(8, Math.floor((avgWatch / 100) * 8) + 1) : null
      return { l, starts: ps.length, avgWatch, avgCheck, dropChapter, replays: ps.reduce((a, p) => a + (p!.chaptersReplayed ?? 0), 0) }
    })
    .sort((a, b) => a.avgWatch - b.avgWatch)
  return (
    <div>
      <PageHead title="Item analysis" sub="% correct, distractor choice, video drop-off points; lessons with low check scores are flagged." />
      <Seg
        options={[
          { id: 'questions', label: 'Questions' },
          { id: 'lessons', label: 'Lessons & videos' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="table-wrap mt">
        {tab === 'questions' ? (
          <table className="table">
            <thead>
              <tr>
                <th>Question</th>
                <th>Answers</th>
                <th>% correct</th>
                <th>Most chosen wrong answer</th>
              </tr>
            </thead>
            <tbody>
              {qRows.map(({ q, n, p, topWrong }) => (
                <tr key={q.id}>
                  <td style={{ maxWidth: 380 }}>
                    <div className="small ellipsis" title={q.prompt}>
                      {q.prompt}
                    </div>
                    <div className="tiny faint">{s.topics.find((t) => t.id === q.topicId)?.title}</div>
                  </td>
                  <td className="num">{n}</td>
                  <td style={{ minWidth: 120 }}>
                    {p === null ? (
                      '—'
                    ) : (
                      <>
                        <Bar value={p} tone={masteryTone(p)} thin /> <span className="tiny">{p}%</span> {p < 40 && <Badge tone="danger">too hard?</Badge>}
                      </>
                    )}
                  </td>
                  <td className="small">{topWrong && topWrong.n > 0 ? `“${q.options[topWrong.i]}” (${topWrong.n})` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Lesson</th>
                <th>Learners started</th>
                <th>Avg watched</th>
                <th>Drop-off</th>
                <th>Chapters replayed</th>
                <th>Avg check score</th>
              </tr>
            </thead>
            <tbody>
              {lRows.map((r) => (
                <tr key={r.l.id}>
                  <td className="small bold">{r.l.title}</td>
                  <td className="num">{r.starts}</td>
                  <td style={{ minWidth: 110 }}>
                    <Bar value={r.avgWatch} tone={masteryTone(r.avgWatch)} thin /> <span className="tiny">{r.avgWatch}%</span>
                  </td>
                  <td className="small">{r.dropChapter ? `chapter ${r.dropChapter}` : '—'}</td>
                  <td className="num">{r.replays}</td>
                  <td>{r.avgCheck === null ? '—' : r.avgCheck < 60 ? <Badge tone="danger">{r.avgCheck}% · flagged</Badge> : `${r.avgCheck}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export function ReportsQueue() {
  const s = useAppState()
  const me = useMe()
  const toast = useToast()
  const [filter, setFilter] = useState<'open' | 'resolved'>('open')
  const list = s.reports.filter((r) => r.status === filter)
  return (
    <div>
      <PageHead title="Reports queue" sub='"Report a problem" on lessons and questions, routed to content editors.' />
      <Seg
        options={[
          { id: 'open', label: `Open (${s.reports.filter((r) => r.status === 'open').length})` },
          { id: 'resolved', label: 'Resolved' },
        ]}
        value={filter}
        onChange={setFilter}
      />
      <div className="stack mt">
        {list.length === 0 ? (
          <Empty title="No reports" icon={<Flag />} />
        ) : (
          list.map((r) => {
            const item = r.itemKind === 'lesson' ? s.lessons.find((l) => l.id === r.itemId)?.title : s.questions.find((q) => q.id === r.itemId)?.prompt
            return (
              <div key={r.id} className="card">
                <div className="row between wrap">
                  <div>
                    <Badge tone="info">{r.itemKind}</Badge> <strong className="small">{item}</strong>
                    <p className="small mt" style={{ marginBottom: 4 }}>
                      “{r.reason}”
                    </p>
                    <div className="tiny faint">
                      {s.users.find((u) => u.id === r.userId)?.name} · {relTime(r.createdAt)}
                    </div>
                  </div>
                  {r.status === 'open' && (
                    <div className="row">
                      <Link className="btn sm" to={r.itemKind === 'lesson' ? `/app/editor/lesson/${r.itemId}` : '/app/editor/questions'}>
                        <Pencil size={14} /> Fix
                      </Link>
                      <button className="btn sm primary" onClick={() => (resolveReport(r.id, me.id), toast('Resolved — reporter thanked'))}>
                        <CheckCircle2 size={14} /> Resolve
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export function LawChange() {
  const s = useAppState()
  const me = useMe()
  const toast = useToast()
  const refs = [...new Set(s.lessons.map((l) => l.legalRef).filter(Boolean))].sort((a, b) => Number(a.match(/\d+$/)?.[0]) - Number(b.match(/\d+$/)?.[0]))
  const [ref, setRef] = useState(refs[0] ?? '')
  const affected = s.lessons.filter((l) => l.legalRef === ref)
  const qs = s.questions.filter((q) => affected.some((l) => l.id === q.lessonId))
  const tagged = s.lessons.filter((l) => l.lawTagged)
  return (
    <div>
      <PageHead title="Law-change mode" sub="Tag a changed article: every linked lesson, video and question goes back to review." />
      <div className="grid g-side">
        <div className="card stack">
          <div className="row">
            <Scale size={18} />
            <select className="input" value={ref} onChange={(e) => setRef(e.target.value)}>
              {refs.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="small muted">
            {affected.length} lesson(s) and {qs.length} question(s) are linked to {ref}.
          </div>
          <div className="list">
            {affected.map((l) => (
              <div key={l.id} className="list-item small">
                <span className="grow">{l.title}</span>
                <Badge tone={statusTone[l.status]}>{l.status.replace('_', ' ')}</Badge>
              </div>
            ))}
          </div>
          <button
            className="btn danger"
            disabled={!affected.length}
            onClick={() => {
              if (!confirm(`Send ${affected.length} lessons and their questions back to review? Learners will stop seeing them until re-published.`)) return
              const n = tagLawChange(ref, me.id)
              toast(`${n} items sent to review`)
            }}
          >
            <AlertTriangle size={15} /> Tag {ref} as changed
          </button>
        </div>
        <div className="card">
          <h3>Items to re-review</h3>
          {tagged.length === 0 ? (
            <p className="small muted">None.</p>
          ) : (
            <div className="list">
              {tagged.map((l) => (
                <Link key={l.id} to={`/app/editor/lesson/${l.id}`} className="list-item small">
                  <span className="grow">{l.title}</span>
                  <Badge tone="danger">{l.legalRef}</Badge>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
