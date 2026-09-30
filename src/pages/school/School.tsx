import { AlertTriangle, Award, BookOpen, Check, Copy, CreditCard, Download, Eye, Gauge, Megaphone, Plus, Printer, QrCode, Send, ShieldCheck, Trash2, UserPlus, Users, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Badge, Bars, Confirm, Empty, Field, Modal, PageHead, Seg, Stat, Switch, Tabs, useToast } from '../../components/ui'
import { CATEGORIES } from '../../lib/constants'
import { readiness } from '../../lib/engine'
import { DAY, exportCSV, fmtDate, fmtDateTime, fmtRWF, isoDay, relTime, uid } from '../../lib/util'
import { addStaff, decideEnrolment, enrolByPhone, issueCertificate, moveStudent, payInvoice, removeUserFromSchool, revokeCertificate, saveCohort, sendAnnouncement, setLessonStatus, updateSchool, updateUser } from '../../store/actions'
import { useAppState, useMe } from '../../store/store'
import type { Certificate, Cohort, LicenceCategory } from '../../types'
import { verifyUrl } from '../public/Certificate'

function useSchool() {
  const s = useAppState()
  const me = useMe()
  const school = s.schools.find((x) => x.id === me.schoolId)!
  return { s, me, school }
}

const isActive = (lastActive: string) => Date.now() - new Date(lastActive).getTime() < 30 * DAY

