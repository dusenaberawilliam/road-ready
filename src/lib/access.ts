// Plan limits (§3): the free individual plan gets limited lessons, the daily
// quiz and one mock exam; the Exam Pass and school students get everything.
import type { AppState } from '../store/state'
import type { Lesson, PracticeMode, User } from '../types'

export const hasExamPass = (u: User) =>
  u.role === 'student' || (u.plan === 'exam_pass' && (!u.examPassUntil || new Date(u.examPassUntil).getTime() > Date.now()))

export const lessonLocked = (s: AppState, u: User, l: Lesson) => {
  if (hasExamPass(u)) return false
  const first = s.lessons.find((x) => x.subtopicId === l.subtopicId && x.status === 'published' && x.schoolId === null)
  return first?.id !== l.id
}

export const modeLocked = (s: AppState, u: User, mode: PracticeMode): string | null => {
  if (hasExamPass(u)) return null
  if (mode === 'topic' || mode === 'weak_drill') return 'Topic practice and weak-topic drills are part of the Exam Pass.'
  if (mode === 'mock' && s.attempts.some((a) => a.userId === u.id && a.mode === 'mock' && a.submittedAt)) return 'The free plan includes 1 mock exam. Get the Exam Pass for unlimited mocks.'
  return null
}
