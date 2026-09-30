import { FileUp } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Field, useToast } from '../../components/ui'
import { DISTRICTS } from '../../lib/constants'
import { registerSchool, requestOtp, verifyOtp, normalisePhone } from '../../store/actions'
import { AuthLayout, OtpInput } from './Login'

export default function RegisterSchool() {
  const navigate = useNavigate()
  const toast = useToast()
  const [f, setF] = useState({ name: '', tin: '', rnpRef: '', district: 'Gasabo', address: '', phone: '', admin: '' })
  const [docs, setDocs] = useState<string[]>([])
  const [otp, setOtp] = useState<{ sent: string; code: string } | null>(null)
  const [err, setErr] = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (f.name.trim().length < 4) e.name = 'Enter the registered school name'
    if (!/^\d{9}$/.test(f.tin)) e.tin = 'TIN has 9 digits'
    if (!/^RNP\/DS\/\d{4}\/\d{3}$/i.test(f.rnpRef)) e.rnpRef = 'Format: RNP/DS/2026/123'
    if (!/^(\+?250|0)?7[2389]\d{7}$/.test(f.phone.replace(/\s/g, ''))) e.phone = 'Enter a valid mobile number'
    if (f.admin.trim().split(' ').length < 2) e.admin = 'Enter your full name'
    if (docs.length < 2) e.docs = 'Upload the RDB certificate and the RNP authorisation'
    setErr(e)
    return !Object.keys(e).length
  }

  return (
    <AuthLayout>
      {!otp ? (
        <div className="stack">
          <div>
            <h1>Register your driving school</h1>
            <p className="muted">We verify your documents within 24 hours. Meanwhile you can explore a demo dashboard.</p>
          </div>
          <Field label="School name" error={err.name}>
            <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Huye Driving Center" />
          </Field>
          <div className="grid g2">
            <Field label="RDB / TIN number" error={err.tin}>
              <input className="input" inputMode="numeric" value={f.tin} onChange={(e) => setF({ ...f, tin: e.target.value.replace(/\D/g, '') })} />
            </Field>
            <Field label="RNP authorisation ref." error={err.rnpRef}>
              <input className="input" value={f.rnpRef} onChange={(e) => setF({ ...f, rnpRef: e.target.value.toUpperCase() })} placeholder="RNP/DS/2026/123" />
            </Field>
          </div>
          <div className="grid g2">
            <Field label="District">
              <select className="input" value={f.district} onChange={(e) => setF({ ...f, district: e.target.value })}>
                {DISTRICTS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>
            <Field label="Contact phone" error={err.phone}>
              <input className="input" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="078…" />
            </Field>
          </div>
          <Field label="Address">
            <input className="input" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
          </Field>
          <Field label="Your name (school admin)" error={err.admin}>
            <input className="input" value={f.admin} onChange={(e) => setF({ ...f, admin: e.target.value })} />
          </Field>
          <Field label="Documents" error={err.docs} hint="PDF or photo · RDB certificate, RNP authorisation">
            <label className="drop">
              <FileUp size={20} />
              <div>{docs.length ? docs.join(', ') : 'Click to upload documents'}</div>
              <input type="file" multiple hidden accept=".pdf,image/*" onChange={(e) => setDocs([...docs, ...Array.from(e.target.files ?? []).map((x) => x.name)])} />
            </label>
          </Field>
          <button
            className="btn primary lg block"
            onClick={() => {
              if (!validate()) return
              setOtp({ sent: requestOtp(normalisePhone(f.phone)), code: '' })
            }}
          >
            Verify phone and submit
          </button>
        </div>
      ) : (
        <div className="stack lg">
          <h1>Confirm your phone</h1>
          <div className="callout info small">
            Demo code:{' '}
            <button className="linkbtn" onClick={() => setOtp({ ...otp, code: otp.sent })}>
              {otp.sent}
            </button>
          </div>
          <OtpInput value={otp.code} onChange={(code) => setOtp({ ...otp, code })} />
          <button
            className="btn primary lg block"
            disabled={otp.code.length < 6}
            onClick={() => {
              if (!verifyOtp(normalisePhone(f.phone), otp.code)) return toast('Wrong code', 'error')
              registerSchool({ name: f.name.trim(), tin: f.tin, rnpRef: f.rnpRef, district: f.district, address: f.address, phone: f.phone }, f.admin.trim())
              toast('Submitted — awaiting verification', 'info')
              navigate('/app/school')
            }}
          >
            Submit for approval
          </button>
        </div>
      )}
    </AuthLayout>
  )
}
