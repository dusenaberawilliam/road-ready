// Adaptive engine and readiness score (PROJECT_SPEC.md §7).
import type { AppState } from '../store/state'
import type { Attempt, Lesson, PracticeMode, Question, User } from '../types'
import { avg, clamp, DAY, pct, shuffle } from './util'

export const PASS_MARK = 60
export const MOCK_LENGTH = 20
export const MOCK_MINUTES = 20
export const LEARNING_RATE = 8
export const REVIEW_STEPS = [1, 3, 7, 14]

export const isCorrect = (q: Question, ans: number[] | undefined) => {
  if (!ans || !ans.length) return false
  const a = [...ans].sort().join(',')
  const c = [...q.correct].sort().join(',')
  return a === c
}

/** m_t = m_{t-1} + k · d · (r − p) */
export const nextMastery = (m: number, difficulty: number, correct: boolean) => {
  const p = clamp(m / 100 - (difficulty - 2) * 0.1, 0.05, 0.95)
  const r = correct ? 1 : 0
  return clamp(m + LEARNING_RATE * difficulty * (r - p))
}

export const scoreAttempt = (qs: Question[], attempt: Pick<Attempt, 'answers' | 'questionIds'>) => {
  const perTopic: Record<string, { correct: number; total: number }> = {}
  let correct = 0
  for (const id of attempt.questionIds) {
    const q = qs.find((x) => x.id === id)
    if (!q) continue
    const ok = isCorrect(q, attempt.answers[id])
    perTopic[q.topicId] ??= { correct: 0, total: 0 }
    perTopic[q.topicId].total++
    if (ok) {
      perTopic[q.topicId].correct++
      correct++
    }
  }
  const score = pct(correct, attempt.questionIds.length)
  return { score, correct, perTopic, passed: score >= PASS_MARK }
}

/** Lessons a user can see: national + their school's published content, minus lessons hidden for their cohort. */
export const visibleLessons = (s: AppState, user: User): Lesson[] => {
  const cohort = s.cohorts.find((c) => c.id === user.cohortId)
  const list = s.lessons.filter(
    (l) =>
      l.status === 'published' &&
      (l.schoolId === null || l.schoolId === user.schoolId) &&
      !cohort?.hiddenLessonIds.includes(l.id),
  )
  // Teachers can order the syllabus per cohort (§15); unlisted lessons keep their natural order
  const order = cohort?.lessonOrder ?? []
  if (!order.length) return list
  const rank = (id: string) => (order.includes(id) ? order.indexOf(id) : order.length)
  return [...list].sort((a, b) => rank(a.id) - rank(b.id))
}

export const visibleQuestions = (s: AppState, user: User) =>
  s.questions.filter((q) => q.status === 'published' && (q.schoolId === null || q.schoolId === user.schoolId))

export const lessonDone = (s: AppState, userId: string, lessonId: string) => {
  const p = s.progress[userId]?.[lessonId]
  return !!p && (p.videoPct >= 90 || p.textRead) && p.checkPassed
}
export const lessonViewed = (s: AppState, userId: string, lessonId: string) => {
  const p = s.progress[userId]?.[lessonId]
  return !!p && (p.videoPct >= 90 || p.textRead)
}

export interface Readiness {
  value: number
  label: 'Not ready' | 'Almost ready' | 'Exam-ready'
  tone: 'danger' | 'warning' | 'success'
  weighted: number
  mockAvg: number | null
  mocksPassed: number
  topicsAttempted: number
  topicsTotal: number
  lessonsViewed: number
  lessonsTotal: number
  examReady: boolean
  missing: string[]
  weakest: { topicId: string; value: number }[]
}

export const readiness = (s: AppState, userId: string): Readiness => {
  const user = s.users.find((u) => u.id === userId)
  const m = s.mastery[userId] ?? {}
  const totalW = s.topics.reduce((a, t) => a + t.examWeight, 0)
  const weighted = s.topics.reduce((a, t) => a + (m[t.id] ?? 0) * t.examWeight, 0) / totalW
  const mocks = s.attempts
    .filter((a) => a.userId === userId && a.mode === 'mock' && a.submittedAt)
    .sort((a, b) => b.submittedAt!.localeCompare(a.submittedAt!))
  const last3 = mocks.slice(0, 3).map((a) => a.score ?? 0)
  const mockAvg = last3.length ? avg(last3) : null
  const value = Math.round(mockAvg === null ? weighted : weighted * 0.7 + mockAvg * 0.3)
  const mocksPassed = mocks.filter((a) => a.passed).length
  const topicsAttempted = s.topics.filter((t) => m[t.id] !== undefined).length
  const lessons = user ? visibleLessons(s, user) : []
  const viewed = lessons.filter((l) => lessonViewed(s, userId, l.id)).length
  const missing: string[] = []
  if (value < 80) missing.push(`Readiness ${value}% (needs 80%)`)
  if (mocksPassed < 2) missing.push(`${mocksPassed}/2 full mocks passed`)
  if (topicsAttempted < s.topics.length) missing.push(`${topicsAttempted}/${s.topics.length} topics attempted`)
  if (viewed < lessons.length) missing.push(`${viewed}/${lessons.length} lessons watched or read`)
  const label = value >= 80 && missing.length === 0 ? 'Exam-ready' : value >= 60 ? 'Almost ready' : 'Not ready'
  const weakest = s.topics
    .map((t) => ({ topicId: t.id, value: Math.round(m[t.id] ?? 0) }))
    .sort((a, b) => a.value - b.value)
    .slice(0, 3)
  return {
    value,
    label,
    tone: label === 'Exam-ready' ? 'success' : label === 'Almost ready' ? 'warning' : 'danger',
    weighted: Math.round(weighted),
    mockAvg: mockAvg === null ? null : Math.round(mockAvg),
    mocksPassed,
    topicsAttempted,
    topicsTotal: s.topics.length,
    lessonsViewed: viewed,
    lessonsTotal: lessons.length,
    examReady: missing.length === 0,
    missing,
    weakest,
  }
}

