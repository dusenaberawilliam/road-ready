import { Bell, Download, KeyRound, LifeBuoy, LogOut, Mail, MessageCircle, MonitorSmartphone, Smartphone, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { roleLabel } from '../components/AppShell'
import { Badge, Confirm, Empty, Field, PageHead, Seg, Switch, useToast } from '../components/ui'
import { langNames } from '../lib/i18n'
import { DISTRICTS } from '../lib/constants'
import { downloadFile, relTime } from '../lib/util'
import { createTicket, logout, markNotificationsRead, setLanguage, signOutDevice, updateSettings, updateUser } from '../store/actions'
import { resetDemo, useAppState, useMe } from '../store/store'
import type { Lang, UserSettings } from '../types'
import { defaultSettings } from '../store/actions'

const channelIcon = { push: <Bell size={14} />, whatsapp: <MessageCircle size={14} />, sms: <Smartphone size={14} />, email: <Mail size={14} />, dashboard: <MonitorSmartphone size={14} /> }

export function Notifications() {
  const s = useAppState()
  const me = useMe()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const list = s.notifications.filter((n) => n.userId === me.id && (filter === 'all' || !n.read))
  return (
    <div className="content narrow" style={{ padding: 0 }}>
      <PageHead
        title="Notifications"
        sub="Push first, WhatsApp second, SMS only for OTP and critical alerts. Quiet hours 9 pm–7 am."
        actions={
          <button className="btn" onClick={() => markNotificationsRead(me.id)}>
            Mark all read
          </button>
        }
      />
      <Seg
        options={[
          { id: 'all', label: 'All' },
          { id: 'unread', label: 'Unread' },
        ]}
        value={filter}
        onChange={setFilter}
      />
      <div className="card mt">
        {list.length === 0 ? (
          <Empty title="You're all caught up" icon={<Bell />} />
        ) : (
          <div className="list">
            {list.map((n) => (
              <button
                key={n.id}
                className="list-item"
                style={{ background: 'none', border: 0, textAlign: 'left', width: '100%', cursor: n.link ? 'pointer' : 'default', color: 'inherit', font: 'inherit' }}
                onClick={() => {
                  markNotificationsRead(me.id, n.id)
                  if (n.link) navigate(n.link)
                }}
              >
                <span className="plan-icon" style={{ background: 'var(--surface-2)', width: 32, height: 32 }}>
                  {channelIcon[n.channel]}
                </span>
                <span className="grow">
                  <span className="row" style={{ gap: 6 }}>
                    {!n.read && <span className="dot" style={{ color: 'var(--primary)' }} />}
                    <strong className="small">{n.title}</strong>
                  </span>
                  <span className="small muted" style={{ display: 'block' }}>
                    {n.body}
                  </span>
                </span>
                <span className="tiny faint nowrap">
                  {n.channel} · {relTime(n.createdAt)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function Settings() {
  const s = useAppState()
  const me = useMe()
  const toast = useToast()
  const navigate = useNavigate()
  const st: UserSettings = s.settings[me.id] ?? defaultSettings()
  const [profile, setProfile] = useState({ name: me.name, district: me.district })
  const [pin, setPin] = useState('')
  const [ticket, setTicket] = useState({ subject: '', body: '' })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const learner = me.role === 'student' || me.role === 'individual'
  const set = (patch: Partial<UserSettings>) => updateSettings(me.id, patch)

  const exportData = () => {
    const data = {
      profile: me,
      notes: s.notes.filter((n) => n.userId === me.id),
      attempts: s.attempts.filter((a) => a.userId === me.id),
      mastery: s.mastery[me.id],
      progress: s.progress[me.id],
      posts: s.posts.filter((p) => p.authorId === me.id),
      payments: s.payments.filter((p) => p.payerId === me.id),
    }
    downloadFile(`my-data-${me.phone}.json`, JSON.stringify(data, null, 2), 'application/json')
    toast('Your data was exported')
  }

  return (
    <div className="content narrow" style={{ padding: 0 }}>
      <PageHead title="Settings" sub={`${roleLabel[me.role]} · ${me.phone}`} />
      <div className="stack lg">
        <div className="card stack">
          <h2>Profile</h2>
          <div className="grid g2">
            <Field label="Full name">
              <input className="input" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            </Field>
            <Field label="District">
              <select className="input" value={profile.district} onChange={(e) => setProfile({ ...profile, district: e.target.value })}>
                {DISTRICTS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Phone (login identity)" hint="Changing numbers needs an OTP on both numbers or admin support.">
            <input className="input" value={me.phone} disabled />
          </Field>
          <div>
            <button className="btn primary" onClick={() => (updateUser(me.id, profile), toast('Profile saved'))} disabled={profile.name.trim().length < 3}>
              Save profile
            </button>
          </div>
        </div>

        <div className="card stack">
          <h2>Language</h2>
          <p className="small muted" style={{ margin: 0 }}>
            Switch anytime without losing progress.
          </p>
          <Seg options={(['rw', 'en', 'fr'] as Lang[]).map((l) => ({ id: l, label: langNames[l] }))} value={me.language} onChange={(l) => (setLanguage(me.id, l), toast(`Language: ${langNames[l]}`))} />
        </div>

        <div className="card stack">
          <h2>Reminders</h2>
          <div className="grid g2">
            {(
              [
                ['push', 'App push'],
                ['whatsapp', 'WhatsApp'],
                ['sms', 'SMS (critical only)'],
                ['email', 'Email'],
              ] as const
            ).map(([k, label]) => (
              <div key={k} className="row between">
                <span>{label}</span>
                <Switch checked={st.channels[k]} onChange={(v) => set({ channels: { ...st.channels, [k]: v } })} label={label} />
              </div>
            ))}
          </div>
          <hr style={{ margin: 0 }} />
          {learner && (
            <div className="grid g2">
              {(
                [
                  ['daily', 'Daily study reminder'],
                  ['tip', 'Tip of the day'],
                  ['exam', 'Exam countdown (7 and 1 days before)'],
                  ['replies', 'Replies to my comments'],
                ] as const
              ).map(([k, label]) => (
                <div key={k} className="row between">
                  <span className="small">{label}</span>
                  <Switch checked={st.reminders[k]} onChange={(v) => set({ reminders: { ...st.reminders, [k]: v } })} label={label} />
                </div>
              ))}
            </div>
          )}
          {learner && (
            <Field label="Reminder time" hint="No messages during quiet hours (9 pm–7 am). Max 1 marketing message per week.">
              <input className="input" type="time" min="07:00" max="21:00" value={st.reminderTime} onChange={(e) => set({ reminderTime: e.target.value })} style={{ width: 160 }} />
            </Field>
          )}
        </div>

        {learner && (
          <div className="card stack">
            <h2>Data and downloads</h2>
            <div className="row between">
              <span>Download videos on Wi-Fi only</span>
              <Switch checked={st.wifiOnly} onChange={(v) => set({ wifiOnly: v })} />
            </div>
            <Field label="Default video quality on mobile data">
              <Seg
                options={[
                  { id: '240p', label: '240p · ~9 MB' },
                  { id: '360p', label: '360p · ~16 MB' },
                  { id: '720p', label: '720p · ~38 MB' },
                ]}
                value={st.quality}
                onChange={(q) => set({ quality: q })}
              />
            </Field>
            <p className="small muted" style={{ margin: 0 }}>
              {Object.values(s.progress[me.id] ?? {}).filter((p) => p.downloaded).length} lessons saved for offline. Practice and mock exams work offline and sync when you reconnect.
            </p>
          </div>
        )}

        <div className="card stack">
          <h2>Security</h2>
          <Field label={st.pin ? 'Change quick-entry PIN' : 'Set a quick-entry PIN (optional)'} hint="Use it instead of an OTP on this device.">
            <div className="row">
              <input className="input" type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} style={{ width: 120 }} />
              <button className="btn" disabled={pin.length !== 4} onClick={() => (set({ pin }), setPin(''), toast('PIN saved'))}>
                <KeyRound size={15} /> Save PIN
              </button>
              {st.pin && (
                <button className="btn ghost" onClick={() => (set({ pin: undefined }), toast('PIN removed', 'info'))}>
                  Remove
                </button>
              )}
            </div>
          </Field>
          <h3 style={{ marginTop: 8 }}>Devices</h3>
          <div className="list">
            {st.devices.map((d) => (
              <div key={d.id} className="list-item">
                <MonitorSmartphone size={17} className="faint" />
                <span className="grow small">
                  {d.name} <span className="faint">· {d.current ? 'this device' : relTime(d.lastSeen)}</span>
                </span>
                {!d.current && (
                  <button className="btn sm" onClick={() => (signOutDevice(me.id, d.id), toast('Signed out of that device'))}>
                    Sign out
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="card stack">
          <h2>
            <LifeBuoy size={18} /> Help & support
          </h2>
          <Field label="Subject">
            <input className="input" value={ticket.subject} onChange={(e) => setTicket({ ...ticket, subject: e.target.value })} />
          </Field>
          <Field label="Describe the problem">
            <textarea className="input" value={ticket.body} onChange={(e) => setTicket({ ...ticket, body: e.target.value })} />
          </Field>
          <div>
            <button className="btn" disabled={ticket.subject.length < 3 || ticket.body.length < 5} onClick={() => (createTicket(me.id, ticket.subject, ticket.body), setTicket({ subject: '', body: '' }), toast('Ticket sent — we reply on WhatsApp or in-app'))}>
              Send to support
            </button>
          </div>
        </div>

        <div className="card stack">
          <h2>Privacy & your data</h2>
          <p className="small muted" style={{ margin: 0 }}>
            Under Law n° 058/2021 you can access, correct, delete or object to the processing of your personal data. <Link to="/privacy">Privacy notice</Link>
          </p>
          <div className="row wrap">
            <button className="btn" onClick={exportData}>
              <Download size={15} /> Download my data
            </button>
            <button className="btn" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={15} /> Request account deletion
            </button>
          </div>
        </div>

        <div className="card row between wrap">
          <div>
            <strong>Demo tools</strong>
            <div className="small muted">Restore the original sample data for every role.</div>
          </div>
          <div className="row">
            <button className="btn" onClick={() => (resetDemo(), toast('Demo data reset', 'info'))}>
              Reset demo data
            </button>
            <button className="btn danger" onClick={() => (logout(), navigate('/'))}>
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </div>
      </div>
      {confirmDelete && (
        <Confirm
          title="Request account deletion"
          body={
            <>
              <p>Our team will delete your account and personal data within the legal deadline. Certificates already issued stay verifiable by the school.</p>
              <Badge tone="warning">This cannot be undone</Badge>
            </>
          }
          confirmLabel="Send request"
          danger
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => {
            createTicket(me.id, 'Data deletion request', `Please delete the account ${me.phone} and its personal data.`)
            toast('Deletion request sent to the platform team')
          }}
        />
      )}
    </div>
  )
}

export function Privacy() {
  return (
    <div className="content narrow" style={{ paddingTop: 32 }}>
      <Link to="/">← RoadReady</Link>
      <h1 className="mt">Privacy notice</h1>
      <p className="muted">Plain-language summary (available in Kinyarwanda, English and French).</p>
      <div className="card stack">
        <p>
          <strong>What we collect:</strong> your phone number, name, date of birth, district, study activity (lessons watched, answers, notes, comments) and payments. Your national ID is collected only when your school issues a certificate, and only the last 4 digits are shown.
        </p>
        <p>
          <strong>Why:</strong> to run your lessons, build your study plan, show your progress to your school (only with your consent when you move schools) and issue verifiable certificates.
        </p>
        <p>
          <strong>Minors:</strong> learners aged 16–17 need guardian consent before their account becomes active.
        </p>
        <p>
          <strong>Where:</strong> data is stored in Rwanda or with NCSA authorisation, in line with Law n° 058/2021.
        </p>
        <p>
          <strong>Your rights:</strong> access, correction, deletion and objection — from Settings or via support.
        </p>
      </div>
    </div>
  )
}
