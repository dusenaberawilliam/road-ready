import { AlertCircle, CheckCircle2, Eye, FileUp, Film, Plus, Trash2, Video } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { signNames } from '../../components/RoadSign'
import Scene from '../../components/Scene'
import { Badge, Empty, Field, PageHead, Seg, useToast } from '../../components/ui'
import { uid } from '../../lib/util'
import { publishProblems, saveLesson, setLessonStatus } from '../../store/actions'
import { getState, useAppState, useMe } from '../../store/store'
import type { Attachment, Lesson, SceneKind, SignKind } from '../../types'
import QuestionEditor from './QuestionEditor'

const blankBlocks = (): Lesson['blocks'] => ({ scene: '', predict: { prompt: '', options: ['', ''], correct: 0 }, rule: '', why: '', onRoad: '', trap: '', tip: '', mission: '' })

const BLOCKS: { key: Exclude<keyof Lesson['blocks'], 'predict'>; n: number; title: string; hint: string }[] = [
  { key: 'scene', n: 1, title: 'Road scene', hint: 'A real everyday situation on a Rwandan road.' },
  { key: 'rule', n: 3, title: 'The rule', hint: 'The rule in plain words.' },
  { key: 'why', n: 4, title: 'Why it matters', hint: 'The safety consequence of getting it wrong.' },
  { key: 'onRoad', n: 5, title: 'See it on the road', hint: 'Where this happens: junctions, school zones, rain, night.' },
  { key: 'trap', n: 6, title: 'Common trap', hint: 'The wrong answer most learners choose, and why.' },
  { key: 'tip', n: 7, title: 'Tip of the day', hint: 'A short method learners can reuse.' },
  { key: 'mission', n: 8, title: 'Road mission', hint: 'A real-life observation task for this week.' },
]

