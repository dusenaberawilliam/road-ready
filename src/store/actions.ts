// All user-facing mutations. Each maps 1:1 to a future REST endpoint (§19,
// /api/v1). Swap the body of each function for an API call + cache update.
import type { Draft } from 'immer'
import { isCorrect, modeInfo, nextMastery, pickQuestions, readiness, REVIEW_STEPS, scoreAttempt } from '../lib/engine'
import { DAY, daysFromNow, isoDay, now, sha256, uid } from '../lib/util'
import type {
  Attempt,
  Cohort,
  Lang,
  Lesson,
  LessonProgress,
  Note,
  Notification,
  PracticeMode,
  Post,
  Question,
  Role,
  School,
  TeacherTest,
  User,
  UserSettings,
} from '../types'
import type { AppState } from './state'
import { getState, update } from './store'

type D = Draft<AppState>

const audit = (s: D, actorId: string, action: string, target: string) =>
  s.audit.unshift({ id: uid('au'), actorId, action, target, createdAt: now() })

export const notify = (s: D, userId: string, n: Omit<Notification, 'id' | 'userId' | 'read' | 'createdAt'>) => {
  const settings = s.settings[userId]
  if (n.channel === 'whatsapp' && settings && !settings.channels.whatsapp) n = { ...n, channel: 'push' }
  s.notifications.unshift({ id: uid('nt'), userId, read: false, createdAt: now(), ...n })
}

const touch = (s: D, userId: string) => {
  const u = s.users.find((x) => x.id === userId)
  if (u) u.lastActive = now()
  const day = isoDay()
  s.studyDays[userId] ??= []
  if (!s.studyDays[userId].includes(day)) s.studyDays[userId].push(day)
}

const staffOf = (s: D | AppState, schoolId: string, role: Role) => s.users.filter((u) => u.schoolId === schoolId && u.role === role)

// ─── Auth & onboarding (§4) ──────────────────────────────────────────────
export function requestOtp(phone: string) {
  const code = String(Math.floor(100000 + Math.random() * 900000))
  update((s) => {
    s.otpLog.unshift({ phone, code, at: now() })
  })
  return code
}

export const verifyOtp = (phone: string, code: string) => getState().otpLog.some((o) => o.phone === phone && o.code === code)

export const findUserByPhone = (phone: string) => getState().users.find((u) => u.phone === normalisePhone(phone))

export const normalisePhone = (p: string) => {
  const digits = p.replace(/\D/g, '')
  if (digits.startsWith('250')) return `+${digits}`
  if (digits.startsWith('0')) return `+250${digits.slice(1)}`
  return `+250${digits}`
}

export function login(userId: string) {
  update((s) => {
    s.sessionUserId = userId
    const u = s.users.find((x) => x.id === userId)
    if (u) u.lastActive = now()
    s.settings[userId] ??= defaultSettings()
  })
}

export function logout() {
  update((s) => {
    s.sessionUserId = null
  })
}

export const defaultSettings = (): UserSettings => ({
  reminderTime: '07:30',
  channels: { push: true, whatsapp: true, sms: false, email: false },
  reminders: { daily: true, tip: true, exam: true, replies: true },
  wifiOnly: true,
  quality: '360p',
  hideFromBoards: false,
  devices: [{ id: uid('d'), name: navigator.userAgent.includes('Mobile') ? 'This phone · web' : 'This browser · web', lastSeen: now(), current: true }],
})

export function registerLearner(phone: string, language: Lang) {
  const id = uid('u')
  update((s) => {
    s.users.push({
      id,
      phone: normalisePhone(phone),
      name: '',
      dob: '',
      district: '',
      role: 'individual',
      language,
      plan: 'free',
      consent: 'not_required',
      status: 'active',
      lastActive: now(),
      createdAt: now(),
      onboarded: false,
    })
    s.sessionUserId = id
    s.settings[id] = defaultSettings()
  })
  return id
}

export function updateUser(userId: string, patch: Partial<User>) {
  update((s) => {
    const u = s.users.find((x) => x.id === userId)
    if (u) Object.assign(u, patch)
  })
}

export function findSchoolByCode(code: string) {
  return getState().schools.find((sc) => sc.code.toLowerCase() === code.trim().toLowerCase() && sc.status === 'approved')
}

export function joinSchool(userId: string, schoolId: string, cohortId?: string) {
  update((s) => {
    const u = s.users.find((x) => x.id === userId)!
    const cohort = cohortId ? s.cohorts.find((c) => c.id === cohortId) : s.cohorts.find((c) => c.schoolId === schoolId)
    u.role = 'student'
    u.schoolId = schoolId
    u.cohortId = cohort?.id
    u.category = cohort?.category ?? u.category
    u.plan = 'exam_pass'
    const teacher = cohort && s.users.find((t) => t.id === cohort.teacherId)
    if (teacher) notify(s, teacher.id, { title: 'New student joined', body: `${u.name || u.phone} joined ${cohort!.name}.`, channel: 'dashboard', link: `/app/teacher/students/${u.id}` })
  })
}

export function requestGuardianConsent(childId: string, guardianName: string, guardianPhone: string) {
  update((s) => {
    const child = s.users.find((x) => x.id === childId)!
    const phone = normalisePhone(guardianPhone)
    let g = s.users.find((x) => x.phone === phone && x.role === 'guardian')
    if (!g) {
      g = { id: uid('u'), phone, name: guardianName, dob: '', district: child.district, role: 'guardian', language: child.language, childIds: [], status: 'active', lastActive: now(), createdAt: now(), onboarded: true }
      s.users.push(g)
      s.settings[g.id] = defaultSettings()
    }
    g.childIds = [...new Set([...(g.childIds ?? []), childId])]
    child.guardianId = g.id
    child.consent = 'pending'
    child.status = 'pending_consent'
    notify(s, g.id, { title: 'Consent requested', body: `${child.name} (16–17) asks for your consent to use the platform.`, channel: 'whatsapp', link: '/app/guardian' })
  })
}

