import { ArrowLeft, ArrowRight, BookOpenCheck, Download, ExternalLink, FileText, Flag, Image as ImageIcon, Lock, MapPin, NotebookPen, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import RoadSign from '../../components/RoadSign'
import Thread from '../../components/Thread'
import { Badge, Empty, Modal, PageHead, Seg, useToast } from '../../components/ui'
import VideoPlayer, { LESSON_CHAPTERS } from '../../components/VideoPlayer'
import { glossary } from '../../data/content'
import { lessonLocked } from '../../lib/access'
import { lessonDone, visibleLessons } from '../../lib/engine'
import { canModerateSpace } from '../../lib/scope'
import { fmtTime, relTime } from '../../lib/util'
import { addNote, deleteNote, recordDownload, reportContent, saveProgress, updateNote } from '../../store/actions'
import { useAppState, useMe } from '../../store/store'
import type { Lesson } from '../../types'

const isLearner = (role: string) => role === 'student' || role === 'individual'

function renderText(text: string, quotes: string[], onTerm: (t: string) => void): ReactNode[] {
  const out: ReactNode[] = []
  let parts: { text: string; hl: boolean }[] = [{ text, hl: false }]
  for (const q of quotes.filter((x) => x && text.includes(x))) {
    parts = parts.flatMap((p) => {
      if (p.hl || !p.text.includes(q)) return [p]
      const [a, ...rest] = p.text.split(q)
      return [{ text: a, hl: false }, { text: q, hl: true }, { text: rest.join(q), hl: false }]
    })
  }
  const terms = Object.keys(glossary)
  const re = new RegExp(`\\b(${terms.map((t) => t.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})\\b`, 'gi')
  parts.forEach((p, i) => {
    if (p.hl) return out.push(<mark key={i} className="hl">{p.text}</mark>)
    const segs = p.text.split(re)
    segs.forEach((seg, j) => {
      const key = terms.find((t) => t.toLowerCase() === seg.toLowerCase())
      out.push(
        key ? (
          <span key={`${i}-${j}`} className="term" title={glossary[key]} role="button" tabIndex={0} onClick={() => onTerm(key)} onKeyDown={(e) => e.key === 'Enter' && onTerm(key)}>
            {seg}
          </span>
        ) : (
          seg
        ),
      )
    })
  })
  return out
}

export default function LessonPage() {
  const { lessonId } = useParams()
  const [params] = useSearchParams()
  const s = useAppState()
  const me = useMe()
  const toast = useToast()
  const navigate = useNavigate()
  const lesson = s.lessons.find((l) => l.id === lessonId)
  const [mode, setMode] = useState<'video' | 'text'>('video')
  const [time, setTime] = useState(0)
  const [seek, setSeek] = useState<{ t: number; n: number } | undefined>(() => (params.get('t') ? { t: Number(params.get('t')), n: 1 } : undefined))
  const [noteBody, setNoteBody] = useState('')
  const [pinTime, setPinTime] = useState(true)
  const [selection, setSelection] = useState<{ text: string; x: number; y: number } | null>(null)
  const [quoteNote, setQuoteNote] = useState<{ quote: string; body: string } | null>(null)
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null)
  const [mission, setMission] = useState('')
  const [report, setReport] = useState(false)
  const [reason, setReason] = useState('')
  const [showRule, setShowRule] = useState(false)
  const textRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (location.hash === '#comments') setTimeout(() => document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [lessonId])

  const learner = isLearner(me.role)
  const allowed = useMemo(() => {
    if (!lesson) return false
    if (!learner) return true
    return visibleLessons(s, me).some((l) => l.id === lesson.id)
  }, [s, me, lesson, learner])

  if (!lesson) return <Empty title="Lesson not found" />
  if (!allowed) return <Empty title="This lesson is not available in your course" />
  if (learner && lessonLocked(s, me, lesson)) return <Navigate to="/app/plans" replace />

  const progress = s.progress[me.id]?.[lesson.id]
  const topic = s.topics.find((t) => t.id === lesson.topicId)!
  const sub = s.subtopics.find((t) => t.id === lesson.subtopicId)!
  const b = lesson.blocks
  const chapters = [
    { title: LESSON_CHAPTERS[0], text: b.scene },
    { title: LESSON_CHAPTERS[1], text: `${b.predict.prompt} ${b.predict.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}.`).join(' ')}` },
    { title: LESSON_CHAPTERS[2], text: b.rule },
    { title: LESSON_CHAPTERS[3], text: b.why },
    { title: LESSON_CHAPTERS[4], text: b.onRoad },
    { title: LESSON_CHAPTERS[5], text: b.trap },
    { title: LESSON_CHAPTERS[6], text: b.tip },
    { title: LESSON_CHAPTERS[7], text: `Check yourself with 3 to 5 questions. Road mission: ${b.mission}` },
  ]
  const myNotes = s.notes.filter((n) => n.userId === me.id && n.itemId === lesson.id)
  const classNotes = s.notes.filter((n) => n.visibility === 'class' && n.itemId === lesson.id && (n.cohortId === me.cohortId || n.userId === me.id) && n.userId !== me.id)
  const quotes = myNotes.map((n) => n.quote ?? '')
  const list = learner ? visibleLessons(s, me) : s.lessons.filter((l) => l.status === 'published' && (l.schoolId === null || l.schoolId === me.schoolId))
  const ordered = [...list].sort((a, c) => (s.topics.find((t) => t.id === a.topicId)!.order - s.topics.find((t) => t.id === c.topicId)!.order) || s.subtopics.findIndex((x) => x.id === a.subtopicId) - s.subtopics.findIndex((x) => x.id === c.subtopicId))
  const idx = ordered.findIndex((l) => l.id === lesson.id)
  const prev = ordered[idx - 1]
  const next = ordered[idx + 1]
  const spaceId = `lesson:${lesson.id}:${me.schoolId ?? 'public'}`
  const onTerm = (t: string) => toast(`${t}: ${glossary[t]}`, 'info')

  const predict = (i: number) => {
    if (!learner) return
    saveProgress(me.id, lesson.id, { prediction: i })
  }

  const onMouseUp = () => {
    const sel = window.getSelection()
    const text = sel?.toString().trim() ?? ''
    if (text.length < 4 || !sel || !textRef.current?.contains(sel.anchorNode)) return setSelection(null)
    const rect = sel.getRangeAt(0).getBoundingClientRect()
    setSelection({ text, x: rect.left + rect.width / 2, y: rect.top })
  }

  const watch = (n: number) => (setMode('video'), setSeek({ t: (n - 1) * (lesson.durationSec / 8) + 0.1, n: Date.now() }))

  const predicted = progress?.prediction

  return (
    <div>
      <PageHead
        crumbs={[
          { to: '/app/learn', label: 'Lessons' },
          { to: `/app/learn/topic/${topic.id}`, label: topic.title },
        ]}
        title={lesson.title}
        sub={
          <>
            {sub.title} · {lesson.legalRef} {lesson.schoolId && <Badge tone="info">Lesson from your school</Badge>} {!learner && <Badge tone="warning">Preview mode</Badge>}
          </>
        }
        actions={
          <Seg
            options={[
              { id: 'video', label: 'Video' },
              { id: 'text', label: 'Text' },
            ]}
            value={mode}
            onChange={setMode}
          />
        }
      />
      <div className="grid g-side">
        <div className="stack lg" style={{ minWidth: 0 }}>
          {mode === 'video' ? (
            <div className="stack">
              <VideoPlayer
                scene={lesson.scene}
                sign={lesson.sign}
                durationSec={lesson.durationSec}
                chapters={chapters}
                startAt={progress?.position ?? 0}
                seekRequest={seek}
                defaultQuality={s.settings[me.id]?.quality}
                onTime={setTime}
                onProgress={(pct, pos) => learner && saveProgress(me.id, lesson.id, { videoPct: pct, position: pos })}
                downloaded={progress?.downloaded}
                onDownload={learner ? () => (saveProgress(me.id, lesson.id, { downloaded: true }), toast('Saved for offline viewing in the app')) : undefined}
                onChapterReplay={() => learner && saveProgress(me.id, lesson.id, { chaptersReplayed: (progress?.chaptersReplayed ?? 0) + 1 })}
                onSpeed={(sp) => learner && saveProgress(me.id, lesson.id, { lastSpeed: sp })}
              />
              {learner && (
                <div className="card tight">
                  <div className="row wrap">
                    <NotebookPen size={16} className="faint" />
                    <input className="input grow" placeholder="Add a note to this lesson…" value={noteBody} onChange={(e) => setNoteBody(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && document.getElementById('save-note')?.click()} />
                    <label className="check small nowrap">
                      <input type="checkbox" checked={pinTime} onChange={(e) => setPinTime(e.target.checked)} /> at {fmtTime(time)}
                    </label>
                    <button
                      id="save-note"
                      className="btn primary sm"
                      disabled={!noteBody.trim()}
                      onClick={() => {
                        addNote({ userId: me.id, itemId: lesson.id, itemTitle: lesson.title, topicId: lesson.topicId, body: noteBody.trim(), videoTime: pinTime ? Math.round(time) : undefined, visibility: 'private' })
                        setNoteBody('')
                        toast('Note saved')
                      }}
                    >
                      Save note
                    </button>
                  </div>
                </div>
              )}
              <div className="row wrap">
                <span className="small muted">Watched {progress?.videoPct ?? 0}%.</span>
                <button className="linkbtn small" onClick={() => setMode('text')}>
                  Prefer reading? Switch to the text version →
                </button>
              </div>
            </div>
          ) : (
            <div className="card" ref={textRef} onMouseUp={onMouseUp} onTouchEnd={onMouseUp}>
              <p className="small faint">Tip: select any sentence to highlight it and add a note. Dotted words have a glossary definition.</p>
              <Block onWatch={watch} dur={lesson.durationSec} n={1} title="Road scene">
                <p>{renderText(b.scene, quotes, onTerm)}</p>
              </Block>
              <Block onWatch={watch} dur={lesson.durationSec} n={2} title="What would you do?">
                <p className="bold">{b.predict.prompt}</p>
                <div className="options">
                  {b.predict.options.map((o, i) => {
                    const cls = predicted === undefined ? '' : i === b.predict.correct ? 'correct' : i === predicted ? 'wrong' : ''
                    return (
                      <button key={i} className={`option ${cls}`} onClick={() => predict(i)} disabled={predicted !== undefined || !learner}>
                        <span className="key">{String.fromCharCode(65 + i)}</span>
                        {o}
                      </button>
                    )
                  })}
                </div>
                {predicted !== undefined && (
                  <p className="small mt" style={{ color: predicted === b.predict.correct ? 'var(--success)' : 'var(--danger)' }}>
                    {predicted === b.predict.correct ? 'Good instinct! Now read the rule to see why.' : 'Most learners pick this one too — read the rule and the common trap below.'}
                  </p>
                )}
              </Block>
              <Block onWatch={watch} dur={lesson.durationSec} n={3} title="The rule">
                {predicted === undefined && learner && !showRule ? (
                  <div className="callout small">
                    <Lock size={14} /> Pick your answer above first — predicting before reading helps you remember.{' '}
                    <button className="linkbtn" onClick={() => setShowRule(true)}>
                      Show anyway
                    </button>
                  </div>
                ) : (
                  <>
                    <p>{renderText(b.rule, quotes, onTerm)}</p>
                    <p className="small muted">Legal reference: {lesson.legalRef}</p>
                  </>
                )}
              </Block>
              <Block onWatch={watch} dur={lesson.durationSec} n={4} title="Why it matters">
                <p>{renderText(b.why, quotes, onTerm)}</p>
              </Block>
              <Block onWatch={watch} dur={lesson.durationSec} n={5} title="See it on the road">
                <p>
                  <MapPin size={14} /> {renderText(b.onRoad, quotes, onTerm)}
                </p>
              </Block>
              <Block onWatch={watch} dur={lesson.durationSec} n={6} title="Common trap" cls="trap">
                <p>{renderText(b.trap, quotes, onTerm)}</p>
              </Block>
              <Block onWatch={watch} dur={lesson.durationSec} n={7} title="Tip of the day — Inama y'uyu munsi" cls="tip">
                <p>{renderText(b.tip, quotes, onTerm)}</p>
              </Block>
              <Block onWatch={watch} dur={lesson.durationSec} n={8} title="Check yourself + road mission">
                <div className="stack">
                  {learner ? (
                    <button className="btn primary" style={{ alignSelf: 'flex-start' }} onClick={() => navigate(`/app/practice/start/lesson_check?lesson=${lesson.id}`)}>
                      <BookOpenCheck size={16} /> Check yourself (3–5 questions)
                    </button>
                  ) : (
                    <span className="small muted">Learners take a 3–5 question check here.</span>
                  )}
                  <div className="callout primary">
                    <strong>Road mission:</strong> {b.mission}
                  </div>
                  {learner && (
                    <div className="row">
                      <input className="input" placeholder="What did you notice? (saved to your notes)" value={mission} onChange={(e) => setMission(e.target.value)} />
                      <button
                        className="btn"
                        disabled={mission.trim().length < 3}
                        onClick={() => {
                          addNote({ userId: me.id, itemId: lesson.id, itemTitle: lesson.title, topicId: lesson.topicId, body: `Road mission: ${mission.trim()}`, visibility: 'private' })
                          setMission('')
                          toast('Road mission saved to your notes')
                        }}
                      >
                        Save
                      </button>
                    </div>
                  )}
                </div>
              </Block>
              {learner && (
                <div className="row between wrap">
                  <span className="small muted">{progress?.textRead ? '✓ You read this lesson' : 'Reached the end?'}</span>
                  {!progress?.textRead && (
                    <button className="btn" onClick={() => (saveProgress(me.id, lesson.id, { textRead: true }), toast('Marked as read'))}>
                      Mark as read
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="row between">
            {prev ? (
              <Link className="btn" to={`/app/learn/lesson/${prev.id}`}>
                <ArrowLeft size={16} /> <span className="hide-sm ellipsis" style={{ maxWidth: 220 }}>{prev.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link className="btn" to={`/app/learn/lesson/${next.id}`}>
                <span className="hide-sm ellipsis" style={{ maxWidth: 220 }}>{next.title}</span> <ArrowRight size={16} />
              </Link>
            )}
          </div>

          <div className="card" id="comments">
            <div className="card-head">
              <h2>Comments</h2>
              <span className="small faint">{me.schoolId ? 'Only your school sees these' : 'Read-only for individual learners'}</span>
            </div>
            <Thread
              spaceId={spaceId}
              canPost={me.role !== 'individual'}
              canModerate={canModerateSpace(s, me, spaceId)}
              videoTime={mode === 'video' ? time : undefined}
              onSeek={(t) => (setMode('video'), setSeek({ t, n: Date.now() }), window.scrollTo({ top: 0, behavior: 'smooth' }))}
            />
          </div>
        </div>

        <div className="stack lg">
          {learner && (
            <div className="card">
              <div className="card-head">
                <h3>Lesson status</h3>
                {lessonDone(s, me.id, lesson.id) && <Badge tone="success">Completed</Badge>}
              </div>
              <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
                <li>Video watched: {progress?.videoPct ?? 0}%</li>
                <li>Text read: {progress?.textRead ? 'yes' : 'no'}</li>
                <li>Check passed: {progress?.checkPassed ? 'yes' : 'not yet'}</li>
              </ul>
            </div>
          )}
          {classNotes.length > 0 && (
            <div className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
              <h3>Note from your teacher</h3>
              {classNotes.map((n) => (
                <p key={n.id} className="small">
                  {n.body}
                  <br />
                  <span className="faint">— {s.users.find((u) => u.id === n.userId)?.name}</span>
                </p>
              ))}
            </div>
          )}
          {learner && (
            <div className="card">
              <div className="card-head">
                <h3>My notes ({myNotes.length})</h3>
                <Link to="/app/notes" className="small">
                  All notes
                </Link>
              </div>
              {myNotes.length === 0 ? (
                <p className="small muted">Notes you add while watching or reading appear here. Only you can see them.</p>
              ) : (
                <div className="list">
                  {myNotes.map((n) => (
                    <div key={n.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                      <div className="grow small">
                        {n.videoTime !== undefined && (
                          <button className="linkbtn" onClick={() => (setMode('video'), setSeek({ t: n.videoTime!, n: Date.now() }))}>
                            {fmtTime(n.videoTime)}
                          </button>
                        )}{' '}
                        {n.quote && <mark className="hl">“{n.quote}”</mark>}{' '}
                        {editing?.id === n.id ? (
                          <div className="row mt">
                            <input className="input" value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} autoFocus />
                            <button className="btn sm primary" onClick={() => (updateNote(n.id, editing.body), setEditing(null))}>
                              Save
                            </button>
                          </div>
                        ) : (
                          n.body
                        )}
                        <div className="tiny faint">{relTime(n.createdAt)}</div>
                      </div>
                      <button className="btn ghost icon" onClick={() => setEditing({ id: n.id, body: n.body })} aria-label="Edit note">
                        <Pencil size={14} />
                      </button>
                      <button className="btn ghost icon" onClick={() => (deleteNote(n.id), toast('Note deleted', 'info'))} aria-label="Delete note">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="card">
            <h3>Additional material</h3>
            <p className="tiny faint">Supplementary only — never replaces the video + text lesson.</p>
            <div className="list">
              {lesson.attachments.map((a) => {
                const got = s.downloads[me.id]?.includes(a.id)
                return (
                  <div key={a.id} className="list-item">
                    {a.kind === 'image' ? <ImageIcon size={16} /> : a.kind === 'link' ? <ExternalLink size={16} /> : <FileText size={16} />}
                    <span className="grow small">
                      {a.label}
                      {a.size && <span className="faint"> · {a.size}</span>}
                    </span>
                    {a.kind === 'link' ? (
                      <a className="btn sm" href={a.url} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    ) : (
                      <AttachmentButton lesson={lesson} id={a.id} kind={a.kind} got={!!got} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          {lesson.sign && (
            <div className="card center">
              <RoadSign kind={lesson.sign} size={110} />
            </div>
          )}
          <button className="btn ghost sm" onClick={() => setReport(true)}>
            <Flag size={14} /> Report a problem with this lesson
          </button>
        </div>
      </div>

      {selection && (
        <button
          className="btn primary sm"
          style={{ position: 'fixed', left: selection.x, top: selection.y - 44, transform: 'translateX(-50%)', zIndex: 60 }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setQuoteNote({ quote: selection.text, body: '' })
            setSelection(null)
          }}
        >
          <NotebookPen size={14} /> Highlight + note
        </button>
      )}
      {quoteNote && (
        <Modal
          title="Highlight and add a note"
          onClose={() => setQuoteNote(null)}
          footer={
            <>
              <button className="btn" onClick={() => setQuoteNote(null)}>
                Cancel
              </button>
              <button
                className="btn primary"
                onClick={() => {
                  addNote({ userId: me.id, itemId: lesson.id, itemTitle: lesson.title, topicId: lesson.topicId, body: quoteNote.body.trim() || '(highlight)', quote: quoteNote.quote, visibility: 'private' })
                  setQuoteNote(null)
                  window.getSelection()?.removeAllRanges()
                  toast('Highlight saved')
                }}
              >
                Save highlight
              </button>
            </>
          }
        >
          <div className="stack">
            <mark className="hl">“{quoteNote.quote}”</mark>
            <textarea className="input" placeholder="Your note in your own words (optional)" value={quoteNote.body} onChange={(e) => setQuoteNote({ ...quoteNote, body: e.target.value })} autoFocus />
          </div>
        </Modal>
      )}
      {report && (
        <Modal
          title="Report a problem"
          onClose={() => setReport(false)}
          footer={
            <button
              className="btn primary"
              disabled={reason.trim().length < 5}
              onClick={() => {
                reportContent(me.id, 'lesson', lesson.id, reason)
                setReport(false)
                setReason('')
                toast('Thanks — sent to the content team')
              }}
            >
              Send
            </button>
          }
        >
          <textarea className="input" placeholder="What is wrong in this lesson?" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Modal>
      )}
    </div>
  )
}

function AttachmentButton({ lesson, id, kind, got }: { lesson: Lesson; id: string; kind: string; got: boolean }) {
  const me = useMe()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        className="btn sm"
        onClick={() => {
          recordDownload(me.id, id)
          if (kind === 'image') setOpen(true)
          else toast('Downloaded to your device', 'success')
        }}
      >
        <Download size={14} /> {got ? 'Again' : kind === 'image' ? 'View' : 'Download'}
      </button>
      {open && (
        <Modal title="Sign chart" onClose={() => setOpen(false)} wide>
          <div className="grid g4" style={{ gap: 20 }}>
            {(['stop', 'give_way', 'no_entry', 'speed_40', 'roundabout', 'keep_right', 'bend_right', 'school', 'pedestrian', 'slippery', 'no_overtaking', 'priority_road'] as const).map((k) => (
              <div key={k} className="center">
                <RoadSign kind={k} size={lesson.sign === k ? 110 : 80} />
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  )
}

function Block({ n, title, children, cls = '', onWatch, dur }: { n: number; title: string; children: ReactNode; cls?: string; onWatch: (n: number) => void; dur: number }) {
  return (
    <div className={`block ${cls}`}>
      <h3>
        <span className="num-pill">{n}</span> {title}
        <button className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={() => onWatch(n)} title="Watch this part">
          ▶ {fmtTime((n - 1) * (dur / 8))}
        </button>
      </h3>
      {children}
    </div>
  )
}