export const dueReviews = (s: AppState, userId: string) =>
  s.reviews.filter((r) => r.userId === userId && new Date(r.dueAt).getTime() <= Date.now())

export interface PlanItem {
  kind: 'lesson' | 'drill' | 'review' | 'tip' | 'mock'
  title: string
  detail: string
  to: string
  done: boolean
}

/** Daily plan: 1 lesson + 1 weak-topic drill + due reviews + tip; more mocks in the last 7 days before the exam. */
export const studyPlan = (s: AppState, userId: string): PlanItem[] => {
  const user = s.users.find((u) => u.id === userId)!
  const r = readiness(s, userId)
  const lessons = visibleLessons(s, user)
  const topicOrder = [...s.topics].sort((a, b) => a.order - b.order).map((t) => t.id)
  const today = new Date().toDateString()
  const didToday = (mode: PracticeMode) =>
    s.attempts.some((a) => a.userId === userId && a.mode === mode && a.submittedAt && new Date(a.submittedAt).toDateString() === today)
  const daysToExam = user.examDate ? Math.ceil((new Date(user.examDate).getTime() - Date.now()) / DAY) : null
  const finalWeek = daysToExam !== null && daysToExam <= 7 && daysToExam >= 0
  const items: PlanItem[] = []

  // Lessons failed twice are sent back first (§7)
  const struggling = s.reviews.find((rv) => rv.userId === userId && rv.misses >= 2)
  const strugglingQ = struggling && s.questions.find((q) => q.id === struggling.questionId)
  const next =
    (strugglingQ?.lessonId && lessons.find((l) => l.id === strugglingQ.lessonId && !lessonDone(s, userId, l.id))) ||
    [...lessons]
      .sort((a, b) => topicOrder.indexOf(a.topicId) - topicOrder.indexOf(b.topicId))
      .find((l) => !lessonDone(s, userId, l.id))
  if (!finalWeek && next) {
    items.push({ kind: 'lesson', title: next.title, detail: 'Lesson · video + text', to: `/app/learn/lesson/${next.id}`, done: false })
  }
  const weak = r.weakest[0]
  if (weak) {
    const t = s.topics.find((x) => x.id === weak.topicId)!
    items.push({ kind: 'drill', title: `Weak-topic drill: ${t.title}`, detail: `10 questions · mastery ${weak.value}%`, to: `/app/practice/start/weak_drill?topic=${t.id}`, done: didToday('weak_drill') })
  }
  const due = dueReviews(s, userId)
  if (due.length) {
    items.push({ kind: 'review', title: `${due.length} review question${due.length > 1 ? 's' : ''} due`, detail: 'Spaced repetition · 1, 3, 7, 14 days', to: '/app/practice/start/quick?review=1', done: false })
  }
  if (finalWeek) {
    items.push({ kind: 'mock', title: 'Full mock exam', detail: `Exam in ${daysToExam} day${daysToExam === 1 ? '' : 's'} — focus on mocks`, to: '/app/practice/start/mock', done: didToday('mock') })
  }
  items.push({ kind: 'tip', title: 'Tip of the day — Inama y\'uyu munsi', detail: 'A method you can reuse on every question', to: '/app/home#tip', done: false })
  return items
}

/** Topic mix for a mock exam proportional to each topic's share of the real exam. */
export const pickMockQuestions = (qs: Question[], s: AppState, rand: () => number = Math.random) => {
  const pool = qs.filter((q) => q.type !== 'hotspot' && q.type !== 'clip')
  const picked: string[] = []
  const totalW = s.topics.reduce((a, t) => a + t.examWeight, 0)
  for (const t of s.topics) {
    const n = Math.max(1, Math.round((t.examWeight / totalW) * MOCK_LENGTH))
    picked.push(...shuffle(pool.filter((q) => q.topicId === t.id), rand).slice(0, n).map((q) => q.id))
  }
  return shuffle(picked, rand).slice(0, MOCK_LENGTH)
}