export function setConsent(childId: string, granted: boolean) {
  update((s) => {
    const child = s.users.find((x) => x.id === childId)!
    child.consent = granted ? 'granted' : 'pending'
    child.status = granted ? 'active' : 'pending_consent'
    notify(s, childId, { title: granted ? 'Guardian consent received' : 'Guardian declined consent', body: granted ? 'Your account is now active. Happy learning!' : 'Talk to your guardian and try again.', channel: 'push', link: '/app/home' })
    if (child.guardianId) audit(s, child.guardianId, granted ? 'consent.granted' : 'consent.declined', child.name)
  })
}

export function setLanguage(userId: string, language: Lang) {
  updateUser(userId, { language })
}

// ─── Lessons, notes, attachments (§5) ────────────────────────────────────
export function saveProgress(userId: string, lessonId: string, patch: Partial<LessonProgress>) {
  update((s) => {
    s.progress[userId] ??= {}
    const cur = s.progress[userId][lessonId] ?? { videoPct: 0, position: 0, textRead: false, checkPassed: false }
    const next = { ...cur, ...patch }
    if (patch.videoPct !== undefined) next.videoPct = Math.max(cur.videoPct, patch.videoPct)
    s.progress[userId][lessonId] = next
    if (patch.videoPct || patch.textRead || patch.prediction !== undefined) touch(s, userId)
  })
}

export function addNote(note: Omit<Note, 'id' | 'createdAt'>) {
  update((s) => {
    s.notes.unshift({ ...note, id: uid('n'), createdAt: now() })
    touch(s, note.userId)
    if (note.visibility === 'class' && note.cohortId) {
      for (const st of s.users.filter((u) => u.cohortId === note.cohortId))
        notify(s, st.id, { title: 'New class note from your teacher', body: note.itemTitle, channel: 'push', link: `/app/learn/lesson/${note.itemId}` })
    }
  })
}
export function updateNote(id: string, body: string) {
  update((s) => {
    const n = s.notes.find((x) => x.id === id)
    if (n) n.body = body
  })
}
export function deleteNote(id: string) {
  update((s) => {
    s.notes = s.notes.filter((x) => x.id !== id)
  })
}

export function recordDownload(userId: string, attachmentId: string) {
  update((s) => {
    s.downloads[userId] ??= []
    if (!s.downloads[userId].includes(attachmentId)) s.downloads[userId].push(attachmentId)
  })
}

export function reportContent(userId: string, itemKind: 'lesson' | 'question', itemId: string, reason: string) {
  update((s) => {
    s.reports.unshift({ id: uid('r'), itemKind, itemId, userId, reason, status: 'open', createdAt: now() })
    for (const ed of s.users.filter((u) => u.role === 'content_editor'))
      notify(s, ed.id, { title: 'New content report', body: reason.slice(0, 80), channel: 'dashboard', link: '/app/editor/reports' })
  })
}

// ─── Practice & exams (§6, §7) ───────────────────────────────────────────
export function startAttempt(
  userId: string,
  mode: PracticeMode,
  opts: { topicId?: string; lessonId?: string; testId?: string; review?: boolean; channel?: Attempt['channel']; questionIds?: string[] } = {},
) {
  const s = getState()
  const user = s.users.find((u) => u.id === userId)!
  const test = opts.testId ? s.tests.find((t) => t.id === opts.testId) : undefined
  const questionIds = opts.questionIds ?? (test ? [...test.questionIds].sort(() => Math.random() - 0.5) : pickQuestions(s, user, mode, opts))
  const topic = s.topics.find((t) => t.id === opts.topicId)
  const lesson = s.lessons.find((l) => l.id === opts.lessonId)
  const title = test?.title ?? (mode === 'topic' || mode === 'weak_drill' ? `${modeInfo[mode].label}: ${topic?.title ?? 'weakest topic'}` : mode === 'lesson_check' ? `Check yourself: ${lesson?.title}` : modeInfo[mode].label)
  const isExam = mode === 'mock' || (test?.kind === 'exam')
  const attempt: Attempt = {
    id: uid('att'),
    userId,
    mode,
    title,
    questionIds,
    answers: {},
    confidence: {},
    startedAt: now(),
    timeLimitSec: mode === 'mock' ? 20 * 60 : test?.timeLimitMin ? test.timeLimitMin * 60 : undefined,
    examMode: isExam,
    showExplanations: mode === 'mock' || mode === 'diagnostic' || (test && test.showAnswers !== 'after_each') ? 'after' : 'each',
    topicId: opts.topicId,
    lessonId: opts.lessonId,
    testId: opts.testId,
    channel: opts.channel ?? (window.innerWidth < 700 ? 'app' : 'web'),
    appSwitches: 0,
    checked: [],
  }
  update((d) => {
    d.attempts.push(attempt)
    touch(d, userId)
  })
  return attempt.id
}

export function setAnswer(attemptId: string, questionId: string, answer: number[]) {
  update((s) => {
    const a = s.attempts.find((x) => x.id === attemptId)
    if (a && !a.submittedAt && !a.checked?.includes(questionId)) a.answers[questionId] = answer
  })
}

export function setConfidence(attemptId: string, questionId: string, c: 'sure' | 'guess') {
  update((s) => {
    const a = s.attempts.find((x) => x.id === attemptId)
    if (a) a.confidence[questionId] = c
  })
}

const applyAnswer = (s: D, userId: string, q: Draft<Question>, correct: boolean) => {
  s.mastery[userId] ??= {}
  const m = s.mastery[userId][q.topicId] ?? 30
  s.mastery[userId][q.topicId] = Math.round(nextMastery(m, q.difficulty, correct) * 10) / 10
  q.stats.attempts++
  if (correct) q.stats.correct++
  // Spaced repetition: missed questions return after 1, 3, 7, 14 days until right twice in a row
  const r = s.reviews.find((x) => x.userId === userId && x.questionId === q.id)
  if (!correct) {
    if (r) {
      r.misses++
      r.correctStreak = 0
      r.step = 0
      r.dueAt = new Date(Date.now() + REVIEW_STEPS[0] * DAY).toISOString()
    } else s.reviews.push({ userId, questionId: q.id, dueAt: new Date(Date.now() + DAY).toISOString(), step: 0, correctStreak: 0, misses: 1 })
  } else if (r) {
    r.correctStreak++
    if (r.correctStreak >= 2) s.reviews = s.reviews.filter((x) => x !== r)
    else {
      r.step = Math.min(r.step + 1, REVIEW_STEPS.length - 1)
      r.dueAt = new Date(Date.now() + REVIEW_STEPS[r.step] * DAY).toISOString()
    }
  }
}