// ─── Overview ────────────────────────────────────────────────────────────
export function SchoolOverview() {
  const { s, school } = useSchool()
  const toast = useToast()
  const [poster, setPoster] = useState(false)
  if (!school) return <Empty title="No school linked" />
  const students = s.users.filter((u) => u.schoolId === school.id && u.role === 'student')
  const teachers = s.users.filter((u) => u.schoolId === school.id && u.role === 'teacher' && u.status === 'active')
  const active = students.filter((u) => isActive(u.lastActive))
  const avgReady = students.length ? Math.round(students.reduce((a, u) => a + readiness(s, u.id).value, 0) / students.length) : 0
  const lessonsViewed = students.reduce((a, u) => a + Object.values(s.progress[u.id] ?? {}).filter((p) => p.videoPct >= 90 || p.textRead).length, 0)
  const invite = `${location.origin}/signup?code=${school.code}`
  const overdue = s.invoices.filter((i) => i.schoolId === school.id && i.status === 'overdue')
  const todo = [
    { n: s.enrolmentRequests.filter((r) => r.schoolId === school.id && r.status === 'requested').length, label: 'enrolment requests', to: '/app/school/enrolments' },
    { n: s.lessons.filter((l) => l.schoolId === school.id && l.status === 'in_review').length, label: 'lessons awaiting approval', to: '/app/school/approvals' },
    { n: s.certificates.filter((c) => c.schoolId === school.id && c.status === 'teacher_confirmed').length, label: 'certificates to issue', to: '/app/school/certificates' },
    { n: s.invoices.filter((i) => i.schoolId === school.id && i.status !== 'paid').length, label: 'unpaid invoices', to: '/app/school/billing' },
  ].filter((x) => x.n > 0)

  return (
    <div>
      <PageHead
        title={school.name}
        sub={`${school.district} · ${school.plan === 'pro' ? 'Pro plan' : 'Starter plan'} · RNP ${school.rnpRef}`}
        actions={
          <>
            <button className="btn" onClick={() => setPoster(true)}>
              <QrCode size={15} /> QR poster
            </button>
            <button className="btn" onClick={() => (navigator.clipboard?.writeText(invite), toast('Invite link copied'))}>
              <Copy size={15} /> Invite link
            </button>
          </>
        }
      />
      {school.status === 'pending' && (
        <div className="callout warning mb">
          <strong>Awaiting verification.</strong> The platform team is checking your RDB and RNP documents (target: within 24 hours). You can explore the dashboard, but you cannot enrol real students yet.
        </div>
      )}
      {school.status === 'suspended' && <div className="callout danger mb">Your school is suspended. Contact support.</div>}
      {overdue.length > 0 && (
        <div className="callout danger mb row between wrap">
          <span>
            <AlertTriangle size={15} /> {overdue.length} overdue invoice(s). After the 14-day grace period the dashboard becomes read-only; students keep studying 7 more days.
          </span>
          <Link className="btn sm" to="/app/school/billing">
            Pay now
          </Link>
        </div>
      )}
      <div className="grid g4 mb">
        <Stat icon={<Users size={19} />} label="Active students (30 days)" value={active.length} delta={`${students.length} enrolled`} />
        <Stat icon={<Award size={19} />} label="Pass rate (confirmed)" value={school.confirmedResults ? `${school.passRate}%` : '—'} delta={`${school.confirmedResults} confirmed results`} tone="success" />
        <Stat icon={<Gauge size={19} />} label="Average readiness" value={`${avgReady}%`} />
        <Stat icon={<BookOpen size={19} />} label="Lessons completed" value={lessonsViewed} delta="videos watched or texts read" />
      </div>
      <div className="grid g2">
        <div className="card">
          <h3>To do</h3>
          {todo.length === 0 ? (
            <p className="small muted">All clear 🎉</p>
          ) : (
            <div className="list">
              {todo.map((t) => (
                <Link key={t.label} to={t.to} className="list-item">
                  <Badge tone="warning">{t.n}</Badge>
                  <span className="grow">{t.label}</span>
                  <span className="small">Open →</span>
                </Link>
              ))}
            </div>
          )}
          <h3 className="mt">School code</h3>
          <div className="row">
            <code style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: 2 }}>{school.code}</code>
            <span className="small muted">Students enter this code, scan the QR poster or open the invite link.</span>
          </div>
        </div>
        <div className="card">
          <h3>Teacher activity</h3>
          <div className="list">
            {teachers.map((t) => (
              <div key={t.id} className="list-item">
                <Avatar name={t.name} size="sm" />
                <span className="grow small">
                  <strong>{t.name}</strong>
                  <span className="faint" style={{ display: 'block' }}>
                    {s.cohorts.filter((c) => c.teacherId === t.id).map((c) => c.name.split('—')[0]).join(', ') || 'no class'} · {s.lessons.filter((l) => l.authorId === t.id && l.schoolId === school.id).length} lessons · {s.posts.filter((p) => p.authorId === t.id).length} answers
                  </span>
                </span>
                <span className="tiny faint">{relTime(t.lastActive)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {poster && (
        <Modal title="QR poster" onClose={() => setPoster(false)}>
          <div className="center stack" id="poster">
            <h2 style={{ color: school.color }}>{school.name}</h2>
            <p>Scan to join our class on RoadReady</p>
            <div style={{ background: '#fff', padding: 16, borderRadius: 12, margin: '0 auto' }}>
              <QRCodeSVG value={invite} size={220} fgColor={school.color} />
            </div>
            <p>
              or enter code <strong style={{ fontSize: '1.3rem' }}>{school.code}</strong>
            </p>
            <button className="btn primary no-print" onClick={() => window.print()}>
              <Printer size={15} /> Print poster
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Teachers ────────────────────────────────────────────────────────────
export function Teachers() {
  const { s, me, school } = useSchool()
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const [f, setF] = useState({ name: '', phone: '' })
  const [removing, setRemoving] = useState<string | null>(null)
  const teachers = s.users.filter((u) => u.schoolId === school.id && u.role === 'teacher' && u.status === 'active')
  const cohorts = s.cohorts.filter((c) => c.schoolId === school.id)
  return (
    <div>
      <PageHead
        title="Teachers"
        sub="Add teachers by phone number and assign them to classes."
        actions={
          <button className="btn primary" onClick={() => setAdding(true)}>
            <UserPlus size={15} /> Add teacher
          </button>
        }
      />
      <div className="grid g2">
        {teachers.map((t) => (
          <div key={t.id} className="card">
            <div className="row">
              <Avatar name={t.name} />
              <div className="grow">
                <strong>{t.name}</strong>
                <div className="small muted">
                  {t.phone} · active {relTime(t.lastActive)}
                </div>
              </div>
              <button className="btn ghost icon" onClick={() => setRemoving(t.id)} aria-label="Remove teacher">
                <Trash2 size={15} />
              </button>
            </div>
            <div className="small mt">
              <strong>Classes:</strong> {cohorts.filter((c) => c.teacherId === t.id).map((c) => c.name).join(', ') || 'none'}
            </div>
          </div>
        ))}
      </div>
      <div className="card mt">
        <h3>Assign classes</h3>
        <div className="list">
          {cohorts.map((c) => (
            <div key={c.id} className="list-item">
              <span className="grow small bold">{c.name}</span>
              <select className="input" style={{ width: 240 }} value={c.teacherId} onChange={(e) => (saveCohort({ ...c, teacherId: e.target.value }, me.id), toast('Class assigned'))}>
                <option value="">No teacher</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
      {adding && (
        <Modal
          title="Add a teacher"
          onClose={() => setAdding(false)}
          footer={
            <button
              className="btn primary"
              disabled={f.name.trim().split(' ').length < 2 || !/^(\+?250|0)?7[2389]\d{7}$/.test(f.phone.replace(/\s/g, ''))}
              onClick={() => {
                addStaff(school.id, f.name.trim(), f.phone, 'teacher', me.id)
                toast(`${f.name} added — they sign in with their phone number`)
                setF({ name: '', phone: '' })
                setAdding(false)
              }}
            >
              Add teacher
            </button>
          }
        >
          <div className="stack">
            <Field label="Full name">
              <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
            </Field>
            <Field label="Phone number" hint="They receive an SMS invite and sign in with an OTP.">
              <input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="078…" />
            </Field>
          </div>
        </Modal>
      )}
      {removing && (
        <Confirm
          title="Remove teacher"
          body={`${s.users.find((u) => u.id === removing)?.name} will lose access to the school dashboard. Their lessons stay in the library and their classes need a new teacher.`}
          confirmLabel="Remove"
          danger
          onClose={() => setRemoving(null)}
          onConfirm={() => (removeUserFromSchool(removing, me.id), toast('Teacher removed', 'info'))}
        />
      )}
    </div>
  )
}

// ─── Cohorts & students ──────────────────────────────────────────────────
export function Cohorts() {
  const { s, me, school } = useSchool()
  const toast = useToast()
  const cohorts = s.cohorts.filter((c) => c.schoolId === school.id)
  const teachers = s.users.filter((u) => u.schoolId === school.id && u.role === 'teacher' && u.status === 'active')
  const [edit, setEdit] = useState<Cohort | null>(null)
  const [enrol, setEnrol] = useState<{ cohortId: string; name: string; phone: string; error?: string } | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [sel, setSel] = useState(cohorts[0]?.id ?? '')
  const students = s.users.filter((u) => u.schoolId === school.id && u.role === 'student' && u.cohortId === sel)
  return (
    <div>
      <PageHead
        title="Cohorts & students"
        sub="Classes with start date, licence category, teacher and syllabus."
        actions={
          <>
            <button className="btn" disabled={school.status !== 'approved'} title={school.status !== 'approved' ? 'Available once your school is approved' : undefined} onClick={() => setEnrol({ cohortId: sel, name: '', phone: '' })}>
              <UserPlus size={15} /> Enrol student
            </button>
            <button className="btn primary" onClick={() => setEdit({ id: uid('c'), schoolId: school.id, name: '', category: 'A', startDate: new Date().toISOString(), teacherId: teachers[0]?.id ?? '', hiddenLessonIds: [], lessonOrder: [] })}>
              <Plus size={15} /> New cohort
            </button>
          </>
        }
      />
      <div className="grid g3 mb">
        {cohorts.map((c) => (
          <div key={c.id} className={`card hover ${sel === c.id ? '' : 'flat'}`} style={sel === c.id ? { borderColor: 'var(--primary)' } : undefined} onClick={() => setSel(c.id)}>
            <div className="row between">
              <strong>{c.name}</strong>
              <button className="btn sm ghost" onClick={(e) => (e.stopPropagation(), setEdit(c))}>
                Edit
              </button>
            </div>
            <div className="small muted">
              Category {c.category} · started {fmtDate(c.startDate)}
            </div>
            <div className="small">
              {s.users.filter((u) => u.cohortId === c.id && u.role === 'student').length} students · {s.users.find((u) => u.id === c.teacherId)?.name ?? 'no teacher'}
            </div>
          </div>
        ))}
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Phone</th>
              <th>Readiness</th>
              <th>Last active</th>
              <th>Move to</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {students.map((u) => (
              <tr key={u.id}>
                <td>
                  <Link to={`/app/teacher/students/${u.id}`}>{u.name || '(invited)'}</Link>
                  {u.consent === 'pending' && <Badge tone="warning">consent pending</Badge>}
                </td>
                <td className="small muted">{u.phone}</td>
                <td className="num">{readiness(s, u.id).value}%</td>
                <td className="small muted">{relTime(u.lastActive)}</td>
                <td>
                  <select className="input" style={{ width: 'auto' }} value={u.cohortId} onChange={(e) => (moveStudent(u.id, e.target.value), toast('Student moved'))}>
                    {cohorts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name.split('—')[0]}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <button className="btn ghost icon" onClick={() => setRemoving(u.id)} aria-label="Remove">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && (
        <Modal
          title={cohorts.some((c) => c.id === edit.id) ? 'Edit cohort' : 'New cohort'}
          onClose={() => setEdit(null)}
          footer={
            <button className="btn primary" disabled={edit.name.trim().length < 3} onClick={() => (saveCohort(edit, me.id), setEdit(null), setSel(edit.id), toast('Cohort saved'))}>
              Save
            </button>
          }
        >
          <div className="stack">
            <Field label="Name">
              <input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Cohort C — Motos (Oct 2026)" />
            </Field>
            <div className="grid g2">
              <Field label="Category">
                <select className="input" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value as LicenceCategory })}>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Start date">
                <input className="input" type="date" value={isoDay(edit.startDate)} onChange={(e) => setEdit({ ...edit, startDate: new Date(e.target.value).toISOString() })} />
              </Field>
            </div>
            <Field label="Teacher">
              <select className="input" value={edit.teacherId} onChange={(e) => setEdit({ ...edit, teacherId: e.target.value })}>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Modal>
      )}
      {enrol && (
        <Modal
          title="Enrol a student"
          onClose={() => setEnrol(null)}
          footer={
            <button
              className="btn primary"
              disabled={enrol.name.trim().length < 3 || !/^(\+?250|0)?7[2389]\d{7}$/.test(enrol.phone.replace(/\s/g, ''))}
              onClick={() => {
                const r = enrolByPhone(school.id, enrol.cohortId, enrol.name.trim(), enrol.phone, me.id)
                if (!r.ok) return setEnrol({ ...enrol, error: r.error })
                toast('Student enrolled — WhatsApp invite sent')
                setEnrol(null)
              }}
            >
              Enrol
            </button>
          }
        >
          <div className="stack">
            <Field label="Class">
              <select className="input" value={enrol.cohortId} onChange={(e) => setEnrol({ ...enrol, cohortId: e.target.value })}>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Full name">
              <input className="input" value={enrol.name} onChange={(e) => setEnrol({ ...enrol, name: e.target.value })} />
            </Field>
            <Field label="Phone" error={enrol.error}>
              <input className="input" value={enrol.phone} onChange={(e) => setEnrol({ ...enrol, phone: e.target.value, error: undefined })} placeholder="078…" />
            </Field>
          </div>
        </Modal>
      )}
      {removing && (
        <Confirm
          title="Remove student from school"
          body="They keep their account and study history as an individual learner (free plan). You can re-enrol them later."
          confirmLabel="Remove"
          danger
          onClose={() => setRemoving(null)}
          onConfirm={() => (removeUserFromSchool(removing, me.id), toast('Student removed', 'info'))}
        />
      )}
    </div>
  )
}

// ─── Enrolment requests (marketplace) ────────────────────────────────────
export function Enrolments() {
  const { s, me, school } = useSchool()
  const toast = useToast()
  const cohorts = s.cohorts.filter((c) => c.schoolId === school.id)
  const [cohortFor, setCohortFor] = useState<Record<string, string>>({})
  const reqs = s.enrolmentRequests.filter((r) => r.schoolId === school.id)
  return (
    <div>
      <PageHead title="Enrolment requests" sub={`Learners referred by "Find a school". The referral fee (${fmtRWF(s.pricing.referralFee)}) is added to your next invoice only when you accept.`} />
      {reqs.length === 0 ? (
        <Empty title="No requests yet" />
      ) : (
        <div className="stack">
          {reqs.map((r) => {
            const u = s.users.find((x) => x.id === r.userId)!
            const rd = readiness(s, u.id)
            return (
              <div key={r.id} className="card">
                <div className="row wrap between">
                  <div className="row">
                    <Avatar name={u.name} />
                    <div>
                      <strong>{u.name}</strong>
                      <div className="small muted">
                        {u.phone} · {u.district} · wants category {u.category} · {relTime(r.createdAt)}
                      </div>
                    </div>
                  </div>
                  <Badge tone={r.status === 'accepted' ? 'success' : r.status === 'declined' ? 'danger' : 'warning'}>{r.status}</Badge>
                </div>
                {r.message && <p className="small mt">“{r.message}”</p>}
                <div className="small muted">{r.shareHistory ? `Shares study history: readiness ${rd.value}%, ${rd.mocksPassed} mocks passed, weakest ${s.topics.find((t) => t.id === rd.weakest[0]?.topicId)?.title}.` : 'Did not share study history.'}</div>
                {r.status === 'requested' && (
                  <div className="row wrap mt">
                    <select className="input" style={{ width: 'auto' }} value={cohortFor[r.id] ?? cohorts[0]?.id} onChange={(e) => setCohortFor({ ...cohortFor, [r.id]: e.target.value })}>
                      {cohorts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <button className="btn primary" onClick={() => (decideEnrolment(r.id, true, me.id, cohortFor[r.id] ?? cohorts[0]?.id), toast(`${u.name} enrolled — referral fee added to your invoice`))}>
                      <Check size={15} /> Accept
                    </button>
                    <button className="btn" onClick={() => (decideEnrolment(r.id, false, me.id), toast('Request declined', 'info'))}>
                      <X size={15} /> Decline
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Content approval ────────────────────────────────────────────────────
export function Approvals() {
  const { s, me, school } = useSchool()
  const toast = useToast()
  const pending = s.lessons.filter((l) => l.schoolId === school.id && l.status === 'in_review')
  return (
    <div>
      <PageHead title="Content approval" sub="Teacher-built lessons are checked before students see them (optional setting)." />
      <div className="card row between mb">
        <div>
          <strong>Require approval for teacher content</strong>
          <div className="small muted">When off, teachers publish directly.</div>
        </div>
        <Switch checked={school.requireContentApproval} onChange={(v) => (updateSchool(school.id, { requireContentApproval: v }, me.id), toast(v ? 'Approval required' : 'Teachers publish directly', 'info'))} />
      </div>
      {pending.length === 0 ? (
        <Empty title="Nothing waiting for approval" icon={<ShieldCheck />} />
      ) : (
        <div className="stack">
          {pending.map((l) => (
            <div key={l.id} className="card">
              <div className="row between wrap">
                <div>
                  <strong>{l.title}</strong>
                  <div className="small muted">
                    {s.topics.find((t) => t.id === l.topicId)?.title} · by {s.users.find((u) => u.id === l.authorId)?.name} · {relTime(l.updatedAt)} · {l.legalRef}
                  </div>
                </div>
                <div className="row">
                  <Link className="btn" to={`/app/learn/lesson/${l.id}`}>
                    <Eye size={15} /> Preview
                  </Link>
                  <button className="btn" onClick={() => (setLessonStatus(l.id, 'draft', me.id), toast('Sent back to the teacher', 'info'))}>
                    Request changes
                  </button>
                  <button className="btn primary" onClick={() => (setLessonStatus(l.id, 'published', me.id), toast('Approved and published'))}>
                    <Check size={15} /> Approve
                  </button>
                </div>
              </div>
              <p className="small mt" style={{ marginBottom: 0 }}>
                <strong>Road scene:</strong> {l.blocks.scene}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Certificates (§11) ──────────────────────────────────────────────────
export function Certificates() {
  const { s, me, school } = useSchool()
  const toast = useToast()
  const [tab, setTab] = useState<'queue' | 'register'>('queue')
  const [issuing, setIssuing] = useState<Certificate | null>(null)
  const [nid, setNid] = useState('')
  const [revoking, setRevoking] = useState<Certificate | null>(null)
  const certs = s.certificates.filter((c) => c.schoolId === school.id)
  const queue = certs.filter((c) => c.status === 'teacher_confirmed' || c.status === 'eligible')
  const register = certs.filter((c) => c.status === 'issued' || c.status === 'revoked')
  const name = (c: Certificate) => s.users.find((u) => u.id === c.userId)?.name ?? '—'
  return (
    <div>
      <PageHead
        title="Certificates"
        sub="Two-step approval: the teacher confirms readiness, then you issue. Final format follows the Ministerial Order once published."
        actions={
          <button className="btn" onClick={() => exportCSV('certificate-register.csv', register.map((c) => ({ number: c.number, student: name(c), category: c.category, issued: c.issuedAt?.slice(0, 10), status: c.status, revoked_reason: c.revokedReason ?? '', verify_url: verifyUrl(c.number) })))}>
            <Download size={15} /> Export register
          </button>
        }
      />
      <Tabs
        tabs={[
          { id: 'queue', label: `To issue (${queue.filter((c) => c.status === 'teacher_confirmed').length})` },
          { id: 'register', label: `Register (${register.length})` },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'queue' ? (
        queue.length === 0 ? (
          <Empty title="No certificates waiting" icon={<Award />}>
            Teachers confirm readiness from the exam-ready list.
          </Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Number</th>
                  <th>Lessons</th>
                  <th>Sessions</th>
                  <th>Step</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {queue.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link to={`/app/teacher/students/${c.userId}`}>{name(c)}</Link>
                    </td>
                    <td className="num small">{c.number}</td>
                    <td className="num">{c.lessonsCompleted}</td>
                    <td className="num">{c.sessionsAttended}</td>
                    <td>{c.status === 'teacher_confirmed' ? <Badge tone="success">Confirmed by {s.users.find((u) => u.id === c.confirmedBy)?.name}</Badge> : <Badge tone="warning">Waiting for teacher</Badge>}</td>
                    <td>
                      <button className="btn sm primary" disabled={c.status !== 'teacher_confirmed'} onClick={() => (setIssuing(c), setNid(s.users.find((u) => u.id === c.userId)?.nationalId ?? ''))}>
                        Issue
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Student</th>
                <th>Issued</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {register.map((c) => (
                <tr key={c.id}>
                  <td className="num small">{c.number}</td>
                  <td>{name(c)}</td>
                  <td className="small">{fmtDate(c.issuedAt)}</td>
                  <td>{c.status === 'issued' ? <Badge tone="success">valid</Badge> : <Badge tone="danger" >revoked</Badge>}</td>
                  <td className="nowrap">
                    <Link className="btn sm" to={`/certificate/${c.number}`} target="_blank">
                      View
                    </Link>{' '}
                    {c.status === 'issued' && (
                      <button className="btn sm ghost" onClick={() => setRevoking(c)}>
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {issuing && (
        <Modal
          title={`Issue certificate — ${name(issuing)}`}
          onClose={() => setIssuing(null)}
          footer={
            <button
              className="btn primary"
              disabled={!/^\d{16}$/.test(nid)}
              onClick={async () => {
                updateUser(issuing.userId, { nationalId: nid })
                await issueCertificate(issuing.id, me.id)
                toast(`Certificate ${issuing.number} issued — the learner was notified on WhatsApp`)
                setIssuing(null)
              }}
            >
              <Award size={15} /> Sign and issue
            </button>
          }
        >
          <div className="stack">
            <p className="small">
              Confirmed exam-ready by <strong>{s.users.find((u) => u.id === issuing.confirmedBy)?.name}</strong>. Lessons completed {issuing.lessonsCompleted}, classroom sessions {issuing.sessionsAttended}.
            </p>
            <Field label="Learner's national ID (16 digits)" hint="Stored securely; only the last 4 digits appear on the certificate. Collected only now (data minimisation)." error={nid && !/^\d{16}$/.test(nid) ? 'Enter 16 digits' : undefined}>
              <input className="input" inputMode="numeric" value={nid} onChange={(e) => setNid(e.target.value.replace(/\D/g, '').slice(0, 16))} placeholder="1 2000 8 0012345 6 78" />
            </Field>
            <div className="callout small">Issuing applies the digital signature of the school head and stores an integrity hash. Any change later invalidates it.</div>
          </div>
        </Modal>
      )}
      {revoking && (
        <Confirm
          title={`Revoke ${revoking.number}`}
          body="The public verification page will show this certificate as revoked. This is logged."
          confirmLabel="Revoke"
          danger
          requireText="Written reason (required)"
          onClose={() => setRevoking(null)}
          onConfirm={(reason) => (revokeCertificate(revoking.id, me.id, reason), toast('Certificate revoked', 'info'))}
        />
      )}
    </div>
  )
}

// ─── Billing (§12) ───────────────────────────────────────────────────────
export function Billing() {
  const { s, me, school } = useSchool()
  const toast = useToast()
  const [paying, setPaying] = useState<string | null>(null)
  const [method, setMethod] = useState<'MTN MoMo' | 'Airtel Money' | 'Card' | 'Bank transfer'>('MTN MoMo')
  const [step, setStep] = useState<'choose' | 'approve'>('choose')
  const invoices = s.invoices.filter((i) => i.schoolId === school.id).sort((a, b) => b.month.localeCompare(a.month))
  const payments = s.payments.filter((p) => p.payerId === school.id)
  const activeNow = s.users.filter((u) => u.schoolId === school.id && u.role === 'student' && isActive(u.lastActive)).length
  const p = s.pricing
  const estimate = school.plan === 'pro' ? p.proBase + activeNow * p.proPerStudent : activeNow * p.starterPerStudent
  const inv = invoices.find((i) => i.id === paying)
  return (
    <div>
      <PageHead title="Billing" sub="Monthly invoice on the 1st: base plan + active students (at least one study action in the month). Due in 14 days." />
      <div className="grid g3 mb">
        <div className="card">
          <div className="stat">
            <span className="label">Current plan</span>
            <span className="value">{school.plan === 'pro' ? 'Pro' : 'Starter'}</span>
            <span className="delta">{school.plan === 'pro' ? `${fmtRWF(p.proBase)} base + ${fmtRWF(p.proPerStudent)}/active student` : `${fmtRWF(p.starterPerStudent)}/active student · up to ${p.starterMaxStudents}`}</span>
          </div>
          <button className="btn sm mt" onClick={() => (updateSchool(school.id, { plan: school.plan === 'pro' ? 'starter' : 'pro' }, me.id), toast(`Switched to ${school.plan === 'pro' ? 'Starter' : 'Pro'} from next invoice`))}>
            Switch to {school.plan === 'pro' ? 'Starter' : 'Pro'}
          </button>
        </div>
        <Stat label="Active students this month" value={activeNow} />
        <Stat label="Next invoice (estimate)" value={fmtRWF(estimate)} delta="Tip: bundle the fee inside tuition" />
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Base</th>
              <th>Active students</th>
              <th>Referrals</th>
              <th>Total</th>
              <th>Due</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {invoices.map((i) => (
              <tr key={i.id}>
                <td className="bold">{i.month}</td>
                <td className="num">{fmtRWF(i.basePlan)}</td>
                <td className="num">
                  {i.activeStudents} × {fmtRWF(i.perStudent)}
                </td>
                <td className="num">{i.referralFees ? fmtRWF(i.referralFees) : '—'}</td>
                <td className="num bold">
                  {fmtRWF(i.total)}
                  {i.discount ? <span className="tiny faint"> ({i.discount}% off)</span> : null}
                </td>
                <td className="small">{fmtDate(i.dueAt)}</td>
                <td>
                  <Badge tone={i.status === 'paid' ? 'success' : i.status === 'overdue' ? 'danger' : 'warning'}>{i.status}</Badge>
                </td>
                <td>
                  {i.status !== 'paid' ? (
                    payments.some((x) => x.purpose === `Invoice ${i.month}` && x.status === 'pending') ? (
                      <Badge>transfer pending</Badge>
                    ) : (
                      <button className="btn sm primary" onClick={() => (setPaying(i.id), setStep('choose'))}>
                        <CreditCard size={14} /> Pay
                      </button>
                    )
                  ) : (
                    <span className="tiny faint">{i.method}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="tiny faint mt">EBM/VAT-compliant invoices. Referral fees are added when you accept a referred learner.</p>
      {inv && (
        <Modal title={`Pay invoice ${inv.month} — ${fmtRWF(inv.total)}`} onClose={() => setPaying(null)}>
          {step === 'choose' ? (
            <div className="stack">
              <Seg
                options={[
                  { id: 'MTN MoMo', label: 'MTN MoMo' },
                  { id: 'Airtel Money', label: 'Airtel Money' },
                  { id: 'Card', label: 'Card' },
                  { id: 'Bank transfer', label: 'Bank transfer' },
                ]}
                value={method}
                onChange={setMethod}
              />
              {method === 'Bank transfer' ? (
                <div className="callout small">
                  Transfer to Bank of Kigali · account 00040-0691234-56 · reference <strong>{school.code}-{inv.month}</strong>. The platform team confirms receipt manually.
                </div>
              ) : method === 'Card' ? (
                <Field label="Card">
                  <input className="input" placeholder="4242 4242 4242 4242 · 12/28 · 123" />
                </Field>
              ) : (
                <Field label="Mobile money number">
                  <input className="input" defaultValue={school.phone.replace('+250', '0')} />
                </Field>
              )}
              <button className="btn primary" onClick={() => (method === 'MTN MoMo' || method === 'Airtel Money' ? setStep('approve') : (payInvoice(inv.id, method, me.id), setPaying(null), toast(method === 'Bank transfer' ? 'Transfer declared — awaiting confirmation' : 'Invoice paid')))}>
                {method === 'Bank transfer' ? 'I have made the transfer' : `Pay ${fmtRWF(inv.total)}`}
              </button>
            </div>
          ) : (
            <div className="stack center">
              <p>Approve the request on the phone ({method}).</p>
              <button className="btn primary" onClick={() => (payInvoice(inv.id, method, me.id), setPaying(null), toast('Payment confirmed — receipt sent by email'))}>
                Simulate approval
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

// ─── Branding ────────────────────────────────────────────────────────────
export function Branding() {
  const { me, school } = useSchool()
  const toast = useToast()
  const [color, setColor] = useState(school.color)
  const [name, setName] = useState(school.name)
  const [schedule, setSchedule] = useState(school.schedule)
  const initials = name.split(' ').map((w) => w[0]).slice(0, 3).join('')
  return (
    <div>
      <PageHead title="Branding" sub="Your logo and colours appear on certificates, WhatsApp messages and the student app header." />
      <div className="grid g2">
        <div className="card stack">
          <Field label="Display name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Brand colour">
            <div className="row">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 60, height: 40, border: 0, background: 'none' }} />
              {['#0277B5', '#1d4ed8', '#b45309', '#7c3aed', '#be123c', '#15803d'].map((c) => (
                <button key={c} onClick={() => setColor(c)} style={{ width: 28, height: 28, borderRadius: 99, background: c, border: color === c ? '3px solid var(--text)' : '0', cursor: 'pointer' }} aria-label={c} />
              ))}
            </div>
          </Field>
          <Field label="Logo">
            <input type="file" accept="image/*" onChange={() => toast('Logo uploaded (demo uses your initials)', 'info')} />
          </Field>
          <Field label="Schedule shown to learners">
            <input className="input" value={schedule} onChange={(e) => setSchedule(e.target.value)} />
          </Field>
          <button className="btn primary" onClick={() => (updateSchool(school.id, { color, name, schedule }, me.id), toast('Branding saved'))}>
            Save branding
          </button>
        </div>
        <div className="stack">
          <div className="card">
            <h3>Student app header</h3>
            <div className="row" style={{ padding: 12, borderRadius: 10, border: '1px solid var(--border)' }}>
              <span className="avatar" style={{ background: color, color: '#fff' }}>
                {initials}
              </span>
              <strong>{name}</strong>
            </div>
          </div>
          <div className="card">
            <h3>WhatsApp message</h3>
            <div className="wa-msg in" style={{ maxWidth: '100%' }}>
              <b>{name}</b>
              <br />
              Muraho Aline! Practical session this Thursday 17:00 at the yard. Finish the Priority rules drill before then.
            </div>
          </div>
          <div className="card" style={{ borderTop: `8px solid ${color}` }}>
            <h3>Certificate</h3>
            <div className="small muted">Border and logo use your brand colour.</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Reports ─────────────────────────────────────────────────────────────
export function Reports() {
  const { s, school } = useSchool()
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const students = s.users.filter((u) => u.schoolId === school.id && u.role === 'student')
  const inMonth = (iso?: string) => !!iso && iso.slice(0, 7) === month
  const active = students.filter((u) => (s.studyDays[u.id] ?? []).some((d) => d.slice(0, 7) === month))
  const mocks = s.attempts.filter((a) => a.mode === 'mock' && inMonth(a.submittedAt) && students.some((u) => u.id === a.userId))
  const results = s.examResults.filter((r) => inMonth(r.date) && r.confirmedBy && students.some((u) => u.id === r.userId))
  const certs = s.certificates.filter((c) => c.schoolId === school.id && inMonth(c.issuedAt))
  const rows = students.map((u) => {
    const r = readiness(s, u.id)
    return { student: u.name, cohort: s.cohorts.find((c) => c.id === u.cohortId)?.name ?? '', readiness: r.value, status: r.label, mocks_passed: r.mocksPassed, study_days: (s.studyDays[u.id] ?? []).filter((d) => d.slice(0, 7) === month).length, attended: s.attendance.filter((a) => a.present.includes(u.id) && a.date.slice(0, 7) === month).length }
  })
  const months = Array.from({ length: 4 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (3 - i))
    return d.toISOString().slice(0, 7)
  })
  return (
    <div>
      <PageHead
        title="Monthly report"
        sub="Students, readiness and pass rate — viewable online and exportable for owners or RNP inspection."
        actions={
          <>
            <input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: 'auto' }} />
            <button className="btn" onClick={() => exportCSV(`${school.code}-report-${month}.csv`, rows)}>
              <Download size={15} /> Excel/CSV
            </button>
            <button className="btn" onClick={() => window.print()}>
              <Printer size={15} /> Print
            </button>
          </>
        }
      />
      <div className="grid g4 mb">
        <Stat label="Active students" value={`${active.length}/${students.length}`} />
        <Stat label="Mock exams taken" value={mocks.length} delta={`${mocks.filter((m) => m.passed).length} passed`} />
        <Stat label="Confirmed exam results" value={results.length} delta={`${results.filter((r) => r.passed).length} passed`} />
        <Stat label="Certificates issued" value={certs.length} />
      </div>
      <div className="card mb">
        <h3>Active students by month</h3>
        <Bars data={months.map((m) => ({ label: m.slice(5), value: students.filter((u) => (s.studyDays[u.id] ?? []).some((d) => d.slice(0, 7) === m)).length }))} />
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {Object.keys(rows[0] ?? { student: 1 }).map((k) => (
                <th key={k}>{k.replace('_', ' ')}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.student}>
                {Object.values(r).map((v, i) => (
                  <td key={i} className={typeof v === 'number' ? 'num' : ''}>
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Announcements ───────────────────────────────────────────────────────
export function Announcements() {
  const { s, me, school } = useSchool()
  const toast = useToast()
  const [body, setBody] = useState('')
  const [target, setTarget] = useState('')
  const cohorts = s.cohorts.filter((c) => c.schoolId === school.id)
  const sent = s.posts.filter((p) => p.pinned && (p.spaceId === `school:${school.id}` || cohorts.some((c) => p.spaceId === `class:${c.id}`)) && ['school_admin', 'teacher'].includes(s.users.find((u) => u.id === p.authorId)?.role ?? '')).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return (
    <div>
      <PageHead title="Announcements" sub="Sent on WhatsApp through the platform and pinned on the board." />
      <div className="grid g-side">
        <div className="card stack">
          <Field label="To">
            <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Whole school</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Message" hint={`${body.length}/500 · approved template · respects quiet hours`}>
            <textarea className="input" rows={5} maxLength={500} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Our office is closed on Monday for Heroes' Day…" />
          </Field>
          <button className="btn primary" disabled={body.trim().length < 5} onClick={() => (sendAnnouncement(school.id, me.id, body.trim(), target || undefined), setBody(''), toast('Announcement sent'))}>
            <Send size={15} /> Send announcement
          </button>
        </div>
        <div className="card">
          <h3>
            <Megaphone size={17} /> Sent
          </h3>
          <div className="list">
            {sent.map((p) => (
              <div key={p.id} className="list-item small" style={{ alignItems: 'flex-start' }}>
                <div>
                  {p.body}
                  <div className="tiny faint">
                    {p.spaceId.startsWith('class:') ? cohorts.find((c) => p.spaceId === `class:${c.id}`)?.name : 'Whole school'} · {fmtDateTime(p.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
