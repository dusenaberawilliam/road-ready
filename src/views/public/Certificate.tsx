import { CheckCircle2, Printer, Search, ShieldAlert, XCircle } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAppState } from '../../store/store'
import { fmtDate, sha256 } from '../../lib/util'
import type { Certificate } from '../../types'
import type { AppState } from '../../store/state'

export const verifyUrl = (n: string) => `${location.origin}/verify/${encodeURIComponent(n)}`

async function checkHash(s: AppState, c: Certificate) {
  if (!c.hash || !c.issuedAt) return false
  const u = s.users.find((x) => x.id === c.userId)
  if (!u) return false
  const h = await sha256([c.number, u.name, u.dob, c.schoolId, c.category, c.trainingStart, c.trainingEnd, c.issuedAt].join('|'))
  return h === c.hash
}

export function useHashValid(c?: Certificate) {
  const s = useAppState()
  const [valid, setValid] = useState<boolean | null>(null)
  useEffect(() => {
    let live = true
    if (!c || c.status !== 'issued') return
    // Seeded certificate has no stored hash; treat as legacy-valid.
    if (!c.hash) {
      setValid(true)
      return
    }
    checkHash(s, c).then((v) => live && setValid(v))
    return () => {
      live = false
    }
  }, [c, s])
  return valid
}

/** Full certificate document (online page + printable). */
export function CertificateDoc({ c }: { c: Certificate }) {
  const s = useAppState()
  const u = s.users.find((x) => x.id === c.userId)
  const sch = s.schools.find((x) => x.id === c.schoolId)!
  const head = s.users.find((x) => x.id === c.issuedBy)
  return (
    <div className="cert" style={{ ['--cert-color' as string]: sch.color }}>
      <div className="seal">
        <QRCodeSVG value={verifyUrl(c.number)} size={104} />
        <div className="tiny center" style={{ color: '#4b5a56' }}>
          Scan to verify
        </div>
      </div>
      <div className="row" style={{ gap: 14, marginBottom: 20 }}>
        <span className="avatar lg" style={{ background: sch.color, color: '#fff' }}>
          {sch.name
            .split(' ')
            .map((w) => w[0])
            .slice(0, 3)
            .join('')}
        </span>
        <div>
          <strong style={{ fontSize: '1.1rem' }}>{sch.name}</strong>
          <div className="small" style={{ color: '#4b5a56' }}>
            RNP authorisation {sch.rnpRef} · {sch.address}, {sch.district}
          </div>
        </div>
      </div>
      <h1>Certificate of Completion</h1>
      <p style={{ color: '#4b5a56' }}>Theory training for the provisional driving licence</p>
      <p style={{ fontSize: '1.05rem', margin: '18px 0' }}>
        This certifies that <strong style={{ fontSize: '1.3rem' }}>{u?.name ?? '—'}</strong> completed the theory training programme of {sch.name}.
      </p>
      <dl>
        <dt>Date of birth</dt>
        <dd>{fmtDate(u?.dob)}</dd>
        <dt>Licence category</dt>
        <dd>{c.category}</dd>
        <dt>National ID</dt>
        <dd>•••• •••• •••• {c.nationalIdLast4 ?? '••••'}</dd>
        <dt>Training period</dt>
        <dd>
          {fmtDate(c.trainingStart)} – {fmtDate(c.trainingEnd)}
        </dd>
        <dt>Lessons completed</dt>
        <dd>{c.lessonsCompleted}</dd>
        <dt>Sessions attended</dt>
        <dd>{c.sessionsAttended}</dd>
        <dt>Certificate number</dt>
        <dd className="num">{c.number}</dd>
        <dt>Issue date</dt>
        <dd>{fmtDate(c.issuedAt)}</dd>
      </dl>
      <div className="row between wrap" style={{ marginTop: 28 }}>
        <div>
          <div style={{ fontFamily: 'cursive', fontSize: '1.4rem' }}>{head?.name ?? 'School head'}</div>
          <div className="tiny" style={{ borderTop: '1px solid #13201d', paddingTop: 2, color: '#4b5a56' }}>
            Digital signature — Head of school
          </div>
        </div>
        <div className="tiny" style={{ color: '#4b5a56', maxWidth: 340 }}>
          Issued by the school. This certificate does not replace the RNP theory test or licence. Integrity hash: {c.hash ? `${c.hash.slice(0, 16)}…` : 'legacy'}
        </div>
      </div>
      {c.status === 'revoked' && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <span style={{ transform: 'rotate(-18deg)', border: '6px solid #b91c1c', color: '#b91c1c', fontSize: '3rem', fontWeight: 900, padding: '4px 24px', opacity: 0.8 }}>REVOKED</span>
        </div>
      )}
    </div>
  )
}