/** Practice modes: lock the answer and reveal the explanation immediately. */
export function checkAnswer(attemptId: string, questionId: string) {
  update((s) => {
    const a = s.attempts.find((x) => x.id === attemptId)
    const q = s.questions.find((x) => x.id === questionId)
    if (!a || !q || a.checked?.includes(questionId)) return
    a.checked = [...(a.checked ?? []), questionId]
    applyAnswer(s, a.userId, q, isCorrect(q, a.answers[questionId]))
  })
}

export function logAppSwitch(attemptId: string) {
  update((s) => {
    const a = s.attempts.find((x) => x.id === attemptId)
    if (a && !a.submittedAt) a.appSwitches = (a.appSwitches ?? 0) + 1
  })
}

export function submitAttempt(attemptId: string) {
  update((s) => {
    const a = s.attempts.find((x) => x.id === attemptId)
    if (!a || a.submittedAt) return
    for (const id of a.questionIds) {
      if (a.checked?.includes(id)) continue
      const q = s.questions.find((x) => x.id === id)
      if (q) applyAnswer(s, a.userId, q, isCorrect(q, a.answers[id]))
    }
    a.checked = [...a.questionIds]
    const res = scoreAttempt(s.questions as Question[], a)
    a.submittedAt = now()
    a.score = res.score
    a.passed = res.passed
    a.perTopic = res.perTopic
    touch(s, a.userId)
    if (a.mode === 'lesson_check' && a.lessonId && res.score >= 60) {
      s.progress[a.userId] ??= {}
      const p = s.progress[a.userId][a.lessonId] ?? { videoPct: 0, position: 0, textRead: false, checkPassed: false }
      s.progress[a.userId][a.lessonId] = { ...p, checkPassed: true }
    }
    const user = s.users.find((u) => u.id === a.userId)!
    if (a.testId) {
      const test = s.tests.find((t) => t.id === a.testId)
      if (test) notify(s, test.authorId, { title: `${user.name} submitted ${test.title}`, body: `Score ${res.score}%`, channel: 'dashboard', link: `/app/teacher/tests/${test.id}` })
    }
    // Exam-ready alert to the teacher (§13)
    const r = readiness(s as AppState, a.userId)
    if (r.examReady && user.cohortId) {
      const cohort = s.cohorts.find((c) => c.id === user.cohortId)
      const already = s.notifications.some((n) => n.userId === cohort?.teacherId && n.title.startsWith(`${user.name} reached exam-ready`))
      if (cohort && !already) notify(s, cohort.teacherId, { title: `${user.name} reached exam-ready`, body: `Readiness ${r.value}%.`, channel: 'email', link: '/app/teacher/exam-ready' })
    }
  })
}

// ─── Discussions (§16) ───────────────────────────────────────────────────
const FILTERS: [RegExp, string][] = [
  [/(\+?250|0)7\d[\s-]?\d{3}[\s-]?\d{3,4}/, 'Phone number detected'],
  [/https?:\/\/|www\./i, 'Link detected'],
  [/\b(stupid|idiot|useless|fool|ikigoryi|injiji)\b/i, 'Possible insult'],
  [/\b\d{16}\b/, 'Possible ID number'],
]

export function addPost(post: Pick<Post, 'spaceId' | 'authorId' | 'body' | 'parentId' | 'videoTime' | 'image'>) {
  const flag = FILTERS.find(([re]) => re.test(post.body))
  const id = uid('p')
  update((s) => {
    const author = s.users.find((u) => u.id === post.authorId)!
    s.posts.push({ ...post, id, createdAt: now(), helpful: [], thanks: [], status: flag ? 'held' : 'visible', reports: [], flagReason: flag?.[1] })
    touch(s, post.authorId)
    if (post.parentId) {
      const parent = s.posts.find((p) => p.id === post.parentId)
      if (parent && parent.authorId !== post.authorId) {
        const isTeacher = author.role === 'teacher'
        notify(s, parent.authorId, { title: isTeacher ? 'Your teacher answered' : `${author.name} replied to your comment`, body: post.body.slice(0, 80), channel: 'push', link: spaceLink(post.spaceId) })
      }
    }
    const mention = post.body.match(/@([A-Z][\w-]+)/)
    if (mention) {
      const t = s.users.find((u) => u.role === 'teacher' && u.schoolId === author.schoolId && u.name.startsWith(mention[1]))
      if (t) notify(s, t.id, { title: `${author.name} mentioned you`, body: post.body.slice(0, 80), channel: 'dashboard', link: spaceLink(post.spaceId) })
    }
  })
  return { id, held: !!flag, reason: flag?.[1] }
}

export const spaceLink = (spaceId: string) => {
  const [kind, id] = spaceId.split(':')
  if (kind === 'lesson') return `/app/learn/lesson/${id}#comments`
  return `/app/discussions/${encodeURIComponent(spaceId)}`
}

export function toggleReaction(postId: string, userId: string, kind: 'helpful' | 'thanks') {
  update((s) => {
    const p = s.posts.find((x) => x.id === postId)
    if (!p) return
    p[kind] = p[kind].includes(userId) ? p[kind].filter((x) => x !== userId) : [...p[kind], userId]
  })
}

export function markBest(postId: string, actorId: string) {
  update((s) => {
    const p = s.posts.find((x) => x.id === postId)
    if (!p) return
    for (const sib of s.posts.filter((x) => x.parentId === p.parentId)) sib.best = false
    p.best = true
    if (p.authorId !== actorId) notify(s, p.authorId, { title: 'Your reply was marked best answer', body: p.body.slice(0, 80), channel: 'push', link: spaceLink(p.spaceId) })
  })
}

export function moderatePost(postId: string, actorId: string, action: 'pin' | 'unpin' | 'hide' | 'delete' | 'approve' | 'dismiss_reports') {
  update((s) => {
    const p = s.posts.find((x) => x.id === postId)
    if (!p) return
    if (action === 'pin') p.pinned = true
    if (action === 'unpin') p.pinned = false
    if (action === 'hide') p.status = 'hidden'
    if (action === 'delete') p.status = 'deleted'
    if (action === 'approve') {
      p.status = 'visible'
      p.flagReason = undefined
    }
    if (action === 'dismiss_reports') p.reports = []
    audit(s, actorId, `moderation.${action}`, `Post by ${s.users.find((u) => u.id === p.authorId)?.name}: "${p.body.slice(0, 40)}"`)
  })
}

