import { CheckCircle2, Circle, Lock, PlayCircle, School } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import RoadSign from '../../components/RoadSign'
import { Badge, Bar, Empty, masteryTone, PageHead, Seg } from '../../components/ui'
import VideoPlayer from '../../components/VideoPlayer'
import { lessonLocked } from '../../lib/access'
import { lessonDone, lessonViewed, visibleLessons } from '../../lib/engine'
import { useT } from '../../lib/i18n'
import { fmtTime } from '../../lib/util'
import { useAppState, useMe } from '../../store/store'
import type { Lesson, SignKind } from '../../types'

export function LessonStatus({ lesson }: { lesson: Lesson }) {
  const s = useAppState()
  const me = useMe()
  if (lessonLocked(s, me, lesson)) return <Lock size={16} className="faint" />
  if (lessonDone(s, me.id, lesson.id)) return <CheckCircle2 size={18} color="var(--success)" />
  if (lessonViewed(s, me.id, lesson.id)) return <CheckCircle2 size={18} color="var(--accent)" />
  const p = s.progress[me.id]?.[lesson.id]
  if (p && p.videoPct > 0) return <PlayCircle size={18} color="var(--primary)" />
  return <Circle size={18} className="faint" />
}

export default function Learn() {
  const s = useAppState()
  const me = useMe()
  const t = useT()
  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('all')
  const lessons = visibleLessons(s, me)
  const m = s.mastery[me.id] ?? {}
  const topics = [...s.topics].sort((a, b) => a.order - b.order)
  return (
    <div>
      <PageHead title={t('learn')} sub="Course → Topic → Sub-topic → Lesson. Every level has a video and a text version." />
      <div className="row between wrap mb">
        <Seg
          options={[
            { id: 'all', label: 'All topics' },
            { id: 'todo', label: 'In progress' },
            { id: 'done', label: 'Completed' },
          ]}
          value={filter}
          onChange={setFilter}
        />
        <span className="small muted">
          {lessons.filter((l) => lessonDone(s, me.id, l.id)).length}/{lessons.length} lessons completed
        </span>
      </div>
      <div className="grid g2">
        {topics
          .map((tp) => {
            const tl = lessons.filter((l) => l.topicId === tp.id)
            const done = tl.filter((l) => lessonDone(s, me.id, l.id)).length
            return { tp, tl, done }
          })
          .filter(({ tl, done }) => (filter === 'all' ? true : filter === 'done' ? done === tl.length && tl.length > 0 : done < tl.length))
          .map(({ tp, tl, done }) => (
            <Link key={tp.id} to={`/app/learn/topic/${tp.id}`} className="card hover" style={{ color: 'inherit', textDecoration: 'none' }}>
              <div className="topic-tile">
                <div className="sign-wrap">
                  <RoadSign kind={tp.icon as SignKind} size={46} />
                </div>
                <div className="grow">
                  <div className="row between">
                    <strong>{tp.title}</strong>
                    {tl.some((l) => l.schoolId) && (
                      <Badge tone="info">
                        <School size={11} /> school lesson
                      </Badge>
                    )}
                  </div>
                  <div className="small muted">
                    {done}/{tl.length} lessons · {tp.examWeight}% of the exam · mastery {Math.round(m[tp.id] ?? 0)}%
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Bar value={tl.length ? (done / tl.length) * 100 : 0} thin tone={done === tl.length ? 'success' : undefined} />
                  </div>
                </div>
              </div>
            </Link>
          ))}
      </div>
    </div>
  )
}

export function TopicPage() {
  const { topicId } = useParams()
  const s = useAppState()
  const me = useMe()
  const [mode, setMode] = useState<'video' | 'text'>('video')
  const tp = s.topics.find((x) => x.id === topicId)
  if (!tp) return <Empty title="Topic not found" />
  const lessons = visibleLessons(s, me).filter((l) => l.topicId === tp.id)
  const subs = s.subtopics.filter((x) => x.topicId === tp.id)
  const mastery = Math.round(s.mastery[me.id]?.[tp.id] ?? 0)
  return (
    <div>
      <PageHead
        crumbs={[{ to: '/app/learn', label: 'Lessons' }]}
        title={tp.title}
        sub={`${tp.examWeight}% of the exam · your mastery ${mastery}%`}
        actions={
          <Link className="btn" to={`/app/practice/start/topic?topic=${tp.id}`}>
            Practise this topic
          </Link>
        }
      />
      <div className="grid g-side">
        <div className="card">
          <div className="card-head">
            <h3>Topic introduction</h3>
            <Seg
              options={[
                { id: 'video', label: 'Video' },
                { id: 'text', label: 'Text' },
              ]}
              value={mode}
              onChange={setMode}
            />
          </div>
          {mode === 'video' ? (
            <VideoPlayer scene="road" sign={tp.icon as SignKind} durationSec={90} chapters={[{ title: 'Why this topic matters', text: `${tp.intro.video}. ${tp.intro.text}` }]} />
          ) : (
            <div>
              <h4>What you will be able to do</h4>
              <p>{tp.intro.text}</p>
              <ul className="small muted">
                {subs.map((st) => (
                  <li key={st.id}>{st.title}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="card">
          <h3>Your mastery</h3>
          <div className="row">
            <div className="grow">
              <Bar value={mastery} tone={masteryTone(mastery)} />
            </div>
            <strong>{mastery}%</strong>
          </div>
          <p className="small muted mt">Mastery rises when you answer correctly — faster on harder questions — and drops on mistakes.</p>
        </div>
      </div>
      <div className="stack lg mt">
        {subs.map((st) => {
          const sl = lessons.filter((l) => l.subtopicId === st.id)
          if (!sl.length) return null
          return (
            <div key={st.id} className="card">
              <div className="card-head">
                <div>
                  <h2 style={{ margin: 0 }}>{st.title}</h2>
                  <p className="small muted" style={{ margin: 0 }}>
                    {st.intro.text}
                  </p>
                </div>
              </div>
              <details className="mb">
                <summary className="small linkbtn" style={{ cursor: 'pointer' }}>
                  Sub-topic intro (video + text)
                </summary>
                <div className="mt">
                  <VideoPlayer scene="road" durationSec={75} chapters={[{ title: st.title, text: `${st.intro.video}. ${st.intro.text}` }]} />
                  <p className="mt small">
                    <strong>Summary:</strong> {st.intro.text} Lessons: {sl.map((l) => l.title).join(' · ')}.
                  </p>
                </div>
              </details>
              <div className="list">
                {sl.map((l) => {
                  const locked = lessonLocked(s, me, l)
                  return (
                    <Link key={l.id} to={locked ? '/app/plans' : `/app/learn/lesson/${l.id}`} className="list-item">
                      <LessonStatus lesson={l} />
                      <span className="grow">
                        <strong>{l.title}</strong>
                        <span className="small muted" style={{ display: 'block' }}>
                          {fmtTime(l.durationSec)} video · 5 min read {l.schoolId ? '· from your school' : ''}
                          {locked ? ' · Exam Pass' : ''}
                        </span>
                      </span>
                      {l.sign && <RoadSign kind={l.sign} size={30} />}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