export function PublicCertificate() {
  const { number } = useParams()
  const s = useAppState()
  const c = s.certificates.find((x) => x.number === number && (x.status === 'issued' || x.status === 'revoked'))
  return (
    <div className="content narrow" style={{ paddingTop: 32 }}>
      <div className="row between no-print mb">
        <Link to="/">← RoadReady</Link>
        {c && (
          <button className="btn" onClick={() => window.print()}>
            <Printer size={16} /> Print / save as PDF
          </button>
        )}
      </div>
      {c ? <CertificateDoc c={c} /> : <div className="callout danger">No certificate found with number {number}.</div>}
    </div>
  )
}

export default function Verify() {
  const { number } = useParams()
  const s = useAppState()
  const navigate = useNavigate()
  const [q, setQ] = useState(number ?? '')
  const c = number ? s.certificates.find((x) => x.number.toLowerCase() === number.toLowerCase() && (x.status === 'issued' || x.status === 'revoked')) : undefined
  const valid = useHashValid(c)
  const u = c && s.users.find((x) => x.id === c.userId)
  const sch = c && s.schools.find((x) => x.id === c.schoolId)
  return (
    <div className="content narrow" style={{ paddingTop: 40 }}>
      <Link to="/">← RoadReady</Link>
      <h1 className="mt">Verify a certificate</h1>
      <p className="muted">Enter the certificate number or scan the QR code on the certificate. Only minimal information is shown publicly.</p>
      <form
        className="row mt"
        onSubmit={(e) => {
          e.preventDefault()
          navigate(`/verify/${encodeURIComponent(q.trim())}`)
        }}
      >
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="KSD-2026-000127" />
        <button className="btn primary" disabled={!q.trim()}>
          <Search size={16} /> Verify
        </button>
      </form>
      {number && (
        <div className="card mt">
          {!c ? (
            <div className="row">
              <XCircle color="var(--danger)" />
              <div>
                <strong>Not found</strong>
                <div className="small muted">No issued certificate matches "{number}". Check the number and try again.</div>
              </div>
            </div>
          ) : c.status === 'revoked' ? (
            <div className="stack sm">
              <div className="row">
                <ShieldAlert color="var(--danger)" />
                <strong style={{ color: 'var(--danger)' }}>Revoked</strong>
              </div>
              <div className="small muted">This certificate was revoked by the school and is no longer valid.</div>
            </div>
          ) : (
            <div className="stack">
              <div className="row">
                {valid === false ? <ShieldAlert color="var(--danger)" /> : <CheckCircle2 color="var(--success)" />}
                <strong style={{ color: valid === false ? 'var(--danger)' : 'var(--success)', fontSize: '1.1rem' }}>{valid === false ? 'Tampered — data does not match the signed hash' : 'Valid certificate'}</strong>
              </div>
              <dl className="kv">
                <dt>Student</dt>
                <dd>{u?.name}</dd>
                <dt>School</dt>
                <dd>{sch?.name}</dd>
                <dt>Issue date</dt>
                <dd>{fmtDate(c.issuedAt)}</dd>
                <dt>Number</dt>
                <dd className="num">{c.number}</dd>
              </dl>
              <Link className="btn" to={`/certificate/${c.number}`}>
                View certificate
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