export function reportPost(postId: string, userId: string, reason: string) {
  update((s) => {
    const p = s.posts.find((x) => x.id === postId)
    if (p && !p.reports.some((r) => r.by === userId)) p.reports.push({ by: userId, reason })
  })
}

export function muteUser(userId: string, actorId: string, days = 7) {
  update((s) => {
    const u = s.users.find((x) => x.id === userId)
    if (!u) return
    u.mutedUntil = new Date(Date.now() + days * DAY).toISOString()
    audit(s, actorId, 'moderation.mute', `${u.name} for ${days} days`)
    notify(s, userId, { title: 'Posting paused', body: `You cannot post for ${days} days after repeated community rule violations.`, channel: 'push' })
  })
}

// ─── Teacher (§9, §15) ───────────────────────────────────────────────────
export function assignWork(actorId: string, studentIds: string[], lessonIds: string[], note: string, dueAt: string, practiceTopicId?: string) {
  update((s) => {
    for (const sid of studentIds) {
      s.assignments.unshift({ id: uid('as'), userId: sid, lessonIds, note, dueAt, assignedBy: actorId, done: false, createdAt: now(), testId: practiceTopicId })
      notify(s, sid, { title: 'New assignment from your teacher', body: note, channel: 'push', link: '/app/assignments' })
    }
  })
}

export function completeAssignment(id: string) {
  update((s) => {
    const a = s.assignments.find((x) => x.id === id)
    if (a) a.done = true
  })
}

export function addStudentNote(studentId: string, authorId: string, body: string) {
  update((s) => {
    s.studentNotes.unshift({ id: uid('sn'), studentId, authorId, body, createdAt: now() })
  })
}

export function sendNudge(actorId: string, studentIds: string[], message: string) {
  update((s) => {
    for (const id of studentIds) notify(s, id, { title: 'Message from your teacher', body: message, channel: 'whatsapp', link: '/app/home' })
    audit(s, actorId, 'nudge.sent', `${studentIds.length} student(s)`)
  })
}

export function confirmReadiness(studentId: string, teacherId: string) {
  update((s) => {
    const u = s.users.find((x) => x.id === studentId)!
    let c = s.certificates.find((x) => x.userId === studentId && x.status !== 'revoked')
    const lessonsCompleted = Object.values(s.progress[studentId] ?? {}).filter((p) => p.checkPassed).length
    const sessionsAttended = s.attendance.filter((a) => a.present.includes(studentId)).length
    if (!c) {
      const sch = s.schools.find((x) => x.id === u.schoolId)!
      const seq = s.certificates.filter((x) => x.schoolId === sch.id).length + 127
      c = {
        id: uid('cert'),
        number: `${sch.code.split('-')[0]}-${new Date().getFullYear()}-${String(seq).padStart(6, '0')}`,
        userId: studentId,
        schoolId: sch.id,
        category: u.category ?? 'B',
        trainingStart: s.cohorts.find((x) => x.id === u.cohortId)?.startDate ?? u.createdAt,
        trainingEnd: now(),
        lessonsCompleted,
        sessionsAttended,
        status: 'teacher_confirmed',
        confirmedBy: teacherId,
        nationalIdLast4: u.nationalId?.slice(-4),
      }
      s.certificates.push(c)
    } else {
      c.status = 'teacher_confirmed'
      c.confirmedBy = teacherId
      c.lessonsCompleted = lessonsCompleted
      c.sessionsAttended = sessionsAttended
    }
    notify(s, studentId, { title: 'Your teacher marked you exam-ready', body: 'Good luck with the provisional exam!', channel: 'whatsapp', link: '/app/progress' })
    for (const a of staffOf(s, u.schoolId!, 'school_admin'))
      notify(s, a.id, { title: 'Certificate awaiting issuance', body: `${u.name} was confirmed exam-ready.`, channel: 'dashboard', link: '/app/school/certificates' })
    audit(s, teacherId, 'readiness.confirmed', u.name)
  })
}

export function saveLesson(lesson: Lesson, actorId: string) {
  update((s) => {
    const i = s.lessons.findIndex((l) => l.id === lesson.id)
    if (i >= 0) {
      const prev = s.lessons[i]
      s.lessons[i] = { ...lesson, version: prev.status === 'published' ? prev.version + 1 : prev.version, updatedAt: now() }
    } else s.lessons.push({ ...lesson, updatedAt: now() })
    audit(s, actorId, i >= 0 ? 'content.updated' : 'content.created', lesson.title)
  })
}

/** Publishing rule (§5): video + text + ≥1 check question + legal reference. */
export const publishProblems = (s: AppState, l: Lesson) => {
  const p: string[] = []
  if (!l.hasVideo) p.push('A video is required')
  const b = l.blocks
  if (!b.scene.trim() || !b.rule.trim() || !b.why.trim() || !b.onRoad.trim() || !b.trap.trim() || !b.tip.trim() || !b.mission.trim())
    p.push('All 8 text blocks are required')
  if (!b.predict.prompt.trim() || b.predict.options.filter((o) => o.trim()).length < 2) p.push('"What would you do?" needs a prompt and 2+ options')
  if (!s.questions.some((q) => q.lessonId === l.id && q.status !== 'retired' && q.status !== 'archived')) p.push('At least one check-yourself question is required')
  if (!l.legalRef.trim()) p.push('A legal reference is required')
  return p
}

export function setLessonStatus(lessonId: string, status: Lesson['status'], actorId: string) {
  update((s) => {
    const l = s.lessons.find((x) => x.id === lessonId)
    if (!l) return
    l.status = status
    l.updatedAt = now()
    if (status === 'published') {
      l.lawTagged = false
      for (const q of s.questions) if (q.lessonId === l.id && (q.status === 'in_review' || q.status === 'draft')) q.status = 'published'
    }
    audit(s, actorId, `content.${status}`, l.title)
    if (l.schoolId && status === 'in_review') {
      for (const a of staffOf(s, l.schoolId, 'school_admin'))
        notify(s, a.id, { title: 'Teacher content awaiting approval', body: l.title, channel: 'dashboard', link: '/app/school/approvals' })
    }
    if (l.schoolId && status === 'published' && l.authorId !== actorId)
      notify(s, l.authorId, { title: 'Your lesson was approved', body: l.title, channel: 'dashboard', link: '/app/teacher/content' })
    if (l.schoolId && status === 'draft' && l.authorId !== actorId)
      notify(s, l.authorId, { title: 'Your lesson needs changes', body: l.title, channel: 'dashboard', link: `/app/teacher/content/lesson/${l.id}` })
  })
}

