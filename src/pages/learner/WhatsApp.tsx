import { Send } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Scene from '../../components/Scene'
import { PageHead } from '../../components/ui'
import { hasExamPass } from '../../lib/access'
import { isCorrect, pickQuestions, readiness, studyPlan } from '../../lib/engine'
import { checkAnswer, setAnswer, startAttempt, submitAttempt, updateSettings } from '../../store/actions'
import { getState, useAppState, useMe } from '../../store/store'
import type { SceneKind } from '../../types'
import { tipOfDay } from './Home'

interface Msg {
  id: number
  from: 'bot' | 'me'
  text: string
  buttons?: { label: string; value: string }[]
  used?: boolean
  link?: { to: string; label: string }
  clip?: SceneKind
  at: string
}

const time = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const KEY = 'dslp-wa'

export default function WhatsApp() {
  const s = useAppState()
  const me = useMe()
  const [msgs, setMsgs] = useState<Msg[]>(() => {
    try {
      const saved = sessionStorage.getItem(`${KEY}-${me.id}`)
      if (saved) return JSON.parse(saved)
    } catch {
      /* ignore */
    }
    return [
      {
        id: 1,
        from: 'bot',
        at: time(),
        text: `Muraho ${me.name.split(' ')[0]}! 👋 I'm your RoadReady study bot.\n\nType:\n• *Quiz* — 3 questions on your weak topics\n• *Score* — your readiness\n• *Tip* — Inama y'uyu munsi\n• *Lesson* — a short clip from your next lesson\n• *Mock* — open a timed mock exam\n${me.role === 'individual' ? '• *Pay* — Exam Pass by MoMo\n' : ''}• *STOP* — stop reminders`,
        buttons: [
          { label: 'Quiz', value: 'quiz' },
          { label: 'Score', value: 'score' },
          { label: 'Tip', value: 'tip' },
        ],
      },
    ]
  })
  const [input, setInput] = useState('')
  const [quiz, setQuiz] = useState<{ attemptId: string; idx: number } | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const nextId = useRef(msgs.length + 1)

  useEffect(() => {
    try {
      sessionStorage.setItem(`${KEY}-${me.id}`, JSON.stringify(msgs.slice(-60)))
    } catch {
      /* ignore */
    }
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [msgs, me.id])

  const push = (m: Omit<Msg, 'id' | 'at'>, delay = 0) =>
    setTimeout(() => setMsgs((xs) => [...xs, { ...m, id: nextId.current++, at: time() }]), delay)

  const askQuestion = (attemptId: string, idx: number, delay = 500) => {
    const a = getState().attempts.find((x) => x.id === attemptId)!
    const q = getState().questions.find((x) => x.id === a.questionIds[idx])!
    push({ from: 'bot', text: `*Question ${idx + 1}/${a.questionIds.length}*\n${q.prompt}`, clip: q.scene, buttons: q.options.map((o, i) => ({ label: `${String.fromCharCode(65 + i)}. ${o}`.slice(0, 60), value: `ans:${i}` })) }, delay)
  }

  const handle = (raw: string) => {
    const text = raw.trim()
    if (!text) return
    if (!text.startsWith('ans:')) setMsgs((xs) => [...xs, { id: nextId.current++, from: 'me', text, at: time() }])
    const cmd = text.toLowerCase()

    if (cmd.startsWith('ans:') && quiz) {
      const choice = Number(cmd.slice(4))
      const a = getState().attempts.find((x) => x.id === quiz.attemptId)!
      const qid = a.questionIds[quiz.idx]
      const q = getState().questions.find((x) => x.id === qid)!
      setMsgs((xs) => [...xs.map((m) => (m.buttons && !m.used ? { ...m, used: true } : m)), { id: nextId.current++, from: 'me', text: q.options[choice], at: time() }])
      const ans = [choice]
      setAnswer(a.id, qid, ans)
      checkAnswer(a.id, qid)
      const ok = isCorrect(q, ans)
      const lesson = getState().lessons.find((l) => l.id === q.lessonId)
      push({ from: 'bot', text: `${ok ? '✅ Correct!' : `❌ Not quite. Right answer: *${q.correct.map((c) => q.options[c]).join(', ')}*`}\n\n${q.explanation}\n🔊 Kinyarwanda voice note available in the app.`, link: lesson ? { to: `/app/learn/lesson/${lesson.id}?t=${Math.round((lesson.durationSec / 8) * 2)}`, label: `▶ Lesson clip: ${lesson.title}` } : undefined }, 500)
      if (quiz.idx + 1 < a.questionIds.length) {
        setQuiz({ ...quiz, idx: quiz.idx + 1 })
        askQuestion(a.id, quiz.idx + 1, 1300)
      } else {
        submitAttempt(a.id)
        setQuiz(null)
        setTimeout(() => {
          const done = getState().attempts.find((x) => x.id === a.id)!
          const r = readiness(getState(), me.id)
          push({ from: 'bot', text: `📊 *Summary*: ${Math.round(((done.score ?? 0) / 100) * done.questionIds.length)}/${done.questionIds.length} correct.\nNew readiness: *${r.value}%* (${r.label}).\n\nType *Quiz* for 3 more, or *Score* for details.`, buttons: [{ label: 'Quiz', value: 'quiz' }, { label: 'Score', value: 'score' }] })
        }, 1300)
      }
      return
    }
    if (['hi', 'hello', 'muraho', 'quiz', 'ikizamini', 'bonjour'].includes(cmd)) {
      // WhatsApp quiz: 3 single-tap questions, weak topics first, to fit the service window
      const st = getState()
      const tappable = (id: string) => st.questions.find((x) => x.id === id)?.type !== 'multi'
      const qids = [...pickQuestions(st, me, 'quick'), ...pickQuestions(st, me, 'weak_drill')].filter((v, i, arr) => tappable(v) && arr.indexOf(v) === i).slice(0, 3)
      const id = startAttempt(me.id, 'quick', { channel: 'whatsapp', questionIds: qids })
      const n = qids.length
      setQuiz({ attemptId: id, idx: 0 })
      push({ from: 'bot', text: `Let's go — ${n} scenario questions, weak topics first 💪` }, 300)
      askQuestion(id, 0, 900)
      return
    }
    if (cmd === 'score') {
      const r = readiness(getState(), me.id)
      push({ from: 'bot', text: `📈 Readiness: *${r.value}%* — ${r.label}\n\nWeakest topics:\n${r.weakest.map((w, i) => `${i + 1}. ${getState().topics.find((t) => t.id === w.topicId)?.title} (${w.value}%)`).join('\n')}\n\nMocks passed: ${r.mocksPassed}/2`, buttons: [{ label: 'Quiz', value: 'quiz' }] }, 400)
      return
    }
    if (cmd === 'tip' || cmd === 'inama') {
      const t = tipOfDay()
      push({ from: 'bot', text: `💡 *Inama y'uyu munsi*\n${t.rw}${me.language !== 'rw' ? `\n\n_${me.language === 'fr' ? t.fr : t.en}_` : ''}` }, 400)
      return
    }
    if (cmd === 'lesson' || cmd === 'isomo') {
      const plan = studyPlan(getState(), me.id).find((p) => p.kind === 'lesson')
      const lesson = plan && getState().lessons.find((l) => plan.to.endsWith(l.id))
      if (lesson) push({ from: 'bot', text: `🎬 45-second clip from *${lesson.title}* (compressed to save your data):`, clip: lesson.scene, link: { to: `/app/learn/lesson/${lesson.id}`, label: 'Open the full lesson' } }, 400)
      else push({ from: 'bot', text: 'You have finished all your lessons 🎉 Type *Mock* for a full exam.' }, 400)
      return
    }
    if (cmd === 'mock') {
      push({ from: 'bot', text: '⏱️ The timed mock exam opens in the app/web (20 questions, 20 minutes, no going back).', link: { to: '/app/practice/start/mock', label: 'Start mock exam' } }, 400)
      return
    }
    if (cmd === 'pay') {
      if (hasExamPass(me)) push({ from: 'bot', text: '✅ You already have full access.' }, 300)
      else push({ from: 'bot', text: `💳 Exam Pass — RWF ${getState().pricing.examPass.toLocaleString()} for ${getState().pricing.examPassDays} days. Pay securely with MoMo (we never ask for your PIN in chat):`, link: { to: '/app/plans', label: 'Pay with MoMo' } }, 400)
      return
    }
    if (cmd === 'stop') {
      updateSettings(me.id, { channels: { ...getState().settings[me.id].channels, whatsapp: false } })
      push({ from: 'bot', text: '🔕 Reminders stopped. You will not receive messages from us. Type *START* to turn them back on.' }, 300)
      return
    }
    if (cmd === 'start') {
      updateSettings(me.id, { channels: { ...getState().settings[me.id].channels, whatsapp: true } })
      push({ from: 'bot', text: '🔔 Reminders are back on. See you tomorrow morning with your tip!' }, 300)
      return
    }
    if (/\b\d{16}\b/.test(cmd) || /pin|password/.test(cmd)) {
      push({ from: 'bot', text: '⚠️ Please never share ID numbers, PINs or payment details in chat.' }, 300)
      return
    }
    push({ from: 'bot', text: "Sorry, I didn't get that. Type *Quiz*, *Score*, *Tip*, *Lesson* or *Mock*.", buttons: [{ label: 'Quiz', value: 'quiz' }, { label: 'Score', value: 'score' }] }, 300)
  }

  const reminders = s.notifications.filter((n) => n.userId === me.id && n.channel === 'whatsapp').slice(0, 4)
  const waOn = s.settings[me.id]?.channels.whatsapp

  return (
    <div>
      <PageHead title="WhatsApp bot" sub="Simulator of the WhatsApp channel: same account and data as the app, progress shows everywhere instantly." />
      <div className="grid g-side">
        <div className="wa">
          <div className="wa-head">
            <span className="avatar sm" style={{ background: '#25d366', color: '#fff' }}>
              RR
            </span>
            <div className="grow">
              <strong>RoadReady</strong>
              <div className="tiny" style={{ opacity: 0.8 }}>
                Business account · {waOn ? 'reminders on' : 'reminders off'}
              </div>
            </div>
            <button className="btn sm" style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.4)' }} onClick={() => (setMsgs(msgs.slice(0, 1)), setQuiz(null))}>
              Clear
            </button>
          </div>
          <div className="wa-body" ref={bodyRef}>
            {msgs.map((m) => (
              <div key={m.id} className={`wa-msg ${m.from === 'bot' ? 'in' : 'out'}`}>
                {m.clip && (
                  <div style={{ borderRadius: 6, overflow: 'hidden', marginBottom: 6, maxWidth: 280 }}>
                    <Scene kind={m.clip} animate />
                  </div>
                )}
                {m.text.split(/(\*[^*]+\*)/).map((part, i) => (part.startsWith('*') && part.endsWith('*') ? <b key={i}>{part.slice(1, -1)}</b> : part))}
                {m.link && (
                  <div style={{ marginTop: 6 }}>
                    <Link to={m.link.to} style={{ color: '#027eb5', fontWeight: 600 }}>
                      {m.link.label}
                    </Link>
                  </div>
                )}
                {m.buttons && (
                  <div className="wa-btns">
                    {m.buttons.map((b) => (
                      <button key={b.value} disabled={m.used} onClick={() => handle(b.value)}>
                        {b.label}
                      </button>
                    ))}
                  </div>
                )}
                <div className="t">{m.at}</div>
              </div>
            ))}
          </div>
          <form
            className="wa-foot"
            onSubmit={(e) => {
              e.preventDefault()
              handle(input)
              setInput('')
            }}
          >
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type Quiz, Score, Tip, Lesson, Mock…" aria-label="Message" />
            <button aria-label="Send">
              <Send size={18} />
            </button>
          </form>
        </div>
        <div className="stack lg">
          <div className="card">
            <h3>How the WhatsApp channel works</h3>
            <ul className="small muted" style={{ paddingLeft: 18, margin: 0 }}>
              <li>Learners start conversations ("Quiz" keyword) so replies stay in the cheaper service window.</li>
              <li>Answers update mastery and readiness exactly like the app.</li>
              <li>Full lessons, mock exams and dashboards stay in the app and web.</li>
              <li>"STOP" ends reminders immediately.</li>
              <li>No sensitive data (ID numbers, payment details) is collected in chat.</li>
            </ul>
          </div>
          <div className="card">
            <h3>Recent template messages</h3>
            {reminders.length === 0 ? (
              <p className="small muted">None yet.</p>
            ) : (
              reminders.map((n) => (
                <div key={n.id} className="small" style={{ marginBottom: 8 }}>
                  <strong>{n.title}</strong>
                  <div className="muted">{n.body}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
