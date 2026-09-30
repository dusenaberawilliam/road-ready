import type {
  AttendanceRecord,
  Assignment,
  Attempt,
  AuditEntry,
  Certificate,
  Cohort,
  ContentReport,
  DiscountCode,
  EnrolmentRequest,
  ExamResult,
  Invoice,
  Lesson,
  LessonProgress,
  Note,
  Notification,
  Payment,
  Post,
  Question,
  ReviewItem,
  School,
  StudentNote,
  Subtopic,
  SupportTicket,
  TeacherTest,
  Topic,
  User,
  UserSettings,
} from '../types'

export interface Pricing {
  starterPerStudent: number
  proBase: number
  proPerStudent: number
  examPass: number
  examPassDays: number
  referralFee: number
  starterMaxStudents: number
}

export interface AppState {
  version: number
  sessionUserId: string | null
  users: User[]
  schools: School[]
  cohorts: Cohort[]
  topics: Topic[]
  subtopics: Subtopic[]
  lessons: Lesson[]
  questions: Question[]
  progress: Record<string, Record<string, LessonProgress>> // userId -> lessonId
  mastery: Record<string, Record<string, number>> // userId -> topicId -> 0..100
  attempts: Attempt[]
  reviews: ReviewItem[]
  notes: Note[]
  posts: Post[]
  tests: TeacherTest[]
  assignments: Assignment[]
  certificates: Certificate[]
  invoices: Invoice[]
  payments: Payment[]
  enrolmentRequests: EnrolmentRequest[]
  notifications: Notification[]
  audit: AuditEntry[]
  tickets: SupportTicket[]
  reports: ContentReport[]
  examResults: ExamResult[]
  attendance: AttendanceRecord[]
  studentNotes: StudentNote[]
  discountCodes: DiscountCode[]
  settings: Record<string, UserSettings>
  pricing: Pricing
  studyDays: Record<string, string[]> // userId -> YYYY-MM-DD dates with a study action
  downloads: Record<string, string[]> // userId -> attachment ids
  otpLog: { phone: string; code: string; at: string }[]
}