export function saveQuestion(q: Question, actorId: string) {
  update((s) => {
    const i = s.questions.findIndex((x) => x.id === q.id)
    if (i >= 0) s.questions[i] = { ...q, version: s.questions[i].status === 'published' ? s.questions[i].version + 1 : q.version }
    else s.questions.push(q)
    audit(s, actorId, i >= 0 ? 'question.updated' : 'question.created', q.prompt.slice(0, 50))
  })
}

export function setQuestionStatus(id: string, status: Question['status'], actorId: string) {
  update((s) => {
    const q = s.questions.find((x) => x.id === id)
    if (q) {
      q.status = status
      audit(s, actorId, `question.${status}`, q.prompt.slice(0, 50))
    }
  })
}

export function importQuestions(rows: Omit<Question, 'id' | 'stats' | 'version'>[], actorId: string) {
  update((s) => {
    for (const r of rows) s.questions.push({ ...r, id: uid('q'), version: 1, stats: { attempts: 0, correct: 0 } })
    audit(s, actorId, 'question.bulk_import', `${rows.length} questions`)
  })
}

export function saveTest(test: TeacherTest, actorId: string) {
  update((s) => {
    const i = s.tests.findIndex((t) => t.id === test.id)
    const prev = i >= 0 ? s.tests[i] : null
    if (i >= 0) s.tests[i] = test
    else s.tests.unshift(test)
    if (test.status === 'published' && prev?.status !== 'published') {
      for (const st of s.users.filter((u) => u.cohortId === test.cohortId && u.role === 'student'))
        notify(s, st.id, { title: `New ${test.kind} from your teacher`, body: test.title, channel: 'push', link: '/app/assignments' })
    }
    audit(s, actorId, `${test.kind}.${test.status}`, test.title)
  })
}

export function setCohortLessonHidden(cohortId: string, lessonId: string, hidden: boolean) {
  update((s) => {
    const c = s.cohorts.find((x) => x.id === cohortId)
    if (!c) return
    c.hiddenLessonIds = hidden ? [...new Set([...c.hiddenLessonIds, lessonId])] : c.hiddenLessonIds.filter((x) => x !== lessonId)
  })
}

export function recordAttendance(cohortId: string, topic: string, present: string[], actorId: string) {
  update((s) => {
    s.attendance.unshift({ id: uid('at'), cohortId, date: now(), topic, present })
    audit(s, actorId, 'attendance.recorded', `${topic} · ${present.length} present`)
  })
}

export function reportExamResult(userId: string, passed: boolean, score?: number, date = now()) {
  update((s) => {
    s.examResults.unshift({ id: uid('ex'), userId, date, passed, score })
    const u = s.users.find((x) => x.id === userId)!
    const cohort = s.cohorts.find((c) => c.id === u.cohortId)
    if (cohort) notify(s, cohort.teacherId, { title: `${u.name} reported an exam result`, body: passed ? `Passed${score ? ` (${score}%)` : ''} — please confirm.` : 'Did not pass — consider a new study plan.', channel: 'dashboard', link: '/app/teacher/results' })
  })
}

export function confirmExamResult(resultId: string, teacherId: string) {
  update((s) => {
    const r = s.examResults.find((x) => x.id === resultId)
    if (!r) return
    r.confirmedBy = teacherId
    const u = s.users.find((x) => x.id === r.userId)!
    const sch = s.schools.find((x) => x.id === u.schoolId)
    if (sch) {
      const passes = Math.round((sch.passRate / 100) * sch.confirmedResults) + (r.passed ? 1 : 0)
      sch.confirmedResults++
      sch.passRate = Math.round((passes / sch.confirmedResults) * 100)
    }
    audit(s, teacherId, 'exam_result.confirmed', `${u.name} · ${r.passed ? 'passed' : 'failed'}`)
  })
}

// ─── School admin (§9, §11, §12) ─────────────────────────────────────────
export function addStaff(schoolId: string, name: string, phone: string, role: 'teacher' | 'school_admin', actorId: string) {
  const id = uid('u')
  update((s) => {
    s.users.push({ id, phone: normalisePhone(phone), name, dob: '', district: s.schools.find((x) => x.id === schoolId)?.district ?? '', role, language: 'en', schoolId, status: 'active', lastActive: now(), createdAt: now(), onboarded: true })
    s.settings[id] = defaultSettings()
    audit(s, actorId, 'staff.added', `${name} (${role})`)
  })
  return id
}

export function removeUserFromSchool(userId: string, actorId: string) {
  update((s) => {
    const u = s.users.find((x) => x.id === userId)
    if (!u) return
    audit(s, actorId, `${u.role}.removed`, u.name)
    if (u.role === 'student') {
      u.role = 'individual'
      u.plan = 'free'
    } else u.status = 'suspended'
    u.schoolId = undefined
    u.cohortId = undefined
    for (const c of s.cohorts.filter((x) => x.teacherId === userId)) c.teacherId = ''
  })
}

export function saveCohort(c: Cohort, actorId: string) {
  update((s) => {
    const i = s.cohorts.findIndex((x) => x.id === c.id)
    if (i >= 0) s.cohorts[i] = c
    else s.cohorts.push(c)
    audit(s, actorId, i >= 0 ? 'cohort.updated' : 'cohort.created', c.name)
  })
}

export function moveStudent(userId: string, cohortId: string) {
  update((s) => {
    const u = s.users.find((x) => x.id === userId)
    const c = s.cohorts.find((x) => x.id === cohortId)
    if (u && c) {
      u.cohortId = c.id
      u.category = c.category
    }
  })
}

