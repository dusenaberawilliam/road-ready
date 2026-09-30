import { Activity, ArrowRightLeft, Award, Ban, BookOpen, Check, Download, Eye, FileText, Gauge, GitMerge, KeyRound, Plus, RefreshCw, School as SchoolIcon, Search, Timer, Trash2, Users as UsersIcon } from 'lucide-react'
import { useState } from 'react'
import { roleLabel } from '../../components/AppShell'
import { Avatar, Badge, Bar, Bars, Confirm, Empty, Field, masteryTone, Modal, PageHead, Seg, Stat, Tabs, useToast } from '../../components/ui'
import { readiness } from '../../lib/engine'
import { moderationQueue, spaceTitle } from '../../lib/scope'
import { avg, DAY, exportCSV, fmtDate, fmtDateTime, fmtRWF, pct, relTime } from '../../lib/util'
import { confirmBankTransfer, deleteUserData, generateInvoices, logAudit, mergeUsers, moderatePost, replyTicket, resetUserAccess, saveDiscountCode, setSchoolStatus, setUserStatus, toggleDiscountCode, updatePricing } from '../../store/actions'
import { useAppState, useMe } from '../../store/store'
import type { Role, School } from '../../types'

// Cost model per active learner per month (RWF) — hypotheses to validate (§22 KPI: under 25% of revenue).
const COST = { whatsapp: 180, sms: 25, video: 220, hosting: 90 }

