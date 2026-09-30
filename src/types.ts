// Domain types. These mirror the data model in PROJECT_SPEC.md §19 so the
// mock store can later be swapped for the Laravel API without UI changes.

export type Lang = 'en' | 'rw' | 'fr'

export type Role =
  | 'student'
  | 'individual'
  | 'guardian'
  | 'teacher'
  | 'school_admin'
  | 'content_editor'
  | 'super_admin'

export type LicenceCategory = 'A' | 'B' | 'C' | 'D'

export interface User {
  id: string
  phone: string
  name: string
  dob: string // ISO date
  gender?: 'F' | 'M'
  district: string
  role: Role
  language: Lang
  schoolId?: string
  cohortId?: string
  category?: LicenceCategory
  examDate?: string
  roadUse?: string
  guardianId?: string
  childIds?: string[]
  consent?: 'pending' | 'granted' | 'not_required'
  plan?: 'free' | 'exam_pass'
  examPassUntil?: string
  status: 'active' | 'suspended' | 'pending_consent'
  lastActive: string
  createdAt: string
  onboarded: boolean
  mutedUntil?: string
  historyVisibleFrom?: string
  nationalId?: string
}

export interface School {
  id: string
  name: string
  tin: string
  rnpRef: string
  district: string
  address: string
  phone: string
  status: 'pending' | 'approved' | 'suspended'
  plan: 'starter' | 'pro'
  code: string
  categories: LicenceCategory[]
  tuition: [number, number]
  languages: Lang[]
  schedule: string
  partner: boolean
  rating: number
  reviews: number
  confirmedResults: number
  passRate: number
  color: string
  requireContentApproval: boolean
  createdAt: string
  documents: string[]
}

export interface Cohort {
  id: string
  schoolId: string
  name: string
  category: LicenceCategory
  startDate: string
  teacherId: string
  hiddenLessonIds: string[]
  lessonOrder: string[]
}

export type ContentStatus = 'draft' | 'in_review' | 'published' | 'retired' | 'archived'

export interface Topic {
  id: string
  title: string
  icon: string
  examWeight: number // share of the real exam
  intro: { video: string; text: string }
  order: number
}

export interface Subtopic {
  id: string
  topicId: string
  title: string
  intro: { video: string; text: string }
}

export interface LessonBlocks {
  scene: string
  predict: { prompt: string; options: string[]; correct: number }
  rule: string
  why: string
  onRoad: string
  trap: string
  tip: string
  mission: string
}

export type SceneKind = 'roundabout' | 'junction' | 'zebra' | 'bend' | 'road' | 'night' | 'police' | 'accident'

export interface Attachment {
  id: string
  kind: 'image' | 'file' | 'pdf' | 'link'
  label: string
  size?: string
  url?: string
}

export interface Lesson {
  id: string
  subtopicId: string
  topicId: string
  schoolId: string | null // null = national
  title: string
  scene: SceneKind
  sign?: SignKind
  durationSec: number
  blocks: LessonBlocks
  legalRef: string
  attachments: Attachment[]
  status: ContentStatus
  version: number
  hasVideo: boolean
  authorId: string
  updatedAt: string
  language?: Lang
  lawTagged?: boolean
}

export type SignKind =
  | 'stop'
  | 'give_way'
  | 'no_entry'
  | 'speed_40'
  | 'speed_60'
  | 'roundabout'
  | 'school'
  | 'bend_right'
  | 'pedestrian'
  | 'no_overtaking'
  | 'keep_right'
  | 'no_parking'
  | 'hospital'
  | 'slippery'
  | 'traffic_lights'
  | 'priority_road'

export type QuestionType = 'single' | 'truefalse' | 'multi' | 'hotspot' | 'clip'

export interface Question {
  id: string
  topicId: string
  lessonId?: string
  schoolId: string | null
  type: QuestionType
  prompt: string
  sign?: SignKind
  scene?: SceneKind
  options: string[]
  correct: number[]
  explanation: string
  wrongWhy?: string
  difficulty: 1 | 2 | 3
  status: ContentStatus
  version: number
  stats: { attempts: number; correct: number }
}

export type PracticeMode = 'lesson_check' | 'topic' | 'weak_drill' | 'quick' | 'mock' | 'diagnostic' | 'teacher'

export interface Attempt {
  id: string
  userId: string
  mode: PracticeMode
  title: string
  questionIds: string[]
  answers: Record<string, number[]>
  confidence: Record<string, 'sure' | 'guess'>
  startedAt: string
  submittedAt?: string
  timeLimitSec?: number
  examMode: boolean
  showExplanations: 'each' | 'after' | 'never'
  topicId?: string
  lessonId?: string
  testId?: string
  score?: number
  passed?: boolean
  perTopic?: Record<string, { correct: number; total: number }>
  channel: 'app' | 'web' | 'whatsapp'
  appSwitches?: number
  checked?: string[] // questions already scored (explanation shown after each)
}