export function enrolByPhone(schoolId: string, cohortId: string, name: string, phone: string, actorId: string) {
  const p = normalisePhone(phone)
  const existing = getState().users.find((u) => u.phone === p)
  if (existing?.schoolId && existing.schoolId !== schoolId) return { ok: false as const, error: 'This learner is active at another school. They must request the move themselves.' }
  update((s) => {
    const c = s.cohorts.find((x) => x.id === cohortId)!
    let u = s.users.find((x) => x.phone === p)
    if (!u) {
      u = { id: uid('u'), phone: p, name, dob: '', district: '', role: 'student', language: 'rw', status: 'active', lastActive: now(), createdAt: now(), onboarded: false, consent: 'not_required' }
      s.users.push(u)
      s.settings[u.id] = defaultSettings()
    }
    u.role = 'student'
    u.schoolId = schoolId
    u.cohortId = cohortId
    u.category = c.category
    u.plan = 'exam_pass'
    notify(s, u.id, { title: 'You were enrolled', body: `Welcome to ${s.schools.find((x) => x.id === schoolId)?.name}!`, channel: 'whatsapp', link: '/app/home' })
    audit(s, actorId, 'student.enrolled', `${name} → ${c.name}`)
  })
  return { ok: true as const }
}

export async function issueCertificate(certId: string, adminId: string) {
  const s = getState()
  const c = s.certificates.find((x) => x.id === certId)!
  const u = s.users.find((x) => x.id === c.userId)!
  const issuedAt = now()
  const hash = await sha256([c.number, u.name, u.dob, c.schoolId, c.category, c.trainingStart, c.trainingEnd, issuedAt].join('|'))
  update((d) => {
    const cert = d.certificates.find((x) => x.id === certId)!
    cert.status = 'issued'
    cert.issuedBy = adminId
    cert.issuedAt = issuedAt
    cert.hash = hash
    const learner = d.users.find((x) => x.id === cert.userId)
    if (learner?.nationalId) cert.nationalIdLast4 = learner.nationalId.slice(-4)
    notify(d, cert.userId, { title: 'Your certificate was issued', body: `Certificate ${cert.number} is ready to share.`, channel: 'whatsapp', link: '/app/certificate' })
    audit(d, adminId, 'certificate.issued', `${cert.number} · ${u.name}`)
  })
}

export function revokeCertificate(certId: string, adminId: string, reason: string) {
  update((s) => {
    const c = s.certificates.find((x) => x.id === certId)!
    c.status = 'revoked'
    c.revokedReason = reason
    notify(s, c.userId, { title: 'Your certificate was revoked', body: reason, channel: 'push', link: '/app/certificate' })
    audit(s, adminId, 'certificate.revoked', `${c.number} — ${reason}`)
  })
}

export function payInvoice(invoiceId: string, method: 'MTN MoMo' | 'Airtel Money' | 'Card' | 'Bank transfer', actorId: string) {
  update((s) => {
    const inv = s.invoices.find((x) => x.id === invoiceId)!
    const pending = method === 'Bank transfer'
    if (!pending) {
      inv.status = 'paid'
      inv.paidAt = now()
      inv.method = method
    }
    s.payments.unshift({ id: uid('pay'), payerId: inv.schoolId, payerKind: 'school', amount: inv.total, method, reference: `${method === 'Airtel Money' ? 'AM' : method === 'Card' ? 'CD' : method === 'Bank transfer' ? 'BT' : 'MP'}${Date.now().toString().slice(-10)}`, status: pending ? 'pending' : 'confirmed', createdAt: now(), purpose: `Invoice ${inv.month}` })
    audit(s, actorId, pending ? 'invoice.bank_transfer_declared' : 'invoice.paid', `${inv.month} · ${inv.total}`)
    if (pending) for (const sa of s.users.filter((u) => u.role === 'super_admin')) notify(s, sa.id, { title: 'Bank transfer to confirm', body: `${s.schools.find((x) => x.id === inv.schoolId)?.name} · invoice ${inv.month}`, channel: 'dashboard', link: '/app/admin/finance' })
  })
}

export function confirmBankTransfer(paymentId: string, actorId: string) {
  update((s) => {
    const p = s.payments.find((x) => x.id === paymentId)!
    p.status = 'confirmed'
    const inv = s.invoices.find((i) => i.schoolId === p.payerId && `Invoice ${i.month}` === p.purpose)
    if (inv) {
      inv.status = 'paid'
      inv.paidAt = now()
      inv.method = 'Bank transfer'
    }
    audit(s, actorId, 'payment.confirmed', p.reference)
  })
}

export function updateSchool(schoolId: string, patch: Partial<School>, actorId: string) {
  update((s) => {
    const sc = s.schools.find((x) => x.id === schoolId)
    if (sc) Object.assign(sc, patch)
    audit(s, actorId, 'school.updated', Object.keys(patch).join(', '))
  })
}

export function decideEnrolment(reqId: string, accept: boolean, actorId: string, cohortId?: string) {
  update((s) => {
    const r = s.enrolmentRequests.find((x) => x.id === reqId)!
    r.status = accept ? 'accepted' : 'declined'
    const u = s.users.find((x) => x.id === r.userId)!
    const sch = s.schools.find((x) => x.id === r.schoolId)!
    if (accept) {
      const c = s.cohorts.find((x) => x.id === cohortId) ?? s.cohorts.find((x) => x.schoolId === sch.id)
      u.role = 'student'
      u.schoolId = sch.id
      u.cohortId = c?.id
      u.category = c?.category ?? u.category
      u.plan = 'exam_pass'
      // Without consent to share, the school only sees activity from today on
      u.historyVisibleFrom = r.shareHistory ? undefined : now()
      // Referral fee earned when the school confirms enrolment (§10)
      const inv = s.invoices.find((i) => i.schoolId === sch.id && i.status !== 'paid')
      if (inv) {
        inv.referralFees += r.referralFee
        inv.total += r.referralFee
      }
    }
    notify(s, u.id, { title: accept ? `${sch.name} accepted your request` : `${sch.name} declined your request`, body: accept ? 'Welcome! Your study history moved with you.' : 'You can request another partner school.', channel: 'whatsapp', link: accept ? '/app/home' : '/app/schools' })
    audit(s, actorId, accept ? 'enrolment.accepted' : 'enrolment.declined', u.name)
  })
}

