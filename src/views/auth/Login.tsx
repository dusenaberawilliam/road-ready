import { ArrowLeft, KeyRound, MessageCircle, Smartphone } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DEMO_ACCOUNTS, homeFor, roleLabel } from '../../components/AppShell'
import { Avatar, Field, Seg, useToast } from '../../components/ui'
import { langNames } from '../../lib/i18n'
import { findUserByPhone, login, normalisePhone, registerLearner, requestOtp, verifyOtp } from '../../store/actions'
import { useAppState } from '../../store/store'
import type { Lang } from '../../types'

export function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  return (
    <div className="otp">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          className="input"
          inputMode="numeric"
          maxLength={1}
          aria-label={`Digit ${i + 1}`}
          value={value[i] ?? ''}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, '').slice(-1)
            const next = (value.slice(0, i) + d + value.slice(i + 1)).slice(0, 6)
            onChange(next)
            if (d && i < 5) refs.current[i + 1]?.focus()
          }}
          onKeyDown={(e) => e.key === 'Backspace' && !value[i] && i > 0 && refs.current[i - 1]?.focus()}
          onPaste={(e) => {
            const d = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
            if (d) {
              e.preventDefault()
              onChange(d)
            }
          }}
        />
      ))}
    </div>
  )
}

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-wrap">
      <div className="auth-side">
        <Link to="/" style={{ color: '#fff', fontWeight: 800, fontSize: '1.2rem' }}>
          RoadReady
        </Link>
        <div>
          <h1 style={{ fontSize: '2rem' }}>Learn the rules. Understand the road. Pass first time.</h1>
          <p style={{ opacity: 0.9 }}>Turifuza ko witegura ikizamini neza—ariko cyane cyane, ko wubaka ubumenyi buzagufasha kuba umumotari cyangwa umushoferi utekanye kandi wiyizeye.</p>
        </div>
        <small style={{ opacity: 0.7 }}>Kinyarwanda · English · Français</small>
      </div>
      <div className="auth-main">
        <div className="auth-card">{children}</div>
      </div>
    </div>
  )
}

