// Role and school scoping (§2 permissions, §20 "role and school scoping on every API call").
import type { AppState } from '../store/state'
import type { Post, User } from '../types'

export const spaceSchoolId = (s: AppState, spaceId: string): string | null => {
  const [kind, id, school] = spaceId.split(':')
  if (kind === 'lesson' || kind === 'question') return school ?? null
  if (kind === 'class') return s.cohorts.find((c) => c.id === id)?.schoolId ?? null
  if (kind === 'school' || kind === 'teachers') return id
  return null
}

/** Cohorts a teacher/admin manages: teachers see their own classes, admins the whole school. */
export const scopeCohorts = (s: AppState, user: User) =>
  s.cohorts.filter((c) => c.schoolId === user.schoolId && (user.role === 'school_admin' || c.teacherId === user.id))

export const scopeStudents = (s: AppState, user: User, cohortId?: string) => {
  const ids = scopeCohorts(s, user).map((c) => c.id)
  return s.users.filter((u) => u.role === 'student' && u.cohortId && ids.includes(u.cohortId) && (!cohortId || u.cohortId === cohortId))
}

export const canModerateSpace = (s: AppState, user: User, spaceId: string) => {
  if (user.role === 'super_admin') return true
  const [kind, id] = spaceId.split(':')
  const schoolId = spaceSchoolId(s, spaceId)
  if (user.role === 'content_editor') return kind === 'lesson' && s.lessons.find((l) => l.id === id)?.schoolId === null
  if (user.role === 'school_admin') return schoolId === user.schoolId
  if (user.role === 'teacher') {
    if (schoolId !== user.schoolId) return false
    if (kind === 'class') return scopeCohorts(s, user).some((c) => c.id === id)
    return true
  }
  return false
}

export const moderationQueue = (s: AppState, user: User): Post[] =>
  s.posts.filter((p) => (p.status === 'held' || (p.status === 'visible' && p.reports.length > 0)) && canModerateSpace(s, user, p.spaceId))

export const spaceTitle = (s: AppState, spaceId: string) => {
  const [kind, id] = spaceId.split(':')
  if (kind === 'lesson') return `Lesson: ${s.lessons.find((l) => l.id === id)?.title ?? id}`
  if (kind === 'question') return `Question thread: ${s.questions.find((q) => q.id === id)?.prompt.slice(0, 60) ?? id}…`
  if (kind === 'class') return `Class board — ${s.cohorts.find((c) => c.id === id)?.name ?? id}`
  if (kind === 'school') return `School board — ${s.schools.find((x) => x.id === id)?.name ?? id}`
  if (kind === 'teachers') return 'Teacher room'
  return spaceId
}

/** Attempts the school may see (respects "share study history" consent, §10). */
export const visibleAttempts = (s: AppState, student: User) =>
  s.attempts.filter((a) => a.userId === student.id && a.submittedAt && (!student.historyVisibleFrom || a.submittedAt >= student.historyVisibleFrom))