export function sendAnnouncement(schoolId: string, authorId: string, body: string, cohortId?: string) {
  update((s) => {
    const spaceId = cohortId ? `class:${cohortId}` : `school:${schoolId}`
    s.posts.push({ id: uid('p'), spaceId, authorId, body, createdAt: now(), helpful: [], thanks: [], status: 'visible', reports: [], pinned: true })
    const recipients = s.users.filter((u) => u.schoolId === schoolId && u.role === 'student' && (!cohortId || u.cohortId === cohortId))
    for (const u of recipients) notify(s, u.id, { title: `Announcement — ${s.schools.find((x) => x.id === schoolId)?.name}`, body, channel: 'whatsapp', link: spaceLink(spaceId) })
    audit(s, authorId, 'announcement.sent', `${recipients.length} recipients`)
  })
}

// ─── Individual learners & marketplace (§3, §10, §12) ─────────────────────
export function buyExamPass(userId: string, method: 'MTN MoMo' | 'Airtel Money' | 'Card', code?: string) {
  update((s) => {
    const u = s.users.find((x) => x.id === userId)!
    const dc = code ? s.discountCodes.find((d) => d.code.toUpperCase() === code.toUpperCase() && d.active) : undefined
    const amount = Math.round(s.pricing.examPass * (1 - (dc?.percent ?? 0) / 100))
    if (dc) dc.uses++
    u.plan = 'exam_pass'
    u.examPassUntil = daysFromNow(s.pricing.examPassDays)
    s.payments.unshift({ id: uid('pay'), payerId: userId, payerKind: 'learner', amount, method, reference: `MP${Date.now().toString().slice(-10)}`, status: 'confirmed', createdAt: now(), purpose: `Exam Pass (${s.pricing.examPassDays} days)` })
    notify(s, userId, { title: 'Exam Pass activated', body: `All lessons and unlimited mocks until ${new Date(u.examPassUntil).toLocaleDateString('en-GB')}.`, channel: 'whatsapp', link: '/app/home' })
  })
}

export function requestRefund(userId: string) {
  const s = getState()
  const mocks = s.attempts.filter((a) => a.userId === userId && a.mode === 'mock' && a.submittedAt).length
  const pay = s.payments.find((p) => p.payerId === userId && p.purpose.startsWith('Exam Pass') && p.status === 'confirmed')
  if (!pay) return { ok: false, error: 'No Exam Pass payment found.' }
  if ((Date.now() - new Date(pay.createdAt).getTime()) / DAY > 7) return { ok: false, error: 'The 7-day refund window has passed.' }
  if (mocks >= 2) return { ok: false, error: 'Refunds are only possible if fewer than 2 mock exams were taken.' }
  update((d) => {
    const p = d.payments.find((x) => x.id === pay.id)!
    p.status = 'refunded'
    const u = d.users.find((x) => x.id === userId)!
    u.plan = 'free'
    u.examPassUntil = undefined
  })
  return { ok: true }
}

export function requestEnrolment(userId: string, schoolId: string, shareHistory: boolean, message: string) {
  update((s) => {
    s.enrolmentRequests.unshift({ id: uid('er'), userId, schoolId, shareHistory, status: 'requested', createdAt: now(), message, referralFee: s.pricing.referralFee })
    const u = s.users.find((x) => x.id === userId)!
    for (const a of staffOf(s, schoolId, 'school_admin'))
      notify(s, a.id, { title: 'New enrolment request', body: `${u.name} wants to join (referral).`, channel: 'whatsapp', link: '/app/school/enrolments' })
  })
}

// ─── Settings & notifications ────────────────────────────────────────────
export function updateSettings(userId: string, patch: Partial<UserSettings>) {
  update((s) => {
    s.settings[userId] = { ...(s.settings[userId] ?? defaultSettings()), ...patch }
  })
}

export function signOutDevice(userId: string, deviceId: string) {
  update((s) => {
    const st = s.settings[userId]
    if (st) st.devices = st.devices.filter((d) => d.id !== deviceId || d.current)
  })
}

export function markNotificationsRead(userId: string, id?: string) {
  update((s) => {
    for (const n of s.notifications) if (n.userId === userId && (!id || n.id === id)) n.read = true
  })
}

// ─── Content editor (§14) ────────────────────────────────────────────────
export function resolveReport(id: string, actorId: string) {
  update((s) => {
    const r = s.reports.find((x) => x.id === id)
    if (!r) return
    r.status = 'resolved'
    notify(s, r.userId, { title: 'Thanks for your report', body: 'Our content team reviewed and fixed the problem you reported.', channel: 'push' })
    audit(s, actorId, 'report.resolved', r.reason.slice(0, 50))
  })
}

/** Law-change mode: every lesson and question linked to the article goes back to review. */
export function tagLawChange(legalRef: string, actorId: string) {
  let count = 0
  update((s) => {
    const affected = s.lessons.filter((l) => l.legalRef.trim().toLowerCase() === legalRef.trim().toLowerCase())
    for (const l of affected) {
      if (l.status === 'published') l.status = 'in_review'
      l.lawTagged = true
      count++
      for (const q of s.questions.filter((x) => x.lessonId === l.id && x.status === 'published')) {
        q.status = 'in_review'
        count++
      }
    }
    audit(s, actorId, 'law_change.tagged', `${legalRef} · ${count} items to review`)
  })
  return count
}

// ─── Super admin (§17) ───────────────────────────────────────────────────
export function setSchoolStatus(schoolId: string, status: School['status'], actorId: string) {
  update((s) => {
    const sc = s.schools.find((x) => x.id === schoolId)!
    sc.status = status
    if (status === 'approved') sc.partner = true
    for (const a of staffOf(s, schoolId, 'school_admin'))
      notify(s, a.id, { title: status === 'approved' ? 'Your school was approved' : 'Your school was suspended', body: status === 'approved' ? `Share code ${sc.code} with your students.` : 'Contact support for details.', channel: 'whatsapp', link: '/app/school' })
    audit(s, actorId, `school.${status}`, sc.name)
  })
}