export const pickQuestions = (
  s: AppState,
  user: User,
  mode: PracticeMode,
  opts: { topicId?: string; lessonId?: string; review?: boolean } = {},
): string[] => {
  const qs = visibleQuestions(s, user)
  const m = s.mastery[user.id] ?? {}
  switch (mode) {
    case 'lesson_check': {
      const l = qs.filter((q) => q.lessonId === opts.lessonId)
      const lesson = s.lessons.find((x) => x.id === opts.lessonId)
      const fill = qs.filter((q) => q.topicId === lesson?.topicId && q.lessonId !== opts.lessonId)
      return [...shuffle(l), ...shuffle(fill)].slice(0, Math.max(3, Math.min(5, l.length))).map((q) => q.id)
    }
    case 'topic':
    case 'weak_drill': {
      const topicId = opts.topicId ?? readiness(s, user.id).weakest[0]?.topicId
      const inTopic = qs.filter((q) => q.topicId === topicId)
      const extra = mode === 'weak_drill' ? s.topics.filter((t) => (m[t.id] ?? 0) < 60).map((t) => t.id) : []
      const pool = inTopic.length >= 10 ? inTopic : [...inTopic, ...shuffle(qs.filter((q) => q.topicId !== topicId && extra.includes(q.topicId)))]
      return shuffle(pool).slice(0, 10).map((q) => q.id)
    }
    case 'quick': {
      const due = dueReviews(s, user.id).map((r) => r.questionId)
      if (opts.review && due.length) return due.slice(0, 5)
      const weakTopics = readiness(s, user.id).weakest.map((w) => w.topicId)
      const weakQs = shuffle(qs.filter((q) => weakTopics.includes(q.topicId)))
      return [...due, ...weakQs.map((q) => q.id)].filter((v, i, a) => a.indexOf(v) === i).slice(0, 5)
    }
    case 'diagnostic': {
      const out: string[] = []
      for (const t of s.topics) out.push(...shuffle(qs.filter((q) => q.topicId === t.id)).slice(0, 2).map((q) => q.id))
      return shuffle(out).slice(0, 20)
    }
    case 'mock':
    default:
      return pickMockQuestions(qs, s)
  }
}

export const modeInfo: Record<PracticeMode, { label: string; purpose: string; length: string; timer: boolean; explanations: 'each' | 'after' }> = {
  lesson_check: { label: 'Lesson check', purpose: 'Confirm the lesson was understood', length: '3–5 questions', timer: false, explanations: 'each' },
  topic: { label: 'Topic practice', purpose: 'Master one topic', length: '10 questions', timer: false, explanations: 'each' },
  weak_drill: { label: 'Weak-topic drill', purpose: 'Fix gaps found by the engine', length: '10 questions', timer: false, explanations: 'each' },
  quick: { label: 'Quick quiz (daily)', purpose: 'Keep the habit', length: '3–5 questions', timer: false, explanations: 'each' },
  mock: { label: 'Mock exam', purpose: 'Exam simulation', length: `${MOCK_LENGTH} questions · ${MOCK_MINUTES} min`, timer: true, explanations: 'after' },
  diagnostic: { label: 'Diagnostic test', purpose: 'Seed your readiness score', length: '20 questions', timer: false, explanations: 'after' },
  teacher: { label: 'Teacher test / exam', purpose: 'Set by your teacher', length: 'Teacher sets', timer: true, explanations: 'after' },
}

export const studentStats = (s: AppState, userId: string) => {
  const r = readiness(s, userId)
  const mocks = s.attempts.filter((a) => a.userId === userId && a.mode === 'mock' && a.submittedAt)
  const lastActive = s.users.find((u) => u.id === userId)?.lastActive
  const inactiveDays = lastActive ? Math.floor((Date.now() - new Date(lastActive).getTime()) / DAY) : 99
  const minutes = s.attempts
    .filter((a) => a.userId === userId && a.submittedAt)
    .reduce((acc, a) => acc + (new Date(a.submittedAt!).getTime() - new Date(a.startedAt).getTime()) / 60000, 0)
  const lessonMinutes = Object.values(s.progress[userId] ?? {}).reduce((a, p) => a + (p.videoPct / 100) * 4 + (p.textRead ? 5 : 0), 0)
  return { r, mocks, inactiveDays, studyMinutes: Math.round(minutes + lessonMinutes) }
}

/** Readiness trend: recompute-free approximation from mock history + current value. */
export const readinessTrend = (s: AppState, userId: string) => {
  const mocks = s.attempts
    .filter((a) => a.userId === userId && a.mode === 'mock' && a.submittedAt)
    .sort((a, b) => a.submittedAt!.localeCompare(b.submittedAt!))
  const cur = readiness(s, userId).value
  const pts = mocks.map((a, i) => ({ at: a.submittedAt!, value: Math.round((a.score ?? 0) * 0.5 + cur * 0.5 - (mocks.length - i) * 2) }))
  pts.push({ at: new Date().toISOString(), value: cur })
  return pts
}