export interface LessonProgress {
  videoPct: number
  position: number
  textRead: boolean
  checkPassed: boolean
  prediction?: number
  downloaded?: boolean
  chaptersReplayed?: number
  lastSpeed?: number
}

export interface Note {
  id: string
  userId: string
  itemId: string // lesson/subtopic/topic
  itemTitle: string
  topicId: string
  body: string
  videoTime?: number
  quote?: string
  visibility: 'private' | 'class'
  cohortId?: string
  createdAt: string
}

export interface Post {
  id: string
  spaceId: string // e.g. lesson:<id>:<schoolId>, class:<cohortId>, school:<schoolId>, teachers:<schoolId>, question:<qid>:<schoolId>
  parentId?: string
  authorId: string
  body: string
  image?: string
  videoTime?: number
  createdAt: string
  helpful: string[]
  thanks: string[]
  best?: boolean
  pinned?: boolean
  status: 'visible' | 'held' | 'hidden' | 'deleted'
  reports: { by: string; reason: string }[]
  flagReason?: string
}

export interface TeacherTest {
  id: string
  schoolId: string
  authorId: string
  kind: 'test' | 'exam' | 'assignment'
  title: string
  cohortId: string
  questionIds: string[]
  lessonIds: string[]
  timeLimitMin?: number
  attemptsAllowed: number
  showAnswers: 'after_each' | 'after_close' | 'never'
  opensAt: string
  closesAt: string
  status: 'draft' | 'published' | 'archived'
  countsForCertificate?: boolean
  createdAt: string
}

export interface Certificate {
  id: string
  number: string
  userId: string
  schoolId: string
  category: LicenceCategory
  trainingStart: string
  trainingEnd: string
  lessonsCompleted: number
  sessionsAttended: number
  status: 'eligible' | 'teacher_confirmed' | 'issued' | 'revoked' | 'expired'
  confirmedBy?: string
  issuedBy?: string
  issuedAt?: string
  revokedReason?: string
  hash?: string
  nationalIdLast4?: string
}

export interface Invoice {
  id: string
  schoolId: string
  month: string // YYYY-MM
  basePlan: number
  activeStudents: number
  perStudent: number
  referralFees: number
  discount: number
  total: number
  issuedAt: string
  dueAt: string
  status: 'paid' | 'due' | 'overdue'
  paidAt?: string
  method?: string
}

export interface Payment {
  id: string
  payerId: string
  payerKind: 'school' | 'learner'
  amount: number
  method: 'MTN MoMo' | 'Airtel Money' | 'Card' | 'Bank transfer'
  reference: string
  status: 'confirmed' | 'pending' | 'refunded'
  createdAt: string
  purpose: string
}

export interface EnrolmentRequest {
  id: string
  userId: string
  schoolId: string
  shareHistory: boolean
  status: 'requested' | 'accepted' | 'declined'
  createdAt: string
  message?: string
  referralFee: number
}

export interface Notification {
  id: string
  userId: string
  title: string
  body: string
  channel: 'push' | 'whatsapp' | 'sms' | 'email' | 'dashboard'
  link?: string
  read: boolean
  createdAt: string
}

export interface AuditEntry {
  id: string
  actorId: string
  action: string
  target: string
  createdAt: string
}

export interface SupportTicket {
  id: string
  fromId: string
  channel: 'whatsapp' | 'in_app'
  subject: string
  body: string
  status: 'open' | 'resolved'
  createdAt: string
  replies: { by: string; body: string; at: string }[]
}

export interface ContentReport {
  id: string
  itemKind: 'lesson' | 'question'
  itemId: string
  userId: string
  reason: string
  status: 'open' | 'resolved'
  createdAt: string
}

export interface ExamResult {
  id: string
  userId: string
  date: string
  passed: boolean
  score?: number
  confirmedBy?: string
}

export interface AttendanceRecord {
  id: string
  cohortId: string
  date: string
  topic: string
  present: string[]
}

export interface ReviewItem {
  userId: string
  questionId: string
  dueAt: string
  step: number // index into [1,3,7,14]
  correctStreak: number
  misses: number
}

export interface DiscountCode {
  code: string
  percent: number
  description: string
  active: boolean
  uses: number
}

export interface Assignment {
  id: string
  testId?: string
  userId: string
  lessonIds: string[]
  note: string
  dueAt: string
  assignedBy: string
  done: boolean
  createdAt: string
}

export interface StudentNote {
  id: string
  studentId: string
  authorId: string
  body: string
  createdAt: string
}

export interface UserSettings {
  reminderTime: string
  channels: { push: boolean; whatsapp: boolean; sms: boolean; email: boolean }
  reminders: { daily: boolean; tip: boolean; exam: boolean; replies: boolean }
  wifiOnly: boolean
  quality: '240p' | '360p' | '720p'
  hideFromBoards: boolean
  pin?: string
  devices: { id: string; name: string; lastSeen: string; current: boolean }[]
}