export default function LessonEditor({ national }: { national?: boolean }) {
  const { lessonId } = useParams()
  const s = useAppState()
  const me = useMe()
  const toast = useToast()
  const navigate = useNavigate()
  const existing = s.lessons.find((l) => l.id === lessonId)
  const school = s.schools.find((x) => x.id === me.schoolId)
  const base = national ? '/app/editor' : '/app/teacher/content'
  const [l, setL] = useState<Lesson>(
    () =>
      existing ?? {
        id: uid('l'),
        subtopicId: s.subtopics[0].id,
        topicId: s.subtopics[0].topicId,
        schoolId: national ? null : me.schoolId!,
        title: '',
        scene: 'road',
        durationSec: 240,
        blocks: blankBlocks(),
        legalRef: '',
        attachments: [],
        status: 'draft',
        version: 1,
        hasVideo: false,
        authorId: me.id,
        updatedAt: new Date().toISOString(),
        language: national ? undefined : 'en',
      },
  )
  const [upload, setUpload] = useState<{ name: string; pct: number; stage: string } | null>(null)
  const [recording, setRecording] = useState<number | null>(null)
  const [addingQ, setAddingQ] = useState(false)
  const [videoSource, setVideoSource] = useState<'upload' | 'record' | 'reuse'>('upload')
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => clearInterval(timer.current), [])

  if (lessonId && lessonId !== 'new' && !existing) return <Empty title="Lesson not found" />
  if (existing && !national && existing.schoolId !== me.schoolId) return <Empty title="You can only edit your school's lessons" />

  const questions = s.questions.filter((q) => q.lessonId === l.id && q.status !== 'retired')
  const problems = publishProblems(s, l)
  const isNew = !existing
  const subs = s.subtopics.filter((x) => x.topicId === l.topicId)
  const setB = (patch: Partial<Lesson['blocks']>) => setL({ ...l, blocks: { ...l.blocks, ...patch } })

  const startUpload = (file: File) => {
    if (file.size > 500 * 1024 * 1024) return toast('Videos must be under 500 MB', 'error')
    const stages = ['Uploading', 'Uploading', 'Uploading', 'Compressing to 240p / 360p / 720p', 'Generating chapters']
    let pct = 0
    clearInterval(timer.current)
    timer.current = window.setInterval(() => {
      pct += 7
      if (pct >= 100) {
        clearInterval(timer.current)
        setUpload(null)
        setL((cur) => ({ ...cur, hasVideo: true, durationSec: 180 + Math.round(Math.random() * 120) }))
        toast('Video ready — streaming renditions created')
        return
      }
      setUpload({ name: file.name, pct, stage: stages[Math.min(stages.length - 1, Math.floor(pct / 20))] })
    }, 150)
  }

  const persist = (msg?: string) => {
    saveLesson({ ...l, status: existing?.status ?? 'draft' }, me.id)
    if (msg) toast(msg)
    if (isNew) navigate(`${base}/lesson/${l.id}`, { replace: true })
  }

  const submit = () => {
    saveLesson(l, me.id)
    const current = getState().lessons.find((x) => x.id === l.id)!
    const p = publishProblems(getState(), current)
    if (p.length) return toast(`Cannot publish: ${p[0]}`, 'error')
    if (national) {
      setLessonStatus(l.id, 'in_review', me.id)
      toast('Sent for review — a second person must approve before publishing')
    } else if (school?.requireContentApproval) {
      setLessonStatus(l.id, 'in_review', me.id)
      toast('Sent to your school admin for approval')
    } else {
      setLessonStatus(l.id, 'published', me.id)
      toast('Published — your students can see it now')
    }
    navigate(base)
  }

  const status = existing?.status ?? 'draft'

  return (
    <div>
      <PageHead
        crumbs={[{ to: base, label: national ? 'Content library' : 'My lessons' }]}
        title={isNew ? 'New lesson' : l.title || 'Untitled lesson'}
        sub={
          <>
            <Badge tone={status === 'published' ? 'success' : status === 'in_review' ? 'warning' : undefined}>{status.replace('_', ' ')}</Badge> v{l.version} · {national ? 'National content' : `${school?.name} only`}
            {l.lawTagged && (
              <>
                {' '}
                <Badge tone="danger">law changed — review</Badge>
              </>
            )}
          </>
        }
        actions={
          <>
            {!isNew && (
              <Link className="btn" to={`/app/learn/lesson/${l.id}`}>
                <Eye size={15} /> Preview
              </Link>
            )}
            <button className="btn" disabled={l.title.trim().length < 5} onClick={() => persist('Draft saved')}>
              Save draft
            </button>
            <button className="btn primary" disabled={l.title.trim().length < 5 || problems.length > 0 || status === 'in_review'} onClick={submit} title={problems[0]}>
              {national || school?.requireContentApproval ? 'Submit for review' : status === 'published' ? 'Publish new version' : 'Publish'}
            </button>
          </>
        }
      />
      <div className="grid g-side">
        <div className="stack lg">
          <div className="card stack">
            <h2>Basics</h2>
            <Field label="Lesson title">
              <input className="input" value={l.title} onChange={(e) => setL({ ...l, title: e.target.value })} placeholder="e.g. Entering a roundabout when a moto is already inside" />
            </Field>
            <div className="grid g3">
              <Field label="Topic">
                <select className="input" value={l.topicId} onChange={(e) => setL({ ...l, topicId: e.target.value, subtopicId: s.subtopics.find((x) => x.topicId === e.target.value)!.id })}>
                  {s.topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Sub-topic">
                <select className="input" value={l.subtopicId} onChange={(e) => setL({ ...l, subtopicId: e.target.value })}>
                  {subs.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Legal reference" hint="Law article or Ministerial Order clause">
                <input className="input" value={l.legalRef} onChange={(e) => setL({ ...l, legalRef: e.target.value })} placeholder="Law n° 014/2026 · Art. 31" />
              </Field>
            </div>
            {!national && (
              <Field label="Language" hint="Single-language school content is allowed and marked with its language.">
                <Seg
                  options={[
                    { id: 'rw', label: 'Kinyarwanda' },
                    { id: 'en', label: 'English' },
                    { id: 'fr', label: 'Français' },
                  ]}
                  value={l.language ?? 'en'}
                  onChange={(v) => setL({ ...l, language: v })}
                />
              </Field>
            )}
          </div>

          <div className="card stack">
            <div className="card-head">
              <h2>
                <Video size={18} /> Video (mandatory)
              </h2>
              {l.hasVideo && <Badge tone="success">Video ready · {Math.round(l.durationSec / 60)} min</Badge>}
            </div>
            <Seg
              options={[
                { id: 'upload', label: 'Upload' },
                { id: 'record', label: 'Record in browser' },
                { id: 'reuse', label: 'Reuse a national video' },
              ]}
              value={videoSource}
              onChange={setVideoSource}
            />
            {videoSource === 'upload' && (
              <label className="drop">
                <FileUp size={22} />
                <div>{upload ? `${upload.stage}… ${upload.pct}%` : 'Choose a video from your phone or computer (max 500 MB, 3–5 minutes, one scenario)'}</div>
                {upload && (
                  <div className="bar mt">
                    <span style={{ width: `${upload.pct}%` }} />
                  </div>
                )}
                <input type="file" accept="video/*" hidden onChange={(e) => e.target.files?.[0] && startUpload(e.target.files[0])} />
              </label>
            )}
            {videoSource === 'record' && (
              <div className="stack sm">
                <div className="player">
                  <div className="player-stage">
                    <Scene kind={l.scene} sign={l.sign} animate={recording !== null} />
                    {recording !== null && <div className="player-chapter" style={{ background: 'var(--danger)' }}>● REC {recording}s</div>}
                  </div>
                </div>
                {recording === null ? (
                  <button
                    className="btn"
                    onClick={() => {
                      setRecording(0)
                      clearInterval(timer.current)
                      timer.current = window.setInterval(() => setRecording((r) => (r ?? 0) + 1), 1000)
                    }}
                  >
                    <Film size={15} /> Start recording
                  </button>
                ) : (
                  <button
                    className="btn danger"
                    onClick={() => {
                      clearInterval(timer.current)
                      setL({ ...l, hasVideo: true, durationSec: Math.max(60, (recording ?? 0) * 10) })
                      setRecording(null)
                      toast('Recording saved and compressed')
                    }}
                  >
                    Stop and save
                  </button>
                )}
              </div>
            )}
            {videoSource === 'reuse' && (
              <select
                className="input"
                defaultValue=""
                onChange={(e) => {
                  const src = s.lessons.find((x) => x.id === e.target.value)
                  if (src) setL({ ...l, hasVideo: true, scene: src.scene, sign: src.sign, durationSec: src.durationSec })
                  toast('National video linked')
                }}
              >
                <option value="" disabled>
                  Choose a national lesson video…
                </option>
                {s.lessons
                  .filter((x) => x.schoolId === null && x.status === 'published')
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.title}
                    </option>
                  ))}
              </select>
            )}
            <div className="grid g2">
              <Field label="Scene (thumbnail)">
                <select className="input" value={l.scene} onChange={(e) => setL({ ...l, scene: e.target.value as SceneKind })}>
                  {['roundabout', 'junction', 'zebra', 'bend', 'road', 'night', 'police', 'accident'].map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </Field>
              <Field label="Road sign (optional)">
                <select className="input" value={l.sign ?? ''} onChange={(e) => setL({ ...l, sign: (e.target.value || undefined) as SignKind | undefined })}>
                  <option value="">None</option>
                  {Object.entries(signNames).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <p className="tiny faint" style={{ margin: 0 }}>Chapters are created automatically from the 8 lesson blocks. Subtitles are generated from the text version.</p>
          </div>

          <div className="card stack">
            <h2>Text version — 8 blocks (mandatory)</h2>
            <p className="small muted" style={{ margin: 0 }}>One script produces both the video and the text, so they always match. Readable in 5 minutes on a small phone.</p>
            {BLOCKS.slice(0, 1).map((b) => (
              <Field key={b.key} label={`${b.n}. ${b.title}`} hint={b.hint}>
                <textarea className="input" value={l.blocks[b.key]} onChange={(e) => setB({ [b.key]: e.target.value })} />
              </Field>
            ))}
            <Field label="2. What would you do?" hint="The learner picks an action before seeing the rule.">
              <div className="stack sm">
                <input className="input" placeholder="Question prompt" value={l.blocks.predict.prompt} onChange={(e) => setB({ predict: { ...l.blocks.predict, prompt: e.target.value } })} />
                {l.blocks.predict.options.map((o, i) => (
                  <div key={i} className="row">
                    <input type="radio" name="predict" checked={l.blocks.predict.correct === i} onChange={() => setB({ predict: { ...l.blocks.predict, correct: i } })} aria-label="Correct action" />
                    <input className="input" value={o} placeholder={`Option ${String.fromCharCode(65 + i)}`} onChange={(e) => setB({ predict: { ...l.blocks.predict, options: l.blocks.predict.options.map((x, j) => (j === i ? e.target.value : x)) } })} />
                    {l.blocks.predict.options.length > 2 && (
                      <button className="btn ghost icon" onClick={() => setB({ predict: { ...l.blocks.predict, options: l.blocks.predict.options.filter((_, j) => j !== i), correct: 0 } })} aria-label="Remove">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
                {l.blocks.predict.options.length < 4 && (
                  <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setB({ predict: { ...l.blocks.predict, options: [...l.blocks.predict.options, ''] } })}>
                    <Plus size={14} /> Add option
                  </button>
                )}
              </div>
            </Field>
            {BLOCKS.slice(1).map((b) => (
              <Field key={b.key} label={`${b.n}. ${b.title}`} hint={b.hint}>
                <textarea className="input" rows={2} value={l.blocks[b.key]} onChange={(e) => setB({ [b.key]: e.target.value })} />
              </Field>
            ))}
          </div>

          <div className="card stack">
            <div className="card-head">
              <h2>Check-yourself questions</h2>
              <button className="btn sm" onClick={() => (isNew && l.title.trim().length >= 5 ? (saveLesson(l, me.id), setAddingQ(true)) : setAddingQ(true))}>
                <Plus size={14} /> Add question
              </button>
            </div>
            {questions.length === 0 ? (
              <p className="small muted">At least one question is required to publish.</p>
            ) : (
              <div className="list">
                {questions.map((q) => (
                  <div key={q.id} className="list-item small">
                    <CheckCircle2 size={15} color="var(--success)" />
                    <span className="grow">{q.prompt}</span>
                    <Badge>{q.type}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card stack">
            <h2>Attachments (additional material)</h2>
            <p className="small muted" style={{ margin: 0 }}>Images up to 5 MB, files up to 20 MB. PDFs are allowed only as additional material, never as the lesson itself.</p>
            {l.attachments.map((a) => (
              <div key={a.id} className="row">
                <Badge>{a.kind}</Badge>
                <input className="input" value={a.label} onChange={(e) => setL({ ...l, attachments: l.attachments.map((x) => (x.id === a.id ? { ...x, label: e.target.value } : x)) })} />
                <span className="small faint nowrap">{a.size}</span>
                <button className="btn ghost icon" onClick={() => setL({ ...l, attachments: l.attachments.filter((x) => x.id !== a.id) })} aria-label="Remove attachment">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <label className="btn" style={{ alignSelf: 'flex-start' }}>
              <FileUp size={15} /> Add image or file
              <input
                type="file"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  const isImg = f.type.startsWith('image/')
                  if (f.size > (isImg ? 5 : 20) * 1024 * 1024) return toast(isImg ? 'Images must be under 5 MB' : 'Files must be under 20 MB', 'error')
                  const att: Attachment = { id: uid('a'), kind: isImg ? 'image' : f.type === 'application/pdf' ? 'pdf' : 'file', label: `${f.name.replace(/\.[^.]+$/, '')} — Additional material`, size: `${Math.max(1, Math.round(f.size / 1024))} KB` }
                  setL({ ...l, attachments: [...l.attachments, att] })
                }}
              />
            </label>
          </div>
        </div>

        <div className="stack lg">
          <div className="card" style={{ position: 'sticky', top: 76 }}>
            <h3>Publishing checklist</h3>
            <p className="small muted">A lesson cannot be published without a video, a text version, at least one check question and a legal reference.</p>
            <div className="stack sm">
              {[
                ['Video', l.hasVideo],
                ['All 8 text blocks', !problems.some((p) => p.includes('8 text') || p.includes('What would you do'))],
                ['Check-yourself question', questions.length > 0],
                ['Legal reference', !!l.legalRef.trim()],
              ].map(([label, ok]) => (
                <div key={label as string} className="row small">
                  {ok ? <CheckCircle2 size={16} color="var(--success)" /> : <AlertCircle size={16} color="var(--danger)" />} {label}
                </div>
              ))}
            </div>
            {!national && school?.requireContentApproval && <div className="callout small mt">Your school requires admin approval before lessons are published.</div>}
            {national && <div className="callout small mt">National content needs a two-person review: someone other than the author publishes it.</div>}
            {status === 'published' && <div className="callout warning small mt">Editing a published lesson creates version {l.version + 1}. Past results keep the version used.</div>}
          </div>
        </div>
      </div>
      {addingQ && <QuestionEditor schoolId={l.schoolId} lessonId={l.id} topicId={l.topicId} onClose={() => setAddingQ(false)} onSaved={() => isNew && navigate(`${base}/lesson/${l.id}`, { replace: true })} />}
    </div>
  )
}
