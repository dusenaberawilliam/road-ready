import { CheckCircle2, Link2, QrCode, School, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { homeFor } from '../../components/AppShell'
import { Field, Modal, useToast } from '../../components/ui'
import VideoPlayer from '../../components/VideoPlayer'
import { CATEGORIES, DISTRICTS, ROAD_USE } from '../../lib/constants'
import { age, isoDay } from '../../lib/util'
import { findSchoolByCode, joinSchool, requestGuardianConsent, setConsent, startAttempt, updateUser } from '../../store/actions'
import { useAppState, useCurrentUser } from '../../store/store'
import type { LicenceCategory } from '../../types'
import { AuthLayout } from './Login'

type Step = 'profile' | 'school' | 'consent' | 'welcome' | 'diagnostic'

export default function Onboarding() {
  const s = useAppState()
  const me = useCurrentUser()
  const navigate = useNavigate()
  const toast = useToast()
  const [step, setStep] = useState<Step>('profile')
  const [form, setForm] = useState({ name: me?.name ?? '', dob: me?.dob ?? '', gender: '', district: me?.district || 'Gasabo', category: (me?.category ?? 'A') as LicenceCategory, examDate: '', roadUse: 'moto passenger' })
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('code') ?? '')
  const [cohortId, setCohortId] = useState('')
  const [scanning, setScanning] = useState(false)
  const [invite, setInvite] = useState('')
  const [guardian, setGuardian] = useState({ name: '', phone: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (!me) return <Navigate to="/login" replace />
  if (me.onboarded && step === 'profile') return <Navigate to={homeFor(me.role)} replace />

  const school = code.trim() ? findSchoolByCode(code) : undefined
  const cohorts = school ? s.cohorts.filter((c) => c.schoolId === school.id) : []
  const years = form.dob ? age(form.dob) : null
  const steps: Step[] = ['profile', 'school', ...(years !== null && years < 18 ? (['consent'] as Step[]) : []), 'welcome', 'diagnostic']

  const saveProfile = () => {
    const e: Record<string, string> = {}
    if (form.name.trim().split(' ').length < 2) e.name = 'Enter your first and last name'
    if (!form.dob) e.dob = 'Date of birth is required'
    else if (years! < 16) e.dob = 'Learners must be at least 16 to prepare for the provisional licence'
    if (form.examDate && form.examDate < isoDay()) e.examDate = 'Choose a future date'
    setErrors(e)
    if (Object.keys(e).length) return
    updateUser(me.id, { name: form.name.trim(), dob: form.dob, gender: (form.gender || undefined) as 'F' | 'M' | undefined, district: form.district, category: form.category, examDate: form.examDate ? new Date(form.examDate).toISOString() : undefined, roadUse: form.roadUse })
    setStep('school')
  }

  const afterSchool = () => setStep(years !== null && years < 18 ? 'consent' : 'welcome')

  return (
    <AuthLayout>
      <div className="steps" aria-hidden>
        {steps.map((st) => (
          <span key={st} className={steps.indexOf(st) <= steps.indexOf(step) ? 'on' : ''} />
        ))}
      </div>

      {step === 'profile' && (
        <div className="stack">
          <div>
            <h1>Tell us about you</h1>
            <p className="muted">This helps us build your personal study plan.</p>
          </div>
          <Field label="Full name" error={errors.name}>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Aline Uwase" autoFocus />
          </Field>
          <div className="grid g2">
            <Field label="Date of birth" error={errors.dob}>
              <input className="input" type="date" value={form.dob} max={isoDay()} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
            </Field>
            <Field label="Gender (optional)">
              <select className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">Prefer not to say</option>
                <option value="F">Female</option>
                <option value="M">Male</option>
              </select>
            </Field>
          </div>
          <div className="grid g2">
            <Field label="District">
              <select className="input" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })}>
                {DISTRICTS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>
            <Field label="Target licence">
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as LicenceCategory })}>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Planned exam date" hint="Optional — your plan adapts to it" error={errors.examDate}>
            <input className="input" type="date" value={form.examDate} min={isoDay()} onChange={(e) => setForm({ ...form, examDate: e.target.value })} />
          </Field>
          <Field label="How do you use the road today?">
            <div className="row wrap">
              {ROAD_USE.map((r) => (
                <button key={r} type="button" className={`chip ${form.roadUse === r ? 'on' : ''}`} onClick={() => setForm({ ...form, roadUse: r })}>
                  {r}
                </button>
              ))}
            </div>
          </Field>
          <button className="btn primary lg block" onClick={saveProfile}>
            Continue
          </button>
        </div>
      )}

      {step === 'school' && (
        <div className="stack">
          <div>
            <h1>Are you with a driving school?</h1>
            <p className="muted">Join your class with the code, QR poster or invite link from your school.</p>
          </div>
          <Field label="School code" hint="Try KSD-4821 (Kigali Safe Drive) or MRA-1177 (Musanze)" error={code.trim().length >= 6 && !school ? 'No approved school with this code' : undefined}>
            <input className="input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC-1234" />
          </Field>
          <div className="row wrap">
            <button className="btn sm" onClick={() => setScanning(true)}>
              <QrCode size={15} /> Scan QR poster
            </button>
            <div className="row grow">
              <input className="input" placeholder="…or paste invite link" value={invite} onChange={(e) => setInvite(e.target.value)} />
              <button
                className="btn sm"
                onClick={() => {
                  const m = invite.match(/code=([A-Z0-9-]+)/i) ?? invite.match(/([A-Z]{3}-\d{4})/i)
                  if (m) setCode(m[1].toUpperCase())
                  else toast('That link does not contain a school code', 'error')
                }}
              >
                <Link2 size={15} />
              </button>
            </div>
          </div>
          {school && (
            <div className="card flat stack sm" style={{ borderColor: school.color }}>
              <div className="row">
                <School size={18} color={school.color} />
                <strong>{school.name}</strong>
                <CheckCircle2 size={16} color="var(--success)" />
              </div>
              <span className="small muted">
                {school.district} · {school.address}
              </span>
              <Field label="Your class">
                <select className="input" value={cohortId || cohorts[0]?.id} onChange={(e) => setCohortId(e.target.value)}>
                  {cohorts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <button
                className="btn primary"
                onClick={() => {
                  joinSchool(me.id, school.id, cohortId || cohorts[0]?.id)
                  toast(`Joined ${school.name}`)
                  afterSchool()
                }}
              >
                Join {school.name}
              </button>
            </div>
          )}
          <div className="divider-text">or</div>
          <button className="btn block" onClick={afterSchool}>
            <UserRound size={16} /> Study on my own (free plan)
          </button>
          <p className="tiny faint center">You can join a partner school later from "Find a school" — your history moves with you.</p>
          {scanning && (
            <Modal title="Scan the QR poster" onClose={() => setScanning(false)}>
              <div className="stack center">
                <div style={{ background: '#111', borderRadius: 12, aspectRatio: '4/3', display: 'grid', placeItems: 'center', color: '#fff' }}>
                  <div style={{ width: 160, height: 160, border: '3px solid #4fc3f7', borderRadius: 12, display: 'grid', placeItems: 'center' }}>
                    <QrCode size={90} />
                  </div>
                </div>
                <p className="small muted">Camera preview (simulated). Choose the poster you are pointing at:</p>
                {s.schools
                  .filter((x) => x.status === 'approved')
                  .map((x) => (
                    <button
                      key={x.id}
                      className="btn"
                      onClick={() => {
                        setCode(x.code)
                        setScanning(false)
                        toast('QR code recognised', 'info')
                      }}
                    >
                      {x.name} poster
                    </button>
                  ))}
              </div>
            </Modal>
          )}
        </div>
      )}

      {step === 'consent' && (
        <div className="stack">
          <div>
            <h1>Guardian consent</h1>
            <p className="muted">You are {years}. A parent or guardian must agree before your account becomes active. They will receive a WhatsApp message.</p>
          </div>
          {me.consent === 'pending' || me.consent === 'granted' ? (
            <>
              <div className={`callout ${me.consent === 'granted' ? 'success' : 'warning'}`}>
                {me.consent === 'granted' ? 'Consent received — your account is active.' : `Waiting for ${s.users.find((u) => u.id === me.guardianId)?.name ?? 'your guardian'} to approve…`}
              </div>
              {me.consent === 'pending' && (
                <button
                  className="btn"
                  onClick={() => {
                    setConsent(me.id, true)
                    toast('Guardian approved (simulated)', 'info')
                  }}
                >
                  Demo: simulate guardian approving on WhatsApp
                </button>
              )}
              <button className="btn primary lg block" disabled={me.consent !== 'granted'} onClick={() => setStep('welcome')}>
                Continue
              </button>
            </>
          ) : (
            <>
              <Field label="Guardian's full name">
                <input className="input" value={guardian.name} onChange={(e) => setGuardian({ ...guardian, name: e.target.value })} />
              </Field>
              <Field label="Guardian's phone number">
                <input className="input" inputMode="tel" placeholder="078…" value={guardian.phone} onChange={(e) => setGuardian({ ...guardian, phone: e.target.value })} />
              </Field>
              <button
                className="btn primary lg block"
                disabled={guardian.name.trim().length < 3 || !/^(\+?250|0)?7[2389]\d{7}$/.test(guardian.phone.replace(/\s/g, ''))}
                onClick={() => {
                  requestGuardianConsent(me.id, guardian.name.trim(), guardian.phone)
                  toast('Consent request sent on WhatsApp')
                }}
              >
                Send consent request
              </button>
            </>
          )}
        </div>
      )}

      {step === 'welcome' && (
        <div className="stack">
          <div>
            <h1>How to learn here</h1>
            <p className="muted">A 1-minute welcome video: watch, read, note, practise, discuss.</p>
          </div>
          <VideoPlayer
            scene="road"
            durationSec={60}
            chapters={[
              { title: 'Watch', text: 'Every lesson starts with a real situation on a Rwandan road, filmed or animated.' },
              { title: 'Read', text: 'The same lesson is also in text, readable in five minutes on your phone.' },
              { title: 'Note', text: 'Pin notes to a moment in the video or highlight a paragraph.' },
              { title: 'Practise', text: 'Answer scenario questions and read why every answer is right or wrong.' },
              { title: 'Discuss', text: 'Ask your teacher and classmates under each lesson.' },
            ]}
          />
          <button className="btn primary lg block" onClick={() => setStep('diagnostic')}>
            Continue
          </button>
        </div>
      )}

      {step === 'diagnostic' && (
        <div className="stack">
          <div>
            <h1>Your diagnostic test</h1>
            <p className="muted">20 scenario questions across all topics. There is no timer and no pass mark — it just measures where you start, so your readiness score and study plan are right from day one.</p>
          </div>
          <ul className="small muted">
            <li>2 questions from each of the 13 topics (roughly)</li>
            <li>Explanations are shown at the end</li>
            <li>Takes about 10 minutes</li>
          </ul>
          <button
            className="btn primary lg block"
            onClick={() => {
              updateUser(me.id, { onboarded: true })
              const id = startAttempt(me.id, 'diagnostic')
              navigate(`/app/exam/${id}`)
            }}
          >
            Start diagnostic test
          </button>
          <button
            className="btn ghost"
            onClick={() => {
              updateUser(me.id, { onboarded: true })
              navigate(homeFor(me.role))
            }}
          >
            Skip for now
          </button>
        </div>
      )}
    </AuthLayout>
  )
}
