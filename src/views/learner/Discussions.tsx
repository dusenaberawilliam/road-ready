import { BookOpen, HelpCircle, MessagesSquare, School, Users } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import Thread from '../../components/Thread'
import { Empty, PageHead } from '../../components/ui'
import { canModerateSpace, spaceSchoolId, spaceTitle } from '../../lib/scope'
import { relTime } from '../../lib/util'
import { useAppState, useMe } from '../../store/store'

export default function Discussions() {
  const s = useAppState()
  const me = useMe()
  if (!me.schoolId) return <Empty title="Discussions are for school students">Individual learner community is coming later.</Empty>
  const spaces = [
    { id: `class:${me.cohortId}`, icon: <Users size={18} />, title: 'Class board', sub: s.cohorts.find((c) => c.id === me.cohortId)?.name },
    { id: `school:${me.schoolId}`, icon: <School size={18} />, title: 'School board', sub: s.schools.find((x) => x.id === me.schoolId)?.name },
  ]
  const lessonSpaces = [...new Set(s.posts.filter((p) => p.status === 'visible' && (p.spaceId.startsWith('lesson:') || p.spaceId.startsWith('question:')) && p.spaceId.endsWith(`:${me.schoolId}`)).map((p) => p.spaceId))]
  const last = (id: string) => s.posts.filter((p) => p.spaceId === id && p.status === 'visible').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  const count = (id: string) => s.posts.filter((p) => p.spaceId === id && p.status === 'visible').length
  return (
    <div>
      <PageHead title="Discussions" sub="Threaded Q&A moderated by your teachers. Only members of your school see these spaces." />
      <div className="grid g2">
        {spaces.map((sp) => (
          <Link key={sp.id} to={`/app/discussions/${encodeURIComponent(sp.id)}`} className="card hover" style={{ color: 'inherit', textDecoration: 'none' }}>
            <div className="row">
              <span className="plan-icon" style={{ background: 'var(--primary-soft)', color: 'var(--primary-text)' }}>
                {sp.icon}
              </span>
              <div className="grow">
                <strong>{sp.title}</strong>
                <div className="small muted">{sp.sub}</div>
              </div>
              <span className="badge">{count(sp.id)} posts</span>
            </div>
            {last(sp.id) && <p className="small muted mt ellipsis">Latest: “{last(sp.id).body}” · {relTime(last(sp.id).createdAt)}</p>}
          </Link>
        ))}
      </div>
      <div className="card mt">
        <h2>Lesson and question threads</h2>
        {lessonSpaces.length === 0 ? (
          <Empty title="No lesson discussions yet" icon={<MessagesSquare />} />
        ) : (
          <div className="list">
            {lessonSpaces.map((id) => (
              <Link key={id} to={id.startsWith('lesson:') ? `/app/learn/lesson/${id.split(':')[1]}#comments` : `/app/discussions/${encodeURIComponent(id)}`} className="list-item">
                {id.startsWith('lesson:') ? <BookOpen size={17} className="faint" /> : <HelpCircle size={17} className="faint" />}
                <span className="grow">
                  <strong className="small">{spaceTitle(s, id)}</strong>
                  <span className="small muted" style={{ display: 'block' }}>
                    {count(id)} posts · {relTime(last(id).createdAt)}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function SpacePage() {
  const { spaceId = '' } = useParams()
  const s = useAppState()
  const me = useMe()
  const id = decodeURIComponent(spaceId)
  const schoolId = spaceSchoolId(s, id)
  const kind = id.split(':')[0]
  const member = me.role === 'super_admin' || (schoolId && schoolId === me.schoolId && (kind !== 'teachers' || me.role !== 'student'))
  const inClass = kind !== 'class' || me.role !== 'student' || id === `class:${me.cohortId}`
  if (!member || !inClass) return <Empty title="You are not a member of this space" />
  const [, qid] = id.split(':')
  const question = kind === 'question' ? s.questions.find((q) => q.id === qid) : undefined
  return (
    <div className="content narrow" style={{ padding: 0 }}>
      <PageHead crumbs={[{ to: me.role === 'student' ? '/app/discussions' : '/app/teacher/discussions', label: 'Discussions' }]} title={spaceTitle(s, id)} sub={kind === 'teachers' ? 'Staff coordination — students cannot see this room.' : 'Be kind, stay on topic, no phone numbers or links.'} />
      {question && (
        <div className="card mb">
          <strong>{question.prompt}</strong>
          <p className="small muted" style={{ margin: '6px 0 0' }}>
            Correct answer: {question.correct.map((c) => question.options[c]).join(', ')} — {question.explanation}
          </p>
        </div>
      )}
      <div className="card">
        <Thread spaceId={id} canModerate={canModerateSpace(s, me, id)} />
      </div>
    </div>
  )
}
