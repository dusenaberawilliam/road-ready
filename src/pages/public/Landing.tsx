import { Award, BarChart3, BookOpen, MessageCircle, PlayCircle, School, ShieldCheck, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DEMO_ACCOUNTS, homeFor, roleLabel } from '../../components/AppShell'
import Scene from '../../components/Scene'
import { Avatar } from '../../components/ui'
import { login } from '../../store/actions'
import { useAppState } from '../../store/store'

export default function Landing() {
  const s = useAppState()
  const navigate = useNavigate()
  const [cert, setCert] = useState('')
  return (
    <div>
      <section className="landing-hero">
        <div className="landing-inner">
          <div className="row between wrap" style={{ marginBottom: 48 }}>
            <strong style={{ fontSize: '1.2rem' }}>RoadReady</strong>
            <div className="row wrap">
              <Link className="btn" to="/verify" style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.4)' }}>
                Verify a certificate
              </Link>
              <Link className="btn" to="/login">
                Sign in
              </Link>
            </div>
          </div>
          <div className="grid g2" style={{ alignItems: 'center', gap: 40 }}>
            <div>
              <h1>
                Your driving school, digital. Your students, <span className="grad-text">road-ready.</span>
              </h1>
              <p>Real-life scenario lessons on Rwandan roads, exam practice that mirrors the provisional theory test, and a dashboard that shows teachers exactly who is ready.</p>
              <div className="row wrap" style={{ marginTop: 24 }}>
                <Link className="btn lg" to="/signup">
                  Start learning free
                </Link>
                <Link className="btn lg" to="/register-school" style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.5)' }}>
                  <School size={18} /> Register your school
                </Link>
              </div>
            </div>
            <div className="player" style={{ boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
              <div className="player-stage">
                <Scene kind="roundabout" sign="roundabout" animate />
                <div className="player-chapter">1/8 · Road scene</div>
                <div className="player-sub">You are riding a moto toward the Sonatubes roundabout at 7 am…</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-inner" style={{ padding: '48px 24px' }}>
        <h2 className="center">Try every role — no sign-up needed</h2>
        <p className="center muted">Pick an account to explore the platform with realistic data. Everything is clickable and saved in your browser.</p>
        <div className="grid g3 mt">
          {DEMO_ACCOUNTS.map((a) => {
            const u = s.users.find((x) => x.id === a.id)
            if (!u) return null
            return (
              <button
                key={a.id}
                className="card hover role-card"
                onClick={() => {
                  login(u.id)
                  navigate(homeFor(u.role))
                }}
              >
                <Avatar name={u.name} />
                <span className="grow">
                  <strong>{roleLabel[a.role]}</strong>
                  <span className="small muted" style={{ display: 'block' }}>
                    {a.blurb}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="landing-inner" style={{ padding: '48px 24px' }}>
          <h2 className="center">One platform, three connected layers</h2>
          <div className="grid g3 mt">
            {[
              { icon: <BookOpen />, title: 'Students', body: 'Scenario-based video + text lessons, notes, discussions, practice and mock exams, a readiness score — on the app, the web and WhatsApp.' },
              { icon: <BarChart3 />, title: 'Teachers & schools', body: 'Class management, teacher-built lessons and exams, gap analytics, discussion moderation, the exam-ready list and verifiable certificates.' },
              { icon: <Users />, title: 'Marketplace', body: 'Individual learners study alone, then get matched to partner schools when they need a certificate or practical lessons.' },
            ].map((x) => (
              <div key={x.title} className="card flat">
                <div style={{ color: 'var(--primary)' }}>{x.icon}</div>
                <h3 className="mt">{x.title}</h3>
                <p className="muted small">{x.body}</p>
              </div>
            ))}
          </div>
          <div className="grid g4 mt">
            {[
              { icon: <PlayCircle size={18} />, t: '8-block lessons', d: 'Road scene → what would you do → rule → why → on the road → trap → tip → mission' },
              { icon: <ShieldCheck size={18} />, t: 'Real exam format', d: '20 questions, timer, no going back — like the computer-based test' },
              { icon: <MessageCircle size={18} />, t: 'WhatsApp', d: 'Daily tip, quick quizzes and reminders where learners already are' },
              { icon: <Award size={18} />, t: 'Certificates', d: 'Issued by the school, verifiable by QR code' },
            ].map((x) => (
              <div key={x.t} className="row top">
                <span style={{ color: 'var(--primary)', marginTop: 2 }}>{x.icon}</span>
                <div>
                  <strong>{x.t}</strong>
                  <div className="small muted">{x.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-inner" style={{ padding: '48px 24px' }}>
        <div className="card row wrap between">
          <div>
            <h3>Verify a completion certificate</h3>
            <p className="small muted" style={{ margin: 0 }}>
              Enter the certificate number printed under the QR code (try <code>KSD-2026-000127</code>).
            </p>
          </div>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault()
              navigate(`/verify/${encodeURIComponent(cert.trim())}`)
            }}
          >
            <input className="input" placeholder="KSD-2026-000127" value={cert} onChange={(e) => setCert(e.target.value)} />
            <button className="btn primary" disabled={!cert.trim()}>
              Verify
            </button>
          </form>
        </div>
        <p className="center faint small mt">
          The platform is a tool for authorised driving schools under RNP supervision (Law n° 014/2026). It does not issue licences or replace RNP tests.
        </p>
      </section>
    </div>
  )
}