export function registerSchool(data: Pick<School, 'name' | 'tin' | 'rnpRef' | 'district' | 'phone' | 'address'>, adminName: string) {
  const schoolId = uid('sch')
  const adminId = uid('u')
  update((s) => {
    const prefix = data.name.split(' ').map((w) => w[0]).join('').slice(0, 3).toUpperCase()
    s.schools.push({ ...data, id: schoolId, status: 'pending', plan: 'starter', code: `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`, categories: ['A', 'B'], tuition: [100000, 220000], languages: ['rw', 'en'], schedule: 'Mon–Fri, 8:00–17:00', partner: false, rating: 0, reviews: 0, confirmedResults: 0, passRate: 0, color: '#0277B5', requireContentApproval: false, createdAt: now(), documents: ['RDB certificate.pdf', 'RNP authorisation.pdf'] })
    s.users.push({ id: adminId, phone: normalisePhone(data.phone), name: adminName, dob: '', district: data.district, role: 'school_admin', language: 'en', schoolId, status: 'active', lastActive: now(), createdAt: now(), onboarded: true })
    s.settings[adminId] = defaultSettings()
    s.sessionUserId = adminId
    for (const sa of s.users.filter((u) => u.role === 'super_admin')) notify(s, sa.id, { title: 'New school awaiting approval', body: data.name, channel: 'dashboard', link: '/app/admin/schools' })
  })
  return { schoolId, adminId }
}

export function setUserStatus(userId: string, status: User['status'], actorId: string) {
  update((s) => {
    const u = s.users.find((x) => x.id === userId)!
    u.status = status
    audit(s, actorId, `user.${status}`, u.name)
  })
}

export function resetUserAccess(userId: string, actorId: string) {
  update((s) => {
    const st = s.settings[userId]
    if (st) st.devices = []
    const u = s.users.find((x) => x.id === userId)!
    notify(s, userId, { title: 'Your access was reset', body: 'Sign in again with your phone number and OTP.', channel: 'sms' })
    audit(s, actorId, 'user.access_reset', u.name)
  })
}

export function deleteUserData(userId: string, actorId: string) {
  update((s) => {
    const u = s.users.find((x) => x.id === userId)!
    audit(s, actorId, 'user.data_deleted', `${u.name} (${u.phone})`)
    s.notes = s.notes.filter((n) => n.userId !== userId)
    s.attempts = s.attempts.filter((a) => a.userId !== userId)
    s.reviews = s.reviews.filter((r) => r.userId !== userId)
    delete s.progress[userId]
    delete s.mastery[userId]
    for (const p of s.posts.filter((x) => x.authorId === userId)) {
      p.body = '[deleted]'
      p.status = 'deleted'
    }
    s.users = s.users.filter((x) => x.id !== userId)
  })
}

export function mergeUsers(keepId: string, dropId: string, actorId: string) {
  update((s) => {
    const keep = s.users.find((x) => x.id === keepId)!
    const drop = s.users.find((x) => x.id === dropId)!
    for (const a of s.attempts) if (a.userId === dropId) a.userId = keepId
    for (const n of s.notes) if (n.userId === dropId) n.userId = keepId
    for (const p of s.posts) if (p.authorId === dropId) p.authorId = keepId
    s.progress[keepId] = { ...(s.progress[dropId] ?? {}), ...(s.progress[keepId] ?? {}) }
    const mk = s.mastery[keepId] ?? {}
    const md = s.mastery[dropId] ?? {}
    for (const t of Object.keys(md)) mk[t] = Math.max(mk[t] ?? 0, md[t])
    s.mastery[keepId] = mk
    s.users = s.users.filter((x) => x.id !== dropId)
    audit(s, actorId, 'user.merged', `${drop.name} → ${keep.name}`)
  })
}

export function updatePricing(patch: Partial<AppState['pricing']>, actorId: string) {
  update((s) => {
    Object.assign(s.pricing, patch)
    audit(s, actorId, 'pricing.updated', Object.entries(patch).map(([k, v]) => `${k}=${v}`).join(', '))
  })
}

export function saveDiscountCode(code: string, percent: number, description: string, actorId: string) {
  update((s) => {
    const existing = s.discountCodes.find((d) => d.code === code.toUpperCase())
    if (existing) Object.assign(existing, { percent, description })
    else s.discountCodes.push({ code: code.toUpperCase(), percent, description, active: true, uses: 0 })
    audit(s, actorId, 'discount.saved', code.toUpperCase())
  })
}

export function toggleDiscountCode(code: string, actorId: string) {
  update((s) => {
    const d = s.discountCodes.find((x) => x.code === code)
    if (d) d.active = !d.active
    audit(s, actorId, 'discount.toggled', code)
  })
}

export function generateInvoices(actorId: string) {
  let created = 0
  update((s) => {
    const month = new Date().toISOString().slice(0, 7)
    for (const sc of s.schools.filter((x) => x.status === 'approved')) {
      if (s.invoices.some((i) => i.schoolId === sc.id && i.month === month)) continue
      const active = s.users.filter((u) => u.schoolId === sc.id && u.role === 'student' && Date.now() - new Date(u.lastActive).getTime() < 31 * DAY).length
      const base = sc.plan === 'pro' ? s.pricing.proBase : 0
      const per = sc.plan === 'pro' ? s.pricing.proPerStudent : s.pricing.starterPerStudent
      s.invoices.push({ id: uid('inv'), schoolId: sc.id, month, basePlan: base, activeStudents: active, perStudent: per, referralFees: 0, discount: 0, total: base + active * per, issuedAt: now(), dueAt: daysFromNow(14), status: 'due' })
      created++
    }
    audit(s, actorId, 'invoices.generated', `${created} invoices`)
  })
  return created
}

export function replyTicket(id: string, actorId: string, body: string, resolve: boolean) {
  update((s) => {
    const t = s.tickets.find((x) => x.id === id)!
    if (body.trim()) t.replies.push({ by: actorId, body, at: now() })
    if (resolve) t.status = 'resolved'
    notify(s, t.fromId, { title: `Support: ${t.subject}`, body: body || 'Your ticket was resolved.', channel: t.channel === 'whatsapp' ? 'whatsapp' : 'push' })
  })
}

export function createTicket(fromId: string, subject: string, body: string) {
  update((s) => {
    s.tickets.unshift({ id: uid('tk'), fromId, channel: 'in_app', subject, body, status: 'open', createdAt: now(), replies: [] })
  })
}

export function logAudit(actorId: string, action: string, target: string) {
  update((s) => audit(s, actorId, action, target))
}
