import { Award, CheckCircle2, Circle, Copy, CreditCard, MapPin, Printer, Share2, Smartphone, Star } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge, Empty, Field, Modal, PageHead, Seg, useToast } from '../../components/ui'
import { hasExamPass } from '../../lib/access'
import { readiness } from '../../lib/engine'
import { langNames } from '../../lib/i18n'
import { DAY, fmtDate, fmtRWF } from '../../lib/util'
import { buyExamPass, requestEnrolment, requestRefund } from '../../store/actions'
import { useAppState, useMe } from '../../store/store'
import type { Lang, LicenceCategory } from '../../types'
import { CertificateDoc, verifyUrl } from '../public/Certificate'

// ─── Student certificate (§11) ───────────────────────────────────────────
export function MyCertificate() {
  const s = useAppState()
  const me = useMe()
  const toast = useToast()
  const c = s.certificates.find((x) => x.userId === me.id && x.status !== 'eligible') ?? s.certificates.find((x) => x.userId === me.id)
  const r = readiness(s, me.id)
  const lessonsDone = Object.values(s.progress[me.id] ?? {}).filter((p) => p.checkPassed).length
  const reqs = [
    { ok: lessonsDone >= r.lessonsTotal, label: `All lessons completed (${lessonsDone}/${r.lessonsTotal})` },
    { ok: r.mocksPassed >= 2, label: `At least 2 mock exams passed (${r.mocksPassed})` },
    { ok: r.value >= 80, label: `Readiness 80%+ (${r.value}%)` },
    { ok: s.tests.filter((t) => t.cohortId === me.cohortId && t.countsForCertificate).every((t) => s.attempts.some((a) => a.testId === t.id && a.userId === me.id && a.passed)), label: 'School exam passed' },
    { ok: false, label: 'Minimum training period (set by the Ministerial Order — pending)' },
    { ok: !!c && c.status !== 'eligible', label: 'Teacher confirms readiness' },
  ]
  return (
    <div>
      <PageHead title="My certificate" sub="Your school issues the certificate. It is verifiable online by QR code." />
      {c?.status === 'issued' ? (
        <div className="stack lg">
          <div className="row wrap no-print">
            <button className="btn" onClick={() => window.print()}>
              <Printer size={16} /> Print / download
            </button>
            <button className="btn" onClick={() => (navigator.clipboard?.writeText(verifyUrl(c.number)), toast('Verification link copied'))}>
              <Copy size={16} /> Copy link
            </button>
            <a className="btn" href={`https://wa.me/?text=${encodeURIComponent(`My certificate from ${s.schools.find((x) => x.id === c.schoolId)?.name}: ${verifyUrl(c.number)}`)}`} target="_blank" rel="noreferrer">
              <Share2 size={16} /> Share on WhatsApp
            </a>
          </div>
          <CertificateDoc c={c} />
        </div>
      ) : c?.status === 'revoked' ? (
        <div className="callout danger">Your certificate {c.number} was revoked: {c.revokedReason}. Contact your school.</div>
      ) : (
        <div className="grid g2">
          <div className="card">
            <div className="row">
              <Award size={22} color="var(--primary)" />
              <h2 style={{ margin: 0 }}>{c?.status === 'teacher_confirmed' ? 'Confirmed by your teacher' : 'Not issued yet'}</h2>
            </div>
            <p className="muted small mt">{c?.status === 'teacher_confirmed' ? 'Your school admin will issue your certificate shortly. You will get a WhatsApp message.' : 'When you meet your school\'s rules, your teacher confirms you and the school admin issues the certificate (two-step approval).'}</p>
            <div className="stack sm">
              {reqs.map((x) => (
                <div key={x.label} className="row small">
                  {x.ok ? <CheckCircle2 size={17} color="var(--success)" /> : <Circle size={17} className="faint" />} {x.label}
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h3>What the certificate shows</h3>
            <ul className="small muted" style={{ paddingLeft: 18 }}>
              <li>School name, logo, RNP authorisation reference</li>
              <li>Your name, date of birth, licence category; only the last 4 digits of your national ID</li>
              <li>Training dates, lessons completed, sessions attended</li>
              <li>Unique number, digital signature and QR code for public verification</li>
            </ul>
            <Link to="/verify/KSD-2026-000127" className="small">
              See an example verification page →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Exam Pass purchase (§3, §12) ────────────────────────────────────────
export function Plans() {
  const s = useAppState()
  const me = useMe()
  const toast = useToast()
  const [buying, setBuying] = useState(false)
  const [step, setStep] = useState<'form' | 'approve' | 'done'>('form')
  const [method, setMethod] = useState<'MTN MoMo' | 'Airtel Money' | 'Card'>('MTN MoMo')
  const [phone, setPhone] = useState(me.phone.replace('+250', '0'))
  const [code, setCode] = useState('')
  const [pin, setPin] = useState('')
  const dc = code ? s.discountCodes.find((d) => d.code === code.toUpperCase() && d.active) : undefined
  const price = Math.round(s.pricing.examPass * (1 - (dc?.percent ?? 0) / 100))
  const active = hasExamPass(me)
  const mocks = s.attempts.filter((a) => a.userId === me.id && a.mode === 'mock' && a.submittedAt).length
  const payment = s.payments.find((p) => p.payerId === me.id && p.purpose.startsWith('Exam Pass') && p.status === 'confirmed')
  const refundable = payment && (Date.now() - new Date(payment.createdAt).getTime()) / DAY <= 7 && mocks < 2
  const rows: [string, boolean, boolean][] = [
    ['Lessons (video + text)', true, true],
    ['All lessons', false, true],
    ['Daily quiz & tip of the day', true, true],
    ['Mock exams', true, true],
    ['Unlimited mocks', false, true],
    ['Notes & attachments', false, true],
    ['Readiness score', true, true],
    ['Weak-topic drills & topic practice', false, true],
    ['Teacher & certificate', false, false],
  ]

  if (me.role === 'student')
    return (
      <Empty title="Included by your school">
        Your school plan includes everything in the Exam Pass. <Link to="/app/home">Back home</Link>
      </Empty>
    )

  return (
    <div>
      <PageHead title="Exam Pass" sub="Prepare alone at your own pace. When you need a certificate, join a partner school." />
      {active && (
        <div className="callout success row between wrap mb">
          <span>
            <CheckCircle2 size={16} /> <strong>Exam Pass active</strong> until {fmtDate(me.examPassUntil)}.
          </span>
          {refundable && (
            <button
              className="btn sm"
              onClick={() => {
                const r = requestRefund(me.id)
                toast(r.ok ? 'Refund sent to your mobile money account' : r.error!, r.ok ? 'success' : 'error')
              }}
            >
              Request refund (7-day window)
            </button>
          )}
        </div>
      )}
      <div className="grid g2">
        <div className="card">
          <h2>Free</h2>
          <div className="stat">
            <span className="value">RWF 0</span>
          </div>
          <p className="small muted">Limited lessons, daily practice and 1 mock exam.</p>
          {!active && <Badge tone="primary">Your plan</Badge>}
        </div>
        <div className="card" style={{ borderColor: 'var(--primary)', borderWidth: 2 }}>
          <div className="row between">
            <h2>Exam Pass</h2>
            <Badge tone="success">Best for the exam</Badge>
          </div>
          <div className="stat">
            <span className="value">{fmtRWF(s.pricing.examPass)}</span>
            <span className="delta">one-off · {s.pricing.examPassDays} days</span>
          </div>
          <p className="small muted">All lessons, notes, unlimited mocks, readiness score and weak-topic drills. No teacher and no certificate.</p>
          <button className="btn primary block" disabled={active} onClick={() => (setBuying(true), setStep('form'))}>
            <CreditCard size={16} /> {active ? 'Active' : 'Get the Exam Pass'}
          </button>
        </div>
      </div>
      <div className="table-wrap mt">
        <table className="table">
          <thead>
            <tr>
              <th>Feature</th>
              <th>Free</th>
              <th>Exam Pass</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([f, a, b]) => (
              <tr key={f}>
                <td>{f}</td>
                <td>{a ? '✓' : '—'}</td>
                <td>{b ? '✓' : f.startsWith('Teacher') ? 'via a partner school' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted mt">Refund within 7 days if you took fewer than 2 mock exams.</p>

      {buying && (
        <Modal title="Get the Exam Pass" onClose={() => setBuying(false)}>
          {step === 'form' && (
            <div className="stack">
              <Field label="Pay with">
                <Seg
                  options={[
                    { id: 'MTN MoMo', label: 'MTN MoMo' },
                    { id: 'Airtel Money', label: 'Airtel Money' },
                    { id: 'Card', label: 'Card' },
                  ]}
                  value={method}
                  onChange={setMethod}
                />
              </Field>
              {method === 'Card' ? (
                <div className="grid g2">
                  <Field label="Card number">
                    <input className="input" placeholder="4242 4242 4242 4242" />
                  </Field>
                  <Field label="Expiry / CVC">
                    <input className="input" placeholder="12/28 · 123" />
                  </Field>
                </div>
              ) : (
                <Field label="Mobile money number">
                  <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </Field>
              )}
              <Field label="Discount code" hint={dc ? `${dc.percent}% off — ${dc.description}` : 'Try RENTREE10'} error={code && !dc ? 'Invalid code' : undefined}>
                <input className="input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
              </Field>
              <div className="row between">
                <span>Total</span>
                <strong style={{ fontSize: '1.3rem' }}>{fmtRWF(price)}</strong>
              </div>
              <button
                className="btn primary lg"
                onClick={() => {
                  if (method !== 'Card') return setStep('approve')
                  buyExamPass(me.id, 'Card', dc?.code)
                  setStep('done')
                }}
              >
                Pay {fmtRWF(price)}
              </button>
              {method === 'Card' && <span className="tiny faint">Card payments are processed by the payment gateway.</span>}
            </div>
          )}
          {step === 'approve' && (
            <div className="stack center">
              <Smartphone size={42} style={{ margin: '0 auto' }} color="var(--primary)" />
              <h3>Approve on your phone</h3>
              <p className="small muted">
                A payment request of {fmtRWF(price)} was sent to {phone}. Enter your {method} PIN on your phone to approve.
              </p>
              <div className="callout small" style={{ textAlign: 'left', fontFamily: 'monospace' }}>
                *182# — RoadReady requests {price} RWF.
                <br />
                Enter PIN to confirm:
                <input className="input mt" type="password" maxLength={5} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="•••••" />
              </div>
              <button
                className="btn primary"
                disabled={pin.length < 4}
                onClick={() => {
                  buyExamPass(me.id, method, dc?.code)
                  setStep('done')
                }}
              >
                Simulate approval
              </button>
            </div>
          )}
          {step === 'done' && (
            <div className="stack center">
              <CheckCircle2 size={48} style={{ margin: '0 auto' }} color="var(--success)" />
              <h3>Exam Pass activated</h3>
              <p className="small muted">All lessons, drills and unlimited mocks are unlocked. A receipt was sent on WhatsApp.</p>
              <Link className="btn primary" to="/app/home" onClick={() => setBuying(false)}>
                Start studying
              </Link>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

// ─── Find-a-school marketplace (§10) ─────────────────────────────────────
export function FindSchool() {
  const s = useAppState()
  const me = useMe()
  const navigate = useNavigate()
  const [f, setF] = useState<{ district: string; category: '' | LicenceCategory; maxPrice: number; lang: '' | Lang }>({ district: '', category: '', maxPrice: 300000, lang: '' })
  const r = readiness(s, me.id)
  const list = s.schools
    .filter((x) => x.status === 'approved' && x.partner)
    .filter((x) => (!f.district || x.district === f.district) && (!f.category || x.categories.includes(f.category)) && x.tuition[0] <= f.maxPrice && (!f.lang || x.languages.includes(f.lang)))
    .sort((a, b) => Number(b.district === me.district) - Number(a.district === me.district) || b.rating - a.rating || b.passRate - a.passRate)
  const pending = s.enrolmentRequests.filter((x) => x.userId === me.id)
  return (
    <div>
      <PageHead title="Find a school" sub="Partner schools only. Ranked by distance, then rating, then pass rate — no paid ranking." />
      {r.value >= 70 && <div className="callout success mb">You're at {r.value}% readiness — a great time to join a school for practical lessons and your certificate.</div>}
      {pending.map((p) => (
        <div key={p.id} className={`callout mb ${p.status === 'accepted' ? 'success' : p.status === 'declined' ? 'danger' : 'info'}`}>
          Request to <strong>{s.schools.find((x) => x.id === p.schoolId)?.name}</strong>: {p.status === 'requested' ? 'waiting for the school' : p.status}
        </div>
      ))}
      <div className="card mb">
        <div className="grid g4">
          <Field label="District">
            <select className="input" value={f.district} onChange={(e) => setF({ ...f, district: e.target.value })}>
              <option value="">Any</option>
              {[...new Set(s.schools.map((x) => x.district))].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </Field>
          <Field label="Category">
            <select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as LicenceCategory })}>
              <option value="">Any</option>
              {['A', 'B', 'C', 'D'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label={`Tuition from ≤ ${fmtRWF(f.maxPrice)}`}>
            <input type="range" min={80000} max={300000} step={10000} value={f.maxPrice} onChange={(e) => setF({ ...f, maxPrice: Number(e.target.value) })} />
          </Field>
          <Field label="Language">
            <select className="input" value={f.lang} onChange={(e) => setF({ ...f, lang: e.target.value as Lang })}>
              <option value="">Any</option>
              {(['rw', 'en', 'fr'] as Lang[]).map((l) => (
                <option key={l} value={l}>
                  {langNames[l]}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>
      {list.length === 0 ? (
        <Empty title="No schools match these filters" />
      ) : (
        <div className="grid g2">
          {list.map((x) => (
            <div key={x.id} className="card hover" onClick={() => navigate(`/app/schools/${x.id}`)}>
              <div className="row">
                <span className="avatar lg" style={{ background: x.color, color: '#fff' }}>
                  {x.name.split(' ').map((w) => w[0]).slice(0, 3).join('')}
                </span>
                <div className="grow">
                  <strong>{x.name}</strong>
                  <div className="small muted">
                    <MapPin size={12} /> {x.district} {x.district === me.district && <Badge tone="primary">near you</Badge>}
                  </div>
                  <div className="row small" style={{ gap: 12 }}>
                    <span>
                      <Star size={12} fill="var(--accent)" color="var(--accent)" /> {x.rating} ({x.reviews})
                    </span>
                    <span>{x.confirmedResults >= 20 ? `${x.passRate}% pass rate` : 'Pass rate shown after 20 results'}</span>
                  </div>
                </div>
              </div>
              <div className="row wrap small mt">
                <Badge>Categories {x.categories.join(', ')}</Badge>
                <Badge>
                  {fmtRWF(x.tuition[0])}–{x.tuition[1].toLocaleString()}
                </Badge>
                <Badge>{x.languages.map((l) => l.toUpperCase()).join('/')}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function SchoolDetail() {
  const { schoolId } = useParams()
  const s = useAppState()
  const me = useMe()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [share, setShare] = useState(true)
  const [msg, setMsg] = useState('')
  const x = s.schools.find((y) => y.id === schoolId)
  if (!x) return <Empty title="School not found" />
  const req = s.enrolmentRequests.find((r) => r.userId === me.id && r.schoolId === x.id && r.status === 'requested')
  const reviews = [
    { name: 'Olivier M.', stars: 5, body: 'Teachers explain the roundabout rules very well. Passed first time.' },
    { name: 'Grace I.', stars: 4, body: 'Good practical sessions. The dashboard helped me see my weak topics.' },
  ]
  return (
    <div>
      <PageHead crumbs={[{ to: '/app/schools', label: 'Find a school' }]} title={x.name} sub={`${x.address}, ${x.district}`} />
      <div className="grid g-side">
        <div className="stack lg">
          <div className="card">
            <dl className="kv">
              <dt>Licence categories</dt>
              <dd>{x.categories.join(', ')}</dd>
              <dt>Tuition</dt>
              <dd>
                {fmtRWF(x.tuition[0])} – {fmtRWF(x.tuition[1])}
              </dd>
              <dt>Language of instruction</dt>
              <dd>{x.languages.map((l) => langNames[l]).join(', ')}</dd>
              <dt>Schedule</dt>
              <dd>{x.schedule}</dd>
              <dt>Platform pass rate</dt>
              <dd>{x.confirmedResults >= 20 ? `${x.passRate}% (${x.confirmedResults} confirmed results)` : 'Shown once the school has 20+ confirmed results'}</dd>
              <dt>Rating</dt>
              <dd>
                ★ {x.rating} from {x.reviews} verified students
              </dd>
            </dl>
          </div>
          <div className="card">
            <h3>Reviews from verified students</h3>
            {reviews.map((r) => (
              <div key={r.name} className="list-item" style={{ alignItems: 'flex-start' }}>
                <div>
                  <strong className="small">
                    {r.name} · {'★'.repeat(r.stars)}
                  </strong>
                  <div className="small muted">{r.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          {me.schoolId === x.id ? (
            <Badge tone="success">You are enrolled here</Badge>
          ) : req ? (
            <div className="callout info">Request sent {fmtDate(req.createdAt)} — waiting for the school to accept.</div>
          ) : (
            <>
              <h3>Join this school</h3>
              <p className="small muted">The school confirms your enrolment. You choose whether your study history moves with you.</p>
              <button className="btn primary block" onClick={() => setOpen(true)}>
                Request enrolment
              </button>
            </>
          )}
        </div>
      </div>
      {open && (
        <Modal
          title={`Request enrolment at ${x.name}`}
          onClose={() => setOpen(false)}
          footer={
            <>
              <button className="btn" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button
                className="btn primary"
                onClick={() => {
                  requestEnrolment(me.id, x.id, share, msg)
                  setOpen(false)
                  toast('Request sent — the school will reply on WhatsApp')
                }}
              >
                Send request
              </button>
            </>
          }
        >
          <div className="stack">
            <label className="check">
              <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} /> Share my study history (readiness, mastery, mock results) with {x.name}
            </label>
            <Field label="Message to the school (optional)">
              <textarea className="input" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="e.g. I'd like to join a category A cohort in October." />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  )
}
