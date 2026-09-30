import { Inbox, X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { initials } from '../lib/util'

// ─── Toasts ──────────────────────────────────────────────────────────────
type ToastKind = 'info' | 'success' | 'error'
const ToastCtx = createContext<(msg: string, kind?: ToastKind) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: ToastKind }[]>([])
  const push = useCallback((msg: string, kind: ToastKind = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, msg, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

// ─── Modal ───────────────────────────────────────────────────────────────
export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn ghost icon" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Confirm({
  title,
  body,
  confirmLabel = 'Confirm',
  danger,
  onConfirm,
  onClose,
  requireText,
}: {
  title: string
  body: ReactNode
  confirmLabel?: string
  danger?: boolean
  onConfirm: (text: string) => void
  onClose: () => void
  requireText?: string
}) {
  const [text, setText] = useState('')
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`btn ${danger ? 'danger' : 'primary'}`}
            disabled={!!requireText && text.trim().length < 3}
            onClick={() => {
              onConfirm(text)
              onClose()
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="stack">
        <div>{body}</div>
        {requireText && (
          <div className="field">
            <label>{requireText}</label>
            <textarea className="input" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── Small pieces ────────────────────────────────────────────────────────
export const Badge = ({ tone, children }: { tone?: 'success' | 'warning' | 'danger' | 'info' | 'primary'; children: ReactNode }) => (
  <span className={`badge ${tone ?? ''}`}>{children}</span>
)

export const Bar = ({ value, tone, thin }: { value: number; tone?: 'success' | 'warning' | 'danger'; thin?: boolean }) => (
  <div className={`bar ${tone ?? ''} ${thin ? 'thin' : ''}`} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
    <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>
)

export const masteryTone = (v: number) => (v >= 80 ? 'success' : v >= 60 ? 'warning' : 'danger') as 'success' | 'warning' | 'danger'

export function Ring({ value, size = 128, stroke = 11, label, tone }: { value: number; size?: number; stroke?: number; label?: ReactNode; tone?: 'success' | 'warning' | 'danger' }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const color = tone === 'success' ? 'var(--success)' : tone === 'warning' ? 'var(--accent)' : tone === 'danger' ? 'var(--danger)' : 'var(--primary)'
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(100, value)) / 100)}
          style={{ transition: 'stroke-dashoffset .5s' }}
        />
      </svg>
      <div className="ring-label">
        <b>{Math.round(value)}%</b>
        {label && <span className="small muted">{label}</span>}
      </div>
    </div>
  )
}

export const Avatar = ({ name, size, color }: { name: string; size?: 'sm' | 'lg'; color?: string }) => (
  <span className={`avatar ${size ?? ''}`} style={color ? { background: color, color: '#fff' } : undefined} aria-hidden>
    {initials(name || '?')}
  </span>
)

export const Empty = ({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) => (
  <div className="empty">
    {icon ?? <Inbox />}
    <h3>{title}</h3>
    {children && <div className="small">{children}</div>}
  </div>
)

export const Stat = ({ label, value, delta, tone, icon }: { label: string; value: ReactNode; delta?: ReactNode; tone?: string; icon?: ReactNode }) => (
  <div className="card stat">
    {icon && (
      <span className="stat-icon" style={tone ? { background: `var(--${tone}-soft)`, color: `var(--${tone})` } : undefined}>
        {icon}
      </span>
    )}
    <span className="label">{label}</span>
    <span className="value" style={tone ? { color: `var(--${tone})` } : undefined}>
      {value}
    </span>
    {delta && <span className="delta">{delta}</span>}
  </div>
)

export const Switch = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) => (
  <label className="switch" aria-label={label}>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span />
  </label>
)

export const Field = ({ label, hint, error, children }: { label: ReactNode; hint?: ReactNode; error?: string; children: ReactNode }) => (
  <div className="field">
    <label>{label}</label>
    {children}
    {error ? <span className="error">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
  </div>
)

export function PageHead({ title, sub, crumbs, actions }: { title: ReactNode; sub?: ReactNode; crumbs?: { to: string; label: string }[]; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div className="grow">
        {crumbs && (
          <div className="crumbs">
            {crumbs.map((c) => (
              <span key={c.to}>
                <Link to={c.to}>{c.label}</Link> ›
              </span>
            ))}
          </div>
        )}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="row wrap">{actions}</div>}
    </div>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} className={value === t.id ? 'on' : ''} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function Seg<T extends string>({ options, value, onChange }: { options: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.id} className={value === o.id ? 'on' : ''} onClick={() => onChange(o.id)} type="button">
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Sparkline({ values, height = 60 }: { values: number[]; height?: number }) {
  if (values.length < 2) return <div className="faint small">Not enough data yet</div>
  const w = 300
  const max = 100
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${height - (v / max) * (height - 6) - 3}`).join(' ')
  return (
    <svg className="sparkline" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" role="img" aria-label={`Trend from ${values[0]} to ${values[values.length - 1]}`}>
      <line x1="0" x2={w} y1={height - 0.6 * (height - 6) - 3} y2={height - 0.6 * (height - 6) - 3} stroke="var(--border)" strokeDasharray="4 4" />
      <polyline points={pts} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {values.map((v, i) => (
        <circle key={i} cx={(i / (values.length - 1)) * w} cy={height - (v / max) * (height - 6) - 3} r="3" fill="var(--primary)" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  )
}

export function Bars({ data, format = (v: number) => String(v), max }: { data: { label: string; value: number; tone?: string }[]; format?: (v: number) => string; max?: number }) {
  const m = max ?? Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="bars">
      {data.map((d) => (
        <div className="b" key={d.label} title={`${d.label}: ${format(d.value)}`}>
          <small className="num">{format(d.value)}</small>
          <span className="col" style={{ height: `${(d.value / m) * 100}%`, background: d.tone ? `var(--${d.tone})` : undefined }} />
          <small>{d.label}</small>
        </div>
      ))}
    </div>
  )
}

export const heatColor = (v: number | undefined) => {
  if (v === undefined) return { background: 'var(--surface-2)', color: 'var(--text-3)' }
  if (v >= 80) return { background: 'var(--success)', color: '#fff' }
  if (v >= 60) return { background: '#86c99a', color: '#0b2913' }
  if (v >= 40) return { background: '#f5c26b', color: '#3a2503' }
  return { background: '#ef8b7f', color: '#3d0b06' }
}