export function Metrics() {
  const s = useAppState()
  const learners = s.users.filter((u) => u.role === 'student' || u.role === 'individual')
  const since = (d: number) => learners.filter((u) => Date.now() - new Date(u.lastActive).getTime() < d * DAY).length
  const readinessAll = learners.map((u) => readiness(s, u.id).value)
  const mocks = s.attempts.filter((a) => a.mode === 'mock' && a.submittedAt)
  const confirmed = s.examResults.filter((r) => r.confirmedBy)
  const schoolQs = s.posts.filter((p) => !p.parentId && ['student'].includes(s.users.find((u) => u.id === p.authorId)?.role ?? ''))
  const answered24 = schoolQs.filter((p) => s.posts.some((r) => r.parentId === p.id && s.users.find((u) => u.id === r.authorId)?.role === 'teacher' && new Date(r.createdAt).getTime() - new Date(p.createdAt).getTime() < DAY))
  const month = new Date().toISOString().slice(0, 7)
  const mrr = s.invoices.filter((i) => i.month === month || i.month === '2026-09').reduce((a, i) => a + i.total, 0)
  const passSales = s.payments.filter((p) => p.payerKind === 'learner' && p.status === 'confirmed').reduce((a, p) => a + p.amount, 0)
  const referralFees = s.invoices.reduce((a, i) => a + i.referralFees, 0)
  const conversions = s.enrolmentRequests.filter((r) => r.status === 'accepted').length
  const activeLearners = since(30)
  const costPer = COST.whatsapp + COST.sms + COST.video + COST.hosting
  const revenuePer = activeLearners ? Math.round((mrr + passSales / 2) / activeLearners) : 0
  const lessonsDone = Object.values(s.progress).reduce((a, p) => a + Object.values(p).filter((x) => x.checkPassed).length, 0)
  const watchMin = Object.values(s.progress).reduce((a, p) => a + Object.values(p).reduce((b, x) => b + (x.videoPct / 100) * 4, 0), 0)
  // Anonymised insight: weakest rules by district
  const districts = [...new Set(learners.map((u) => u.district).filter(Boolean))]
  const insight = districts.map((d) => {
    const ls = learners.filter((u) => u.district === d)
    const worst = [...s.topics].map((t) => ({ t, v: avg(ls.map((u) => s.mastery[u.id]?.[t.id] ?? 0)) })).sort((a, b) => a.v - b.v)[0]
    return { district: d, learners: ls.length, weakest_topic: worst.t.title, avg_mastery: Math.round(worst.v) }
  })
  return (
    <div>
      <PageHead title="Platform metrics" sub="Growth, engagement, learning, outcomes, community, revenue and cost." />
      <h3>Growth & engagement</h3>
      <div className="grid g4 mb">
        <Stat icon={<SchoolIcon size={19} />} label="Schools (approved)" value={s.schools.filter((x) => x.status === 'approved').length} delta={`${s.schools.filter((x) => x.status === 'pending').length} pending`} />
        <Stat icon={<UsersIcon size={19} />} label="Learners" value={learners.length} delta={`${learners.filter((u) => u.role === 'individual').length} individual`} />
        <Stat icon={<Activity size={19} />} label="Daily / weekly active" value={`${since(1)} / ${since(7)}`} />
        <Stat icon={<ArrowRightLeft size={19} />} label="Individual → school" value={conversions} delta="accepted referrals" />
      </div>
      <h3>Learning & outcomes</h3>
      <div className="grid g4 mb">
        <Stat icon={<Gauge size={19} />} label="Average readiness" value={`${Math.round(avg(readinessAll))}%`} />
        <Stat icon={<Timer size={19} />} label="Mock pass rate" value={`${pct(mocks.filter((m) => m.passed).length, mocks.length)}%`} delta={`${mocks.length} mocks`} />
        <Stat icon={<Award size={19} />} label="Real exam pass rate (confirmed)" value={`${pct(confirmed.filter((r) => r.passed).length, confirmed.length)}%`} delta={`${confirmed.length} confirmed · KPI: above national average`} tone="success" />
        <Stat icon={<BookOpen size={19} />} label="Lessons completed" value={lessonsDone} delta={`${Math.round(watchMin / 60)} h video watched`} />
      </div>
      <h3>Community, revenue & cost</h3>
      <div className="grid g4 mb">
        <Stat label="Questions answered by teachers < 24 h" value={`${pct(answered24.length, schoolQs.length)}%`} delta={`${schoolQs.length} questions · KPI 80%`} />
        <Stat label="MRR (school invoices)" value={fmtRWF(mrr)} delta={`${fmtRWF(Math.round(mrr / Math.max(1, s.schools.filter((x) => x.status === 'approved').length)))} per school`} />
        <Stat label="Exam Pass sales / referral fees" value={fmtRWF(passSales)} delta={`${fmtRWF(referralFees)} referral fees`} />
        <Stat label="Cost per active learner" value={fmtRWF(costPer)} delta={`${pct(costPer, revenuePer || 1)}% of revenue per learner · KPI < 25%`} tone={costPer / (revenuePer || 1) < 0.25 ? 'success' : 'danger'} />
      </div>
      <div className="grid g2">
        <div className="card">
          <h3>Mastery by topic (all learners)</h3>
          <div className="stack sm">
            {s.topics.map((t) => {
              const v = Math.round(avg(learners.map((u) => s.mastery[u.id]?.[t.id] ?? 0)))
              return (
                <div key={t.id}>
                  <div className="row between small">
                    <span>{t.title}</span>
                    <span className="num">{v}%</span>
                  </div>
                  <Bar value={v} tone={masteryTone(v)} thin />
                </div>
              )
            })}
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <h3>Anonymised insight report (later data product)</h3>
            <button className="btn sm" onClick={() => exportCSV('road-rules-insight-by-district.csv', insight)}>
              <Download size={14} /> Export
            </button>
          </div>
          <p className="small muted">Road rules learners struggle with most, by district. Aggregated, anonymised data only — for RNP road safety, insurers, NGOs.</p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>District</th>
                  <th>Learners</th>
                  <th>Weakest topic</th>
                  <th>Avg</th>
                </tr>
              </thead>
              <tbody>
                {insight.map((r) => (
                  <tr key={r.district}>
                    <td>{r.district}</td>
                    <td className="num">{r.learners}</td>
                    <td className="small">{r.weakest_topic}</td>
                    <td className="num">{r.avg_mastery}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Schools() {
  const s = useAppState()
  const me = useMe()
  const toast = useToast()
  const [tab, setTab] = useState<'pending' | 'approved' | 'suspended'>(s.schools.some((x) => x.status === 'pending') ? 'pending' : 'approved')
  const [view, setView] = useState<School | null>(null)
  const [docs, setDocs] = useState<School | null>(null)
  const list = s.schools.filter((x) => x.status === tab)
  return (
    <div>
      <PageHead title="Schools" sub="Verify documents and approve schools (target: within 24 hours)." />
      <Tabs
        tabs={[
          { id: 'pending', label: `Pending (${s.schools.filter((x) => x.status === 'pending').length})` },
          { id: 'approved', label: 'Approved' },
          { id: 'suspended', label: 'Suspended' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {list.length === 0 ? (
        <Empty title="No schools here" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>School</th>
                <th>TIN · RNP ref.</th>
                <th>Plan</th>
                <th>Students</th>
                <th>Registered</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((x) => (
                <tr key={x.id}>
                  <td>
                    <strong>{x.name}</strong>
                    <div className="tiny faint">
                      {x.district} · {x.phone}
                    </div>
                  </td>
                  <td className="small">
                    {x.tin} · {x.rnpRef}
                  </td>
                  <td>
                    <Badge>{x.plan}</Badge>
                  </td>
                  <td className="num">{s.users.filter((u) => u.schoolId === x.id && u.role === 'student').length}</td>
                  <td className="small muted">{relTime(x.createdAt)}</td>
                  <td className="nowrap">
                    <button className="btn sm ghost" onClick={() => setDocs(x)}>
                      <FileText size={14} /> Documents
                    </button>
                    {x.status !== 'pending' && (
                      <button className="btn sm ghost" onClick={() => (logAudit(me.id, 'school.dashboard.viewed', `${x.name} (read-only)`), setView(x))}>
                        <Eye size={14} /> Dashboard
                      </button>
                    )}
                    {x.status !== 'approved' && (
                      <button className="btn sm primary" onClick={() => (setSchoolStatus(x.id, 'approved', me.id), toast(`${x.name} approved — admin notified on WhatsApp`))}>
                        <Check size={14} /> Approve
                      </button>
                    )}
                    {x.status === 'approved' && (
                      <button className="btn sm" onClick={() => (setSchoolStatus(x.id, 'suspended', me.id), toast(`${x.name} suspended`, 'info'))}>
                        <Ban size={14} /> Suspend
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {docs && (
        <Modal title={`Documents — ${docs.name}`} onClose={() => setDocs(null)}>
          <dl className="kv">
            <dt>TIN</dt>
            <dd>{docs.tin}</dd>
            <dt>RNP authorisation</dt>
            <dd>{docs.rnpRef}</dd>
            <dt>Address</dt>
            <dd>
              {docs.address}, {docs.district}
            </dd>
            <dt>Admin</dt>
            <dd>{s.users.find((u) => u.schoolId === docs.id && u.role === 'school_admin')?.name}</dd>
          </dl>
          <div className="list mt">
            {docs.documents.map((d) => (
              <div key={d} className="list-item small">
                <FileText size={15} /> <span className="grow">{d}</span>
                <Badge tone="success">uploaded</Badge>
              </div>
            ))}
          </div>
        </Modal>
      )}
      {view && (
        <Modal wide title={`${view.name} — read-only view (logged)`} onClose={() => setView(null)}>
          {(() => {
            const st = s.users.filter((u) => u.schoolId === view.id && u.role === 'student')
            const rs = st.map((u) => readiness(s, u.id))
            return (
              <div className="stack">
                <div className="grid g4">
                  <Stat label="Students" value={st.length} />
                  <Stat label="Avg readiness" value={`${Math.round(avg(rs.map((r) => r.value)))}%`} />
                  <Stat label="Exam-ready" value={rs.filter((r) => r.examReady).length} />
                  <Stat label="Pass rate" value={`${view.passRate}%`} />
                </div>
                <div className="table-wrap">
                  <table className="table">
                    <tbody>
                      {st.map((u, i) => (
                        <tr key={u.id}>
                          <td>{u.name}</td>
                          <td className="num">{rs[i].value}%</td>
                          <td className="small muted">{relTime(u.lastActive)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}
        </Modal>
      )}
    </div>
  )
}

export function Users() {
  const s = useAppState()
  const me = useMe()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [role, setRole] = useState<'' | Role>('')
  const [merge, setMerge] = useState<{ keep: string; drop: string } | null>(null)
  const [del, setDel] = useState<string | null>(null)
  const list = s.users.filter((u) => (!role || u.role === role) && (!q || u.phone.includes(q.replace(/^0/, '')) || u.name.toLowerCase().includes(q.toLowerCase()))).slice(0, 60)
  const deletionRequests = s.tickets.filter((t) => t.subject === 'Data deletion request' && t.status === 'open')
  return (
    <div>
      <PageHead title="Users" sub="Search by phone, reset access, merge duplicates, handle data-deletion requests." actions={<button className="btn" onClick={() => setMerge({ keep: '', drop: '' })}><GitMerge size={15} /> Merge duplicates</button>} />
      {deletionRequests.length > 0 && <div className="callout warning mb">{deletionRequests.length} data-deletion request(s) in the support inbox.</div>}
      <div className="row wrap mb">
        <Search size={16} className="faint" />
        <input className="input" style={{ maxWidth: 300 }} placeholder="Phone or name…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" style={{ width: 'auto' }} value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="">All roles</option>
          {Object.entries(roleLabel).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>School</th>
              <th>Status</th>
              <th>Last active</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="row">
                    <Avatar name={u.name || u.phone} size="sm" />
                    <div>
                      <strong className="small">{u.name || '—'}</strong>
                      <div className="tiny faint">{u.phone}</div>
                    </div>
                  </div>
                </td>
                <td className="small">{roleLabel[u.role]}</td>
                <td className="small">{s.schools.find((x) => x.id === u.schoolId)?.name ?? '—'}</td>
                <td>
                  <Badge tone={u.status === 'active' ? 'success' : u.status === 'suspended' ? 'danger' : 'warning'}>{u.status.replace('_', ' ')}</Badge>
                </td>
                <td className="small muted">{relTime(u.lastActive)}</td>
                <td className="nowrap">
                  <button className="btn sm ghost" title="Reset access" onClick={() => (resetUserAccess(u.id, me.id), toast('Access reset — user signs in again with OTP'))}>
                    <KeyRound size={14} />
                  </button>
                  {u.id !== me.id && (
                    <>
                      <button className="btn sm ghost" title={u.status === 'suspended' ? 'Reactivate' : 'Suspend'} onClick={() => (setUserStatus(u.id, u.status === 'suspended' ? 'active' : 'suspended', me.id), toast(u.status === 'suspended' ? 'Reactivated' : 'Suspended', 'info'))}>
                        {u.status === 'suspended' ? <RefreshCw size={14} /> : <Ban size={14} />}
                      </button>
                      <button className="btn sm ghost" title="Delete personal data" onClick={() => setDel(u.id)}>
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {merge && (
        <Modal
          title="Merge duplicate accounts"
          onClose={() => setMerge(null)}
          footer={
            <button className="btn primary" disabled={!merge.keep || !merge.drop || merge.keep === merge.drop} onClick={() => (mergeUsers(merge.keep, merge.drop, me.id), setMerge(null), toast('Accounts merged'))}>
              Merge
            </button>
          }
        >
          <div className="stack">
            <p className="small muted">Attempts, notes, posts and progress move to the account you keep. The best mastery per topic is kept.</p>
            {(['keep', 'drop'] as const).map((k) => (
              <Field key={k} label={k === 'keep' ? 'Keep this account' : 'Merge and remove this account'}>
                <select className="input" value={merge[k]} onChange={(e) => setMerge({ ...merge, [k]: e.target.value })}>
                  <option value="">Choose…</option>
                  {s.users
                    .filter((u) => u.role === 'student' || u.role === 'individual')
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} · {u.phone}
                      </option>
                    ))}
                </select>
              </Field>
            ))}
          </div>
        </Modal>
      )}
      {del && (
        <Confirm
          title="Delete personal data"
          body={`This permanently deletes ${s.users.find((u) => u.id === del)?.name}'s account, notes, attempts and progress. Posts are replaced by "[deleted]". Issued certificates stay verifiable. This is logged.`}
          confirmLabel="Delete permanently"
          danger
          onClose={() => setDel(null)}
          onConfirm={() => (deleteUserData(del, me.id), toast('Personal data deleted', 'info'))}
        />
      )}
    </div>
  )
}

export function Plans() {
  const s = useAppState()
  const me = useMe()
  const toast = useToast()
  const [p, setP] = useState(s.pricing)
  const [code, setCode] = useState({ code: '', percent: 10, description: '' })
  const fields: [keyof typeof p, string][] = [
    ['starterPerStudent', 'Starter — per active student (RWF)'],
    ['starterMaxStudents', 'Starter — max active students'],
    ['proBase', 'Pro — monthly base fee (RWF)'],
    ['proPerStudent', 'Pro — per active student (RWF)'],
    ['examPass', 'Exam Pass price (RWF)'],
    ['examPassDays', 'Exam Pass duration (days)'],
    ['referralFee', 'Referral fee per enrolment (RWF)'],
  ]
  return (
    <div>
      <PageHead title="Plans & discounts" sub="All prices are hypotheses to test in interviews." />
      <div className="grid g2">
        <div className="card stack">
          <h2>Pricing</h2>
          {fields.map(([k, label]) => (
            <Field key={k} label={label}>
              <input className="input" type="number" min={0} value={p[k]} onChange={(e) => setP({ ...p, [k]: Number(e.target.value) })} />
            </Field>
          ))}
          <button className="btn primary" onClick={() => (updatePricing(p, me.id), toast('Pricing updated — applies to next invoices and purchases'))}>
            Save pricing
          </button>
        </div>
        <div className="card stack">
          <h2>Discount codes & free trials</h2>
          <div className="list">
            {s.discountCodes.map((d) => (
              <div key={d.code} className="list-item">
                <code className="bold">{d.code}</code>
                <span className="grow small">
                  {d.percent}% · {d.description} <span className="faint">· used {d.uses}×</span>
                </span>
                <button className="btn sm" onClick={() => toggleDiscountCode(d.code, me.id)}>
                  {d.active ? 'Disable' : 'Enable'}
                </button>
              </div>
            ))}
          </div>
          <div className="grid g3">
            <Field label="Code">
              <input className="input" value={code.code} onChange={(e) => setCode({ ...code, code: e.target.value.toUpperCase().replace(/\s/g, '') })} />
            </Field>
            <Field label="% off">
              <input className="input" type="number" min={1} max={100} value={code.percent} onChange={(e) => setCode({ ...code, percent: Number(e.target.value) })} />
            </Field>
            <Field label="Description">
              <input className="input" value={code.description} onChange={(e) => setCode({ ...code, description: e.target.value })} />
            </Field>
          </div>
          <button className="btn" disabled={code.code.length < 3 || !code.description} onClick={() => (saveDiscountCode(code.code, code.percent, code.description, me.id), setCode({ code: '', percent: 10, description: '' }), toast('Discount code saved'))}>
            <Plus size={15} /> Add code
          </button>
        </div>
      </div>
    </div>
  )
}

export function Finance() {
  const s = useAppState()
  const me = useMe()
  const toast = useToast()
  const [tab, setTab] = useState<'invoices' | 'payments' | 'costs'>('invoices')
  const byStream = [
    { label: 'Schools', value: s.invoices.filter((i) => i.status === 'paid').reduce((a, i) => a + i.total - i.referralFees, 0) },
    { label: 'Exam Pass', value: s.payments.filter((p) => p.payerKind === 'learner' && p.status === 'confirmed').reduce((a, p) => a + p.amount, 0) },
    { label: 'Referrals', value: s.invoices.filter((i) => i.status === 'paid').reduce((a, i) => a + i.referralFees, 0) },
  ]
  const overdue = s.invoices.filter((i) => i.status === 'overdue')
  const pendingTransfers = s.payments.filter((p) => p.status === 'pending')
  const active = s.users.filter((u) => (u.role === 'student' || u.role === 'individual') && Date.now() - new Date(u.lastActive).getTime() < 30 * DAY).length
  const unmatched = s.payments.filter((p) => p.payerKind === 'school' && p.status === 'confirmed' && !s.invoices.some((i) => i.schoolId === p.payerId && `Invoice ${i.month}` === p.purpose && i.status === 'paid'))
  return (
    <div>
      <PageHead
        title="Finance"
        sub="Revenue by stream, invoices, overdue schools, referral payouts and per-learner costs."
        actions={
          <button className="btn" onClick={() => toast(`${generateInvoices(me.id)} invoice(s) generated for ${new Date().toISOString().slice(0, 7)}`)}>
            Generate this month's invoices
          </button>
        }
      />
      <div className="grid g4 mb">
        {byStream.map((b) => (
          <Stat key={b.label} label={`Revenue — ${b.label}`} value={fmtRWF(b.value)} />
        ))}
        <Stat label="Overdue" value={fmtRWF(overdue.reduce((a, i) => a + i.total, 0))} delta={`${overdue.length} invoice(s)`} tone="danger" />
      </div>
      {pendingTransfers.length > 0 && (
        <div className="card mb">
          <h3>Bank transfers to confirm</h3>
          {pendingTransfers.map((p) => (
            <div key={p.id} className="row between small">
              <span>
                {s.schools.find((x) => x.id === p.payerId)?.name} · {p.purpose} · {fmtRWF(p.amount)} · ref {p.reference}
              </span>
              <button className="btn sm primary" onClick={() => (confirmBankTransfer(p.id, me.id), toast('Transfer confirmed, invoice marked paid'))}>
                Confirm receipt
              </button>
            </div>
          ))}
        </div>
      )}
      <Tabs
        tabs={[
          { id: 'invoices', label: 'Invoices' },
          { id: 'payments', label: 'Payments & reconciliation' },
          { id: 'costs', label: 'Costs' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'invoices' && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>School</th>
                <th>Month</th>
                <th>Active</th>
                <th>Referrals</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {[...s.invoices].sort((a, b) => b.month.localeCompare(a.month)).map((i) => (
                <tr key={i.id}>
                  <td>{s.schools.find((x) => x.id === i.schoolId)?.name}</td>
                  <td>{i.month}</td>
                  <td className="num">{i.activeStudents}</td>
                  <td className="num">{i.referralFees ? fmtRWF(i.referralFees) : '—'}</td>
                  <td className="num bold">{fmtRWF(i.total)}</td>
                  <td>
                    <Badge tone={i.status === 'paid' ? 'success' : i.status === 'overdue' ? 'danger' : 'warning'}>{i.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === 'payments' && (
        <div className="stack">
          {unmatched.length > 0 ? <div className="callout warning small">{unmatched.length} gateway transaction(s) not matched to a paid invoice.</div> : <div className="callout success small">All gateway transactions match invoices.</div>}
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Payer</th>
                  <th>Purpose</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {s.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="small">{fmtDateTime(p.createdAt)}</td>
                    <td className="small">{p.payerKind === 'school' ? s.schools.find((x) => x.id === p.payerId)?.name : s.users.find((u) => u.id === p.payerId)?.name}</td>
                    <td className="small">{p.purpose}</td>
                    <td className="small">{p.method}</td>
                    <td className="small num">{p.reference}</td>
                    <td className="num">{fmtRWF(p.amount)}</td>
                    <td>
                      <Badge tone={p.status === 'confirmed' ? 'success' : p.status === 'refunded' ? 'danger' : 'warning'}>{p.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {tab === 'costs' && (
        <div className="grid g2">
          <div className="card">
            <h3>Per active learner / month</h3>
            <Bars data={Object.entries(COST).map(([k, v]) => ({ label: k, value: v }))} format={(v) => `${v}`} />
            <p className="small muted mt">Total {fmtRWF(Object.values(COST).reduce((a, b) => a + b, 0))} × {active} active learners = {fmtRWF(Object.values(COST).reduce((a, b) => a + b, 0) * active)} / month.</p>
          </div>
          <div className="card">
            <h3>Cost drivers</h3>
            <ul className="small muted" style={{ paddingLeft: 18 }}>
              <li>WhatsApp: business-initiated template messages are paid per message; learner-initiated "Quiz" replies within the service window cost less.</li>
              <li>SMS: OTP and critical alerts only.</li>
              <li>Video streaming: 240p/360p default on mobile data, offline downloads.</li>
              <li>Hosting in Rwanda or NCSA-authorised location.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

export function Moderation() {
  const s = useAppState()
  const me = useMe()
  const toast = useToast()
  const queue = moderationQueue(s, me)
  return (
    <div>
      <PageHead title="Moderation overview" sub="Reported and held posts across all schools, for escalation." />
      {queue.length === 0 ? (
        <Empty title="Nothing to moderate" />
      ) : (
        <div className="stack">
          {queue.map((p) => (
            <div key={p.id} className="card">
              <div className="small muted">
                {spaceTitle(s, p.spaceId)} · {s.users.find((u) => u.id === p.authorId)?.name} · {relTime(p.createdAt)}
              </div>
              <div className="bubble mt">{p.body}</div>
              <div className="row between wrap mt">
                <span className="small" style={{ color: 'var(--danger)' }}>
                  {p.status === 'held' ? `Held: ${p.flagReason}` : `Reported: ${p.reports.map((r) => r.reason).join(', ')}`}
                </span>
                <div className="row">
                  <button className="btn sm" onClick={() => (moderatePost(p.id, me.id, p.status === 'held' ? 'approve' : 'dismiss_reports'), toast('Kept'))}>
                    Keep
                  </button>
                  <button className="btn sm danger" onClick={() => (moderatePost(p.id, me.id, 'delete'), toast('Deleted'))}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function Support() {
  const s = useAppState()
  const me = useMe()
  const toast = useToast()
  const [filter, setFilter] = useState<'open' | 'resolved'>('open')
  const [reply, setReply] = useState<Record<string, string>>({})
  const list = s.tickets.filter((t) => t.status === filter)
  return (
    <div>
      <PageHead title="Support inbox" sub="Tickets from schools and learners (WhatsApp and in-app)." />
      <Seg
        options={[
          { id: 'open', label: `Open (${s.tickets.filter((t) => t.status === 'open').length})` },
          { id: 'resolved', label: 'Resolved' },
        ]}
        value={filter}
        onChange={setFilter}
      />
      <div className="stack mt">
        {list.length === 0 ? (
          <Empty title="Inbox zero" />
        ) : (
          list.map((t) => {
            const from = s.users.find((u) => u.id === t.fromId)
            return (
              <div key={t.id} className="card">
                <div className="row between wrap">
                  <div>
                    <strong>{t.subject}</strong>
                    <div className="small muted">
                      {from?.name} ({from ? roleLabel[from.role] : '—'}) · {t.channel === 'whatsapp' ? 'WhatsApp' : 'in-app'} · {relTime(t.createdAt)}
                    </div>
                  </div>
                  <Badge tone={t.status === 'open' ? 'warning' : 'success'}>{t.status}</Badge>
                </div>
                <p className="small mt">{t.body}</p>
                {t.replies.map((r, i) => (
                  <div key={i} className="callout small mb">
                    <strong>{s.users.find((u) => u.id === r.by)?.name}:</strong> {r.body} <span className="faint">· {fmtDate(r.at)}</span>
                  </div>
                ))}
                {t.status === 'open' && (
                  <div className="stack sm">
                    <textarea className="input" rows={2} placeholder="Reply…" value={reply[t.id] ?? ''} onChange={(e) => setReply({ ...reply, [t.id]: e.target.value })} />
                    <div className="row">
                      <button className="btn sm" disabled={!reply[t.id]?.trim()} onClick={() => (replyTicket(t.id, me.id, reply[t.id], false), setReply({ ...reply, [t.id]: '' }), toast('Reply sent'))}>
                        Reply
                      </button>
                      <button className="btn sm primary" onClick={() => (replyTicket(t.id, me.id, reply[t.id] ?? '', true), toast('Resolved'))}>
                        Reply & resolve
                      </button>
                      {t.subject === 'Data deletion request' && from && (
                        <button className="btn sm danger" onClick={() => (deleteUserData(from.id, me.id), replyTicket(t.id, me.id, 'Your data was deleted.', true), toast('Data deleted and ticket resolved', 'info'))}>
                          Delete user data
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export function Audit() {
  const s = useAppState()
  const [q, setQ] = useState('')
  const list = s.audit.filter((a) => !q || `${a.action} ${a.target} ${s.users.find((u) => u.id === a.actorId)?.name}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <div>
      <PageHead
        title="Audit log"
        sub="Certificates issued/revoked, data viewed, role changes and moderation actions."
        actions={
          <button className="btn" onClick={() => exportCSV('audit-log.csv', list.map((a) => ({ at: a.createdAt, actor: s.users.find((u) => u.id === a.actorId)?.name ?? a.actorId, action: a.action, target: a.target })))}>
            <Download size={15} /> Export
          </button>
        }
      />
      <input className="input mb" style={{ maxWidth: 320 }} placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id}>
                <td className="small nowrap">{fmtDateTime(a.createdAt)}</td>
                <td className="small">{s.users.find((u) => u.id === a.actorId)?.name ?? a.actorId}</td>
                <td>
                  <code className="small">{a.action}</code>
                </td>
                <td className="small">{a.target}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