export default function Login({ signup }: { signup?: boolean }) {
  const s = useAppState()
  const navigate = useNavigate()
  const toast = useToast()
  const [step, setStep] = useState<'phone' | 'otp' | 'pin'>('phone')
  const [lang, setLang] = useState<Lang>('rw')
  const [phone, setPhone] = useState('')
  const [channel, setChannel] = useState<'sms' | 'whatsapp'>('whatsapp')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [resendIn, setResendIn] = useState(0)

  useEffect(() => {
    if (resendIn <= 0) return
    const id = setTimeout(() => setResendIn((x) => x - 1), 1000)
    return () => clearTimeout(id)
  }, [resendIn])

  const valid = /^(\+?250|0)?7[2389]\d{7}$/.test(phone.replace(/\s/g, ''))
  const existing = valid ? findUserByPhone(phone) : undefined
  const hasPin = !!(existing && s.settings[existing.id]?.pin)

  const send = () => {
    setError('')
    const c = requestOtp(normalisePhone(phone))
    setSent(c)
    setCode('')
    setStep('otp')
    setResendIn(30)
    toast(`Code sent by ${channel === 'sms' ? 'SMS' : 'WhatsApp'}`, 'info')
  }

  const finish = () => {
    const p = normalisePhone(phone)
    if (!verifyOtp(p, code)) return setError('That code is not correct. Check the message and try again.')
    const u = findUserByPhone(p)
    if (u) {
      if (u.status === 'suspended') return setError('This account is suspended. Contact support.')
      login(u.id)
      navigate(u.onboarded ? homeFor(u.role) : '/onboarding')
    } else {
      registerLearner(p, lang)
      navigate('/onboarding')
    }
  }

  return (
    <AuthLayout>
      {step === 'phone' && (
        <div className="stack lg">
          <div>
            <h1>{signup ? 'Create your account' : 'Sign in'}</h1>
            <p className="muted">Use your phone number — we'll send you a one-time code. No password needed.</p>
          </div>
          {signup && (
            <Field label="Choose your language">
              <Seg options={(['rw', 'en', 'fr'] as Lang[]).map((l) => ({ id: l, label: langNames[l] }))} value={lang} onChange={setLang} />
            </Field>
          )}
          <Field label="Phone number" hint="MTN or Airtel number, e.g. 078 800 0001" error={phone && !valid ? 'Enter a valid Rwandan mobile number' : undefined}>
            <div className="row">
              <span className="badge" style={{ padding: '9px 10px' }}>
                🇷🇼 +250
              </span>
              <input className="input" inputMode="tel" autoFocus placeholder="788 000 001" value={phone} onChange={(e) => setPhone(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && valid && send()} />
            </div>
          </Field>
          <Field label="Send the code by">
            <Seg
              options={[
                { id: 'whatsapp', label: <><MessageCircle size={14} /> WhatsApp</> },
                { id: 'sms', label: <><Smartphone size={14} /> SMS</> },
              ]}
              value={channel}
              onChange={setChannel}
            />
          </Field>
          <button className="btn primary lg block" disabled={!valid} onClick={send}>
            Send code
          </button>
          {hasPin && (
            <button className="btn block" onClick={() => setStep('pin')}>
              <KeyRound size={16} /> Use my PIN instead
            </button>
          )}
          <div className="small muted center">
            {signup ? (
              <>
                Already have an account? <Link to="/login">Sign in</Link>
              </>
            ) : (
              <>
                New here? <Link to="/signup">Create an account</Link> · <Link to="/register-school">Register a school</Link>
              </>
            )}
          </div>
          {!signup && (
            <>
              <div className="divider-text">or try a demo account</div>
              <div className="grid g2" style={{ gap: 8 }}>
                {DEMO_ACCOUNTS.map((a) => {
                  const u = s.users.find((x) => x.id === a.id)
                  if (!u) return null
                  return (
                    <button key={a.id} className="btn" style={{ justifyContent: 'flex-start' }} onClick={() => setPhone(u.phone.replace('+250', '0'))}>
                      <Avatar name={u.name} size="sm" /> {roleLabel[a.role]}
                    </button>
                  )
                })}
              </div>
              <p className="tiny faint center" style={{ margin: 0 }}>
                Clicking a role fills in its phone number — then press "Send code".
              </p>
            </>
          )}
        </div>
      )}
      {step === 'otp' && (
        <div className="stack lg">
          <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => setStep('phone')}>
            <ArrowLeft size={15} /> Change number
          </button>
          <div>
            <h1>Enter the code</h1>
            <p className="muted">
              We sent a 6-digit code to <strong>{normalisePhone(phone)}</strong> by {channel === 'sms' ? 'SMS' : 'WhatsApp'}.
            </p>
          </div>
          <div className="callout info small">
            <strong>Demo:</strong> no message is really sent. Your code is{' '}
            <button className="linkbtn" onClick={() => setCode(sent)}>
              {sent}
            </button>{' '}
            (click to fill).
          </div>
          <OtpInput value={code} onChange={(v) => (setCode(v), setError(''))} />
          {error && <div className="callout danger small">{error}</div>}
          <button className="btn primary lg block" disabled={code.length < 6} onClick={finish}>
            Verify and continue
          </button>
          <button className="btn ghost" disabled={resendIn > 0} onClick={send}>
            {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
          </button>
        </div>
      )}
      {step === 'pin' && existing && (
        <div className="stack lg">
          <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => setStep('phone')}>
            <ArrowLeft size={15} /> Back
          </button>
          <div>
            <h1>Welcome back, {existing.name.split(' ')[0]}</h1>
            <p className="muted">Enter your 4-digit PIN.</p>
          </div>
          <input className="input" type="password" inputMode="numeric" maxLength={4} autoFocus value={pin} onChange={(e) => (setPin(e.target.value.replace(/\D/g, '')), setError(''))} style={{ fontSize: '1.4rem', letterSpacing: 12, textAlign: 'center' }} />
          {error && <div className="callout danger small">{error}</div>}
          <button
            className="btn primary lg block"
            disabled={pin.length < 4}
            onClick={() => {
              if (s.settings[existing.id]?.pin !== pin) return setError('Wrong PIN. Use the code option if you forgot it.')
              login(existing.id)
              navigate(homeFor(existing.role))
            }}
          >
            Sign in
          </button>
        </div>
      )}
    </AuthLayout>
  )
}
