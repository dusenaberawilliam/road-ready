import { lessons, questions, subtopics, topics } from './content'
import { isCorrect, nextMastery, pickMockQuestions, scoreAttempt } from '../lib/engine'
import { clamp, daysAgo, daysFromNow, isoDay, seeded, shuffle } from '../lib/util'
import type { AppState } from '../store/state'
import type { Attempt, Cohort, Lesson, Post, School, User, UserSettings } from '../types'

export const STATE_VERSION = 4

const defaultSettings = (): UserSettings => ({
  reminderTime: '07:30',
  channels: { push: true, whatsapp: true, sms: false, email: false },
  reminders: { daily: true, tip: true, exam: true, replies: true },
  wifiOnly: true,
  quality: '360p',
  hideFromBoards: false,
  devices: [
    { id: 'd1', name: 'Tecno Spark 10 · Android app', lastSeen: new Date().toISOString(), current: true },
    { id: 'd2', name: 'Chrome · Windows (web)', lastSeen: daysAgo(3), current: false },
  ],
})

const schools: School[] = [
  { id: 'sch-kigali', name: 'Kigali Safe Drive School', tin: '108245671', rnpRef: 'RNP/DS/2026/014', district: 'Gasabo', address: 'KG 11 Ave, Kimironko', phone: '+250788310221', status: 'approved', plan: 'pro', code: 'KSD-4821', categories: ['A', 'B'], tuition: [120000, 250000], languages: ['rw', 'en'], schedule: 'Mon–Sat, 7:00–18:00', partner: true, rating: 4.6, reviews: 38, confirmedResults: 64, passRate: 81, color: '#0277B5', requireContentApproval: true, createdAt: daysAgo(120), documents: ['RDB certificate.pdf', 'RNP authorisation.pdf'] },
  { id: 'sch-musanze', name: 'Musanze Road Academy', tin: '109332180', rnpRef: 'RNP/DS/2026/031', district: 'Musanze', address: 'Near Musanze bus park', phone: '+250788552190', status: 'approved', plan: 'starter', code: 'MRA-1177', categories: ['A', 'B', 'C'], tuition: [100000, 220000], languages: ['rw', 'fr'], schedule: 'Mon–Fri, 8:00–17:00', partner: true, rating: 4.3, reviews: 21, confirmedResults: 27, passRate: 74, color: '#1d4ed8', requireContentApproval: false, createdAt: daysAgo(80), documents: ['RDB certificate.pdf', 'RNP authorisation.pdf'] },
  { id: 'sch-rubavu', name: 'Rubavu Lakeside Driving', tin: '107881234', rnpRef: 'RNP/DS/2026/045', district: 'Rubavu', address: 'Avenue de la Production, Gisenyi', phone: '+250788900345', status: 'approved', plan: 'starter', code: 'RLD-3309', categories: ['A', 'B'], tuition: [90000, 200000], languages: ['rw', 'fr', 'en'], schedule: 'Mon–Sat, 7:30–17:30', partner: true, rating: 4.1, reviews: 12, confirmedResults: 14, passRate: 69, color: '#b45309', requireContentApproval: false, createdAt: daysAgo(60), documents: ['RDB certificate.pdf', 'RNP authorisation.pdf'] },
  { id: 'sch-huye', name: 'Huye Driving Center', tin: '110045566', rnpRef: 'RNP/DS/2026/052', district: 'Huye', address: 'Near University of Rwanda, Huye campus', phone: '+250788123456', status: 'pending', plan: 'starter', code: 'HDC-0001', categories: ['A', 'B'], tuition: [95000, 210000], languages: ['rw', 'en'], schedule: 'Mon–Fri, 8:00–17:00', partner: false, rating: 0, reviews: 0, confirmedResults: 0, passRate: 0, color: '#7c3aed', requireContentApproval: false, createdAt: daysAgo(1), documents: ['RDB certificate.pdf', 'RNP authorisation.pdf', 'Owner ID.pdf'] },
]

const cohorts: Cohort[] = [
  { id: 'c-kg-a', schoolId: 'sch-kigali', name: 'Cohort A — Motos (Sep 2026)', category: 'A', startDate: daysAgo(28), teacherId: 'u-teacher', hiddenLessonIds: [], lessonOrder: [] },
  { id: 'c-kg-b', schoolId: 'sch-kigali', name: 'Cohort B — Cars (Jul 2026)', category: 'B', startDate: daysAgo(75), teacherId: 'u-teacher2', hiddenLessonIds: [], lessonOrder: [] },
  { id: 'c-mu-a', schoolId: 'sch-musanze', name: 'Cohort 1 — Mixed (Sep 2026)', category: 'B', startDate: daysAgo(20), teacherId: 'u-teacher3', hiddenLessonIds: [], lessonOrder: [] },
]

const staff: User[] = [
  { id: 'u-teacher', phone: '+250788000002', name: 'Jean-Paul Mugisha', dob: '1988-04-12', gender: 'M', district: 'Gasabo', role: 'teacher', language: 'en', schoolId: 'sch-kigali', status: 'active', lastActive: daysAgo(0), createdAt: daysAgo(118), onboarded: true },
  { id: 'u-teacher2', phone: '+250788000012', name: 'Claudine Uwimana', dob: '1991-09-03', gender: 'F', district: 'Kicukiro', role: 'teacher', language: 'rw', schoolId: 'sch-kigali', status: 'active', lastActive: daysAgo(1), createdAt: daysAgo(110), onboarded: true },
  { id: 'u-teacher3', phone: '+250788000013', name: 'Théogène Habyarimana', dob: '1985-01-22', gender: 'M', district: 'Musanze', role: 'teacher', language: 'fr', schoolId: 'sch-musanze', status: 'active', lastActive: daysAgo(2), createdAt: daysAgo(78), onboarded: true },
  { id: 'u-admin', phone: '+250788000003', name: 'Diane Ingabire', dob: '1984-06-30', gender: 'F', district: 'Gasabo', role: 'school_admin', language: 'en', schoolId: 'sch-kigali', status: 'active', lastActive: daysAgo(0), createdAt: daysAgo(120), onboarded: true },
  { id: 'u-admin-mu', phone: '+250788000014', name: 'Emmanuel Nkurunziza', dob: '1980-11-02', gender: 'M', district: 'Musanze', role: 'school_admin', language: 'fr', schoolId: 'sch-musanze', status: 'active', lastActive: daysAgo(3), createdAt: daysAgo(80), onboarded: true },
  { id: 'u-admin-hu', phone: '+250788000015', name: 'Alice Mukeshimana', dob: '1990-02-14', gender: 'F', district: 'Huye', role: 'school_admin', language: 'en', schoolId: 'sch-huye', status: 'active', lastActive: daysAgo(1), createdAt: daysAgo(1), onboarded: true },
  { id: 'u-editor', phone: '+250788000004', name: 'Patrick Niyonzima', dob: '1992-03-18', gender: 'M', district: 'Nyarugenge', role: 'content_editor', language: 'en', status: 'active', lastActive: daysAgo(0), createdAt: daysAgo(200), onboarded: true },
  { id: 'u-editor2', phone: '+250788000016', name: 'Solange Uwera', dob: '1994-08-08', gender: 'F', district: 'Kicukiro', role: 'content_editor', language: 'rw', status: 'active', lastActive: daysAgo(1), createdAt: daysAgo(150), onboarded: true },
  { id: 'u-super', phone: '+250788000005', name: 'Mugabo', dob: '1990-07-01', gender: 'M', district: 'Kicukiro', role: 'super_admin', language: 'en', status: 'active', lastActive: daysAgo(0), createdAt: daysAgo(240), onboarded: true },
  { id: 'u-guardian', phone: '+250788000006', name: 'Jeanne Mukamana', dob: '1978-05-05', gender: 'F', district: 'Gasabo', role: 'guardian', language: 'rw', childIds: ['u-kevin'], status: 'active', lastActive: daysAgo(2), createdAt: daysAgo(27), onboarded: true },
]

// [id, name, cohort, level 0..1, inactiveDays, dob, gender, examInDays]
const studentSpecs: [string, string, string, number, number, string, 'F' | 'M', number][] = [
  ['u-student', 'Aline Uwase', 'c-kg-a', 0.66, 0, '2004-02-11', 'F', 12],
  ['u-kevin', 'Kevin Habimana', 'c-kg-a', 0.5, 1, '2009-03-20', 'M', 25],
  ['u-s3', 'Divine Iradukunda', 'c-kg-a', 0.84, 0, '2002-08-14', 'F', 6],
  ['u-s4', 'Fabrice Niyomugabo', 'c-kg-a', 0.38, 7, '2001-12-01', 'M', 20],
  ['u-s5', 'Clarisse Umutoni', 'c-kg-a', 0.72, 2, '2003-05-27', 'F', 12],
  ['u-s6', 'Samuel Hakizimana', 'c-kg-a', 0.45, 9, '1999-10-10', 'M', 25],
  ['u-s7', 'Yvonne Nyirahabimana', 'c-kg-a', 0.61, 1, '2000-01-19', 'F', 12],
  ['u-s8', 'Olivier Mugenzi', 'c-kg-b', 0.9, 3, '1997-07-07', 'M', -10],
  ['u-s9', 'Grace Ishimwe', 'c-kg-b', 0.86, 1, '1998-09-15', 'F', -5],
  ['u-s10', 'Patrick Ndayisaba', 'c-kg-b', 0.79, 0, '2000-04-04', 'M', 4],
  ['u-s11', 'Josiane Uwamahoro', 'c-kg-b', 0.55, 6, '2002-11-23', 'F', 18],
  ['u-s12', 'Eric Twagirayezu', 'c-kg-b', 0.68, 2, '1996-06-16', 'M', 9],
  ['u-s13', 'Aimable Nsengiyumva', 'c-mu-a', 0.58, 1, '2001-02-02', 'M', 15],
  ['u-s14', 'Chantal Mukandayisenga', 'c-mu-a', 0.7, 0, '2003-03-03', 'F', 15],
  ['u-s15', 'Bosco Tuyisenge', 'c-mu-a', 0.35, 11, '2002-07-21', 'M', 30],
]

const students: User[] = studentSpecs.map(([id, name, cohortId, , inactive, dob, gender, examIn], i) => {
  const cohort = cohorts.find((c) => c.id === cohortId)!
  return {
    id,
    phone: id === 'u-student' ? '+250788000001' : `+2507883${String(10000 + i * 137).slice(-5)}`,
    name,
    dob,
    gender,
    district: cohort.schoolId === 'sch-musanze' ? 'Musanze' : ['Gasabo', 'Kicukiro', 'Nyarugenge'][i % 3],
    role: 'student',
    language: i % 3 === 0 ? 'rw' : 'en',
    schoolId: cohort.schoolId,
    cohortId,
    category: cohort.category,
    examDate: daysFromNow(examIn),
    roadUse: ['moto passenger', 'pedestrian', 'cyclist', 'already riding'][i % 4],
    guardianId: id === 'u-kevin' ? 'u-guardian' : undefined,
    consent: id === 'u-kevin' ? 'granted' : 'not_required',
    plan: 'exam_pass',
    status: 'active',
    lastActive: daysAgo(inactive, 10),
    createdAt: cohort.startDate,
    onboarded: true,
  }
})

const individuals: User[] = [
  { id: 'u-individual', phone: '+250788000007', name: 'Eric Nshimiyimana', dob: '2001-10-09', gender: 'M', district: 'Nyarugenge', role: 'individual', language: 'en', category: 'A', examDate: daysFromNow(35), roadUse: 'moto passenger', plan: 'free', consent: 'not_required', status: 'active', lastActive: daysAgo(0), createdAt: daysAgo(9), onboarded: true },
  { id: 'u-ind2', phone: '+250788000017', name: 'Sandrine Mutesi', dob: '2000-12-12', gender: 'F', district: 'Gasabo', role: 'individual', language: 'rw', category: 'B', examDate: daysFromNow(21), roadUse: 'pedestrian', plan: 'exam_pass', examPassUntil: daysFromNow(40), consent: 'not_required', status: 'active', lastActive: daysAgo(1), createdAt: daysAgo(30), onboarded: true },
]

function buildActivity(state: AppState) {
  const rand = seeded(42)
  const allStudents = [...students, ...individuals]
  for (const u of allStudents) {
    const spec = studentSpecs.find((s) => s[0] === u.id)
    const level = spec?.[3] ?? (u.id === 'u-ind2' ? 0.74 : 0.42)
    const inactive = spec?.[4] ?? 0
    const m: Record<string, number> = {}
    state.progress[u.id] = {}
    const days = new Set<string>()
    // Topic mastery — varied by topic so heatmaps show real gaps (priority is hard, signs easier)
    for (const t of topics) {
      const bias = t.id === 't-priority' ? -0.14 : t.id === 't-danger' || t.id === 't-info' ? 0.08 : t.id === 't-speed' ? -0.06 : 0
      if (u.id === 'u-individual' && t.order > 6) continue // individual only started some topics
      m[t.id] = Math.round(clamp((level + bias + (rand() - 0.5) * 0.24) * 100, 5, 98))
    }
    state.mastery[u.id] = m
    // Lesson progress
    const nLessons = Math.round(lessons.length * Math.min(1, level + 0.15))
    for (const l of lessons.slice(0, u.id === 'u-individual' ? 6 : nLessons)) {
      const full = rand() < 0.8
      state.progress[u.id][l.id] = {
        videoPct: full ? 100 : Math.round(30 + rand() * 50),
        position: 0,
        textRead: rand() < 0.6,
        checkPassed: full && rand() < level + 0.2,
        chaptersReplayed: Math.floor(rand() * 3),
        lastSpeed: rand() < 0.3 ? 1.25 : 1,
      }
    }
    // Mock exams
    const mocks = u.id === 'u-individual' ? 1 : Math.max(1, Math.round(level * 5))
    for (let i = 0; i < mocks; i++) {
      const at = daysAgo(inactive + (mocks - i) * 3, 18)
      const qids = pickMockQuestions(state.questions, state, rand)
      const p = clamp(level - 0.12 + i * 0.05, 0.2, 0.97)
      const answers: Record<string, number[]> = {}
      for (const id of qids) {
        const q = state.questions.find((x) => x.id === id)!
        const wrong = [0, 1, 2, 3].filter((o) => o < q.options.length && !q.correct.includes(o))
        answers[id] = rand() < p ? q.correct : [wrong[Math.floor(rand() * wrong.length)] ?? 0]
      }
      const a: Attempt = {
        id: `att-${u.id}-${i}`,
        userId: u.id,
        mode: 'mock',
        title: 'Mock exam',
        questionIds: qids,
        answers,
        confidence: {},
        startedAt: new Date(new Date(at).getTime() - 14 * 60000).toISOString(),
        submittedAt: at,
        timeLimitSec: 20 * 60,
        examMode: true,
        showExplanations: 'after',
        channel: i % 2 ? 'web' : 'app',
      }
      const res = scoreAttempt(state.questions, a)
      Object.assign(a, { score: res.score, passed: res.passed, perTopic: res.perTopic })
      state.attempts.push(a)
      for (const id of qids) {
        const q = state.questions.find((x) => x.id === id)!
        q.stats.attempts++
        if (isCorrect(q, answers[id])) q.stats.correct++
      }
      days.add(isoDay(at))
    }
    // Study days in the last 3 weeks
    for (let d = inactive; d < 21; d++) if (rand() < level) days.add(isoDay(daysAgo(d)))
    state.studyDays[u.id] = [...days].sort()
    state.settings[u.id] = defaultSettings()
  }
  // Aline: a few spaced-repetition reviews due, one missed twice (sends her back to the lesson)
  state.reviews.push(
    { userId: 'u-student', questionId: 'q2', dueAt: daysAgo(0, 6), step: 1, correctStreak: 0, misses: 2 },
    { userId: 'u-student', questionId: 'q29', dueAt: daysAgo(1), step: 0, correctStreak: 0, misses: 1 },
    { userId: 'u-student', questionId: 'q34', dueAt: daysFromNow(2), step: 1, correctStreak: 1, misses: 1 },
    { userId: 'u-student', questionId: 'q8', dueAt: daysAgo(0, 5), step: 0, correctStreak: 0, misses: 1 },
  )
  // Make sure Aline's junction lesson is not yet done so the plan sends her back
  delete state.progress['u-student']['l-junction-right']
  // Kevin's mastery also drives the guardian summary
  state.mastery['u-kevin']['t-priority'] = 31
  for (const u of staff) state.settings[u.id] = defaultSettings()
  // Keep mastery monotonic with a final quick update so values look "live"
  state.mastery['u-student']['t-priority'] = Math.round(nextMastery(state.mastery['u-student']['t-priority'], 2, false))
}

const teacherLesson: Lesson = {
  id: 'l-school-sonatubes',
  subtopicId: 's-priority-roundabouts',
  topicId: 't-priority',
  schoolId: 'sch-kigali',
  title: 'Our training route: the Sonatubes roundabout at rush hour',
  scene: 'roundabout',
  sign: 'roundabout',
  durationSec: 200,
  blocks: {
    scene: 'On Thursday\'s practical session we ride from our Kimironko yard to Sonatubes at 17:30, when buses leave Remera.',
    predict: { prompt: 'Which lane do you choose to take the airport exit?', options: ['Inner lane', 'Outer lane', 'Any lane'], correct: 1 },
    rule: 'For an early exit keep to the outer lane, give way on entry and signal right after the exit before yours.',
    why: 'Buses change lanes slowly; being in the wrong lane forces you to cut across them.',
    onRoad: 'Sonatubes, and Chez Lando roundabout on the way back.',
    trap: 'Learners follow the bus into the inner lane and then cut across it.',
    tip: 'Choose your lane before the entry line, not inside the roundabout.',
    mission: 'Draw the Sonatubes roundabout and mark the lane you will use on Thursday.',
  },
  legalRef: 'Law n° 014/2026 · Art. 32',
  attachments: [{ id: 'l-school-sonatubes-a1', kind: 'image', label: 'Photo: Sonatubes approach from Kimironko', size: '850 KB' }],
  status: 'published',
  version: 2,
  hasVideo: true,
  authorId: 'u-teacher',
  updatedAt: daysAgo(6),
  language: 'en',
}

const pendingTeacherLesson: Lesson = {
  ...teacherLesson,
  id: 'l-school-kimironko',
  subtopicId: 's-prohib-entry',
  topicId: 't-prohib',
  title: 'One-way streets around Kimironko market',
  scene: 'road',
  sign: 'no_entry',
  status: 'in_review',
  version: 1,
  authorId: 'u-teacher',
  updatedAt: daysAgo(1),
  blocks: {
    scene: 'Saturday morning delivery near Kimironko market; the shortest street is one-way against you.',
    predict: { prompt: 'Can you ride in for 30 seconds to drop goods?', options: ['Yes', 'No'], correct: 1 },
    rule: 'No entry means no entry for every vehicle, whatever the duration.',
    why: 'Pedestrians and traders do not expect traffic from that side.',
    onRoad: 'KG 11 Ave side streets on market days.',
    trap: '"Only for a moment" is not an exception.',
    tip: 'Park legally and walk the last 50 m.',
    mission: 'Find the one-way streets around the market and draw them on a map.',
  },
}

const nationalDraft: Lesson = {
  ...lessons[0],
  id: 'l-draft-bus-stop',
  subtopicId: 's-overtake-safe',
  topicId: 't-overtake',
  title: 'Passing a bus at a bus stop',
  scene: 'road',
  sign: undefined,
  status: 'in_review',
  hasVideo: true,
  authorId: 'u-editor2',
  updatedAt: daysAgo(2),
  blocks: {
    scene: 'A Kigali Bus Services bus is stopped at the Kisimenti stop, passengers stepping off.',
    predict: { prompt: 'What is the main risk when passing?', options: ['A pedestrian stepping out in front of the bus', 'The bus reversing', 'None'], correct: 0 },
    rule: 'Pass a stopped bus slowly, leaving space, and be ready to stop for pedestrians appearing in front of it.',
    why: 'Passengers often cross in front of the bus where drivers cannot see them.',
    onRoad: 'Every bus stop on busy corridors.',
    trap: 'Speeding up to pass the bus before it leaves.',
    tip: 'Big vehicle stopped? Look under and in front of it for feet.',
    mission: 'Watch a bus stop for five minutes and count people crossing in front of buses.',
  },
}

const draftNoVideo: Lesson = {
  ...nationalDraft,
  id: 'l-draft-fog',
  subtopicId: 's-lights-night',
  topicId: 't-lights',
  title: 'Fog on the Nyungwe road',
  scene: 'night',
  status: 'draft',
  hasVideo: false,
  legalRef: '',
  updatedAt: daysAgo(4),
}

function buildPosts(): Post[] {
  const p = (id: string, spaceId: string, authorId: string, body: string, days: number, extra: Partial<Post> = {}): Post => ({
    id,
    spaceId,
    authorId,
    body,
    createdAt: daysAgo(days, 14),
    helpful: [],
    thanks: [],
    status: 'visible',
    reports: [],
    ...extra,
  })
  return [
    p('p1', 'lesson:l-roundabout-entry:sch-kigali', 'u-s4', 'At 2:14 the video says the moto inside has priority — but what if the moto inside is going very slowly?', 3, { videoTime: 134 }),
    p('p2', 'lesson:l-roundabout-entry:sch-kigali', 'u-teacher', 'Good question Fabrice. Speed does not change priority: the vehicle already inside keeps it. Wait for a real gap — we will practise this on Thursday.', 3, { parentId: 'p1', best: true, helpful: ['u-s4', 'u-student', 'u-s5'] }),
    p('p3', 'lesson:l-roundabout-entry:sch-kigali', 'u-s5', 'The common trap block helped me — I always chose "priority to the right" before.', 2, { thanks: ['u-teacher'] }),
    p('p4', 'lesson:l-junction-right:sch-kigali', 'u-kevin', 'Is priority to the right also for motos coming from the right?', 1),
    p('p5', 'class:c-kg-a', 'u-teacher', '📌 Practical session this Thursday 17:00 at the Kimironko yard. Finish the Priority rules topic drill before then.', 2, { pinned: true }),
    p('p6', 'class:c-kg-a', 'u-student', 'Will the school exam include roundabout questions with pictures?', 1),
    p('p7', 'class:c-kg-a', 'u-s6', 'Anyone selling answers for the exam? call me 0788 555 111', 0, { status: 'held', flagReason: 'Phone number detected' }),
    p('p8', 'school:sch-kigali', 'u-admin', 'Welcome to all new students of September! Our office is open Mon–Sat 7:00–18:00.', 10, { pinned: true }),
    p('p9', 'school:sch-kigali', 'u-s10', 'Tip from someone who passed the provisoire last week: read every question twice, the options are very close.', 4, { helpful: ['u-student', 'u-s3'] }),
    p('p10', 'teachers:sch-kigali', 'u-teacher2', 'Cohort B has three students ready for certificates — Diane, can you check the attendance records?', 1),
    p('p11', 'question:q2:sch-kigali', 'u-s7', 'Why is it not "whoever arrives first"? That is what my uncle taught me.', 5),
    p('p12', 'school:sch-kigali', 'u-s11', 'This app is useless and so are you all', 0, { reports: [{ by: 'u-s9', reason: 'Insult' }] }),
  ]
}

export function createSeed(): AppState {
  const state: AppState = {
    version: STATE_VERSION,
    sessionUserId: null,
    users: [...staff, ...students, ...individuals],
    schools: structuredClone(schools),
    cohorts: structuredClone(cohorts),
    topics: structuredClone(topics),
    subtopics: structuredClone(subtopics),
    lessons: [...structuredClone(lessons), teacherLesson, pendingTeacherLesson, nationalDraft, draftNoVideo],
    questions: [
      ...structuredClone(questions),
      { id: 'q-school-1', topicId: 't-priority', lessonId: 'l-school-sonatubes', schoolId: 'sch-kigali', type: 'single', prompt: 'At Sonatubes you want the airport exit (second exit). Which lane do you choose on entry?', options: ['Outer lane', 'Inner lane', 'Any lane', 'The bus lane'], correct: [0], explanation: 'For an early exit keep to the outer lane so you do not cut across traffic.', difficulty: 2, status: 'published', version: 1, stats: { attempts: 14, correct: 9 } },
      { id: 'q-draft-1', topicId: 't-overtake', lessonId: 'l-draft-bus-stop', schoolId: null, type: 'single', prompt: 'A bus is stopped at a bus stop with passengers getting off. What is the main risk when you pass it?', options: ['A pedestrian stepping out in front of the bus', 'The bus reversing', 'The bus changing colour', 'None'], correct: [0], explanation: 'Passengers often cross in front of a stopped bus where drivers cannot see them.', difficulty: 2, status: 'in_review', version: 1, stats: { attempts: 0, correct: 0 } },
      { id: 'q-school-2', topicId: 't-priority', schoolId: 'sch-kigali', type: 'truefalse', prompt: 'On our Thursday route, buses leaving Remera have priority at the Sonatubes entry.', options: ['True', 'False'], correct: [1], explanation: 'Buses entering give way like everyone else; buses already inside have priority.', difficulty: 2, status: 'published', version: 1, stats: { attempts: 11, correct: 5 } },
    ],
    progress: {},
    mastery: {},
    attempts: [],
    reviews: [],
    notes: [
      { id: 'n1', userId: 'u-student', itemId: 'l-roundabout-entry', itemTitle: 'Entering a roundabout when a moto is already inside', topicId: 't-priority', body: 'Moto inside has priority — even if it is slow. Look LEFT and inside, not behind.', videoTime: 134, visibility: 'private', createdAt: daysAgo(3) },
      { id: 'n2', userId: 'u-student', itemId: 'l-bend-warning', itemTitle: 'Sharp bend on a hilly rural road', topicId: 't-danger', body: 'Triangle = warning, hazard is 50–150 m ahead.', quote: 'A triangular sign with a red border warns of danger ahead.', visibility: 'private', createdAt: daysAgo(6) },
      { id: 'n3', userId: 'u-student', itemId: 'l-alcohol', itemTitle: 'Alcohol limit, suspension and points', topicId: 't-offences', body: '0.80 g/L — remember for the exam!', visibility: 'private', createdAt: daysAgo(2) },
      { id: 'n4', userId: 'u-teacher', itemId: 'l-roundabout-entry', itemTitle: 'Entering a roundabout when a moto is already inside', topicId: 't-priority', body: 'Class note: we will practise this exact situation on Thursday at Sonatubes. Watch the video twice before.', visibility: 'class', cohortId: 'c-kg-a', createdAt: daysAgo(4) },
    ],
    posts: buildPosts(),
    tests: [
      { id: 'tt1', schoolId: 'sch-kigali', authorId: 'u-teacher', kind: 'test', title: 'Priority rules check — Week 4', cohortId: 'c-kg-a', questionIds: ['q1', 'q2', 'q3', 'q4', 'q5', 'q7', 'q-school-1', 'q-school-2'], lessonIds: [], timeLimitMin: 10, attemptsAllowed: 2, showAnswers: 'after_each', opensAt: daysAgo(2), closesAt: daysFromNow(3), status: 'published', createdAt: daysAgo(3) },
      { id: 'tt2', schoolId: 'sch-kigali', authorId: 'u-teacher', kind: 'exam', title: 'School theory exam — Cohort A', cohortId: 'c-kg-a', questionIds: ['q1', 'q3', 'q9', 'q10', 'q15', 'q16', 'q22', 'q25', 'q29', 'q33', 'q37', 'q41', 'q44', 'q47', 'q50', 'q53', 'q2', 'q17', 'q26', 'q39'], lessonIds: [], timeLimitMin: 20, attemptsAllowed: 1, showAnswers: 'after_close', opensAt: daysAgo(0, 6), closesAt: daysFromNow(7), status: 'published', countsForCertificate: true, createdAt: daysAgo(1) },
      { id: 'tt3', schoolId: 'sch-kigali', authorId: 'u-teacher', kind: 'assignment', title: 'Watch lessons on signs and finish the topic drill by Friday', cohortId: 'c-kg-a', questionIds: [], lessonIds: ['l-bend-warning', 'l-school-zone', 'l-slippery'], attemptsAllowed: 1, showAnswers: 'after_each', opensAt: daysAgo(1), closesAt: daysFromNow(2), status: 'published', createdAt: daysAgo(1) },
      { id: 'tt4', schoolId: 'sch-kigali', authorId: 'u-teacher2', kind: 'exam', title: 'School theory exam — Cohort B', cohortId: 'c-kg-b', questionIds: ['q1', 'q3', 'q9', 'q10', 'q15', 'q16', 'q22', 'q25', 'q29', 'q33'], lessonIds: [], timeLimitMin: 15, attemptsAllowed: 1, showAnswers: 'after_close', opensAt: daysAgo(20), closesAt: daysAgo(13), status: 'published', countsForCertificate: true, createdAt: daysAgo(21) },
    ],
    assignments: [],
    certificates: [
      { id: 'cert1', number: 'KSD-2026-000127', userId: 'u-s8', schoolId: 'sch-kigali', category: 'B', trainingStart: daysAgo(75), trainingEnd: daysAgo(12), lessonsCompleted: 26, sessionsAttended: 14, status: 'issued', confirmedBy: 'u-teacher2', issuedBy: 'u-admin', issuedAt: daysAgo(11), nationalIdLast4: '4471' },
      { id: 'cert2', number: 'KSD-2026-000128', userId: 'u-s9', schoolId: 'sch-kigali', category: 'B', trainingStart: daysAgo(75), trainingEnd: daysAgo(4), lessonsCompleted: 26, sessionsAttended: 13, status: 'teacher_confirmed', confirmedBy: 'u-teacher2', nationalIdLast4: '9023' },
      { id: 'cert3', number: 'KSD-2026-000129', userId: 'u-s10', schoolId: 'sch-kigali', category: 'B', trainingStart: daysAgo(75), trainingEnd: daysAgo(1), lessonsCompleted: 24, sessionsAttended: 12, status: 'eligible', nationalIdLast4: '1188' },
    ],
    invoices: [
      { id: 'inv-kg-07', schoolId: 'sch-kigali', month: '2026-07', basePlan: 20000, activeStudents: 9, perStudent: 2000, referralFees: 0, discount: 100, total: 0, issuedAt: '2026-07-01T08:00:00Z', dueAt: '2026-07-15T08:00:00Z', status: 'paid', paidAt: '2026-07-01T09:00:00Z', method: 'Pilot — first cohort free' },
      { id: 'inv-kg-08', schoolId: 'sch-kigali', month: '2026-08', basePlan: 20000, activeStudents: 11, perStudent: 2000, referralFees: 5000, discount: 0, total: 47000, issuedAt: '2026-08-01T08:00:00Z', dueAt: '2026-08-15T08:00:00Z', status: 'paid', paidAt: '2026-08-09T11:20:00Z', method: 'MTN MoMo' },
      { id: 'inv-kg-09', schoolId: 'sch-kigali', month: '2026-09', basePlan: 20000, activeStudents: 12, perStudent: 2000, referralFees: 5000, discount: 0, total: 49000, issuedAt: '2026-09-01T08:00:00Z', dueAt: '2026-09-15T08:00:00Z', status: 'due' },
      { id: 'inv-mu-08', schoolId: 'sch-musanze', month: '2026-08', basePlan: 0, activeStudents: 3, perStudent: 2500, referralFees: 0, discount: 0, total: 7500, issuedAt: '2026-08-01T08:00:00Z', dueAt: '2026-08-15T08:00:00Z', status: 'overdue' },
      { id: 'inv-mu-09', schoolId: 'sch-musanze', month: '2026-09', basePlan: 0, activeStudents: 3, perStudent: 2500, referralFees: 0, discount: 0, total: 7500, issuedAt: '2026-09-01T08:00:00Z', dueAt: '2026-09-15T08:00:00Z', status: 'overdue' },
      { id: 'inv-ru-09', schoolId: 'sch-rubavu', month: '2026-09', basePlan: 0, activeStudents: 6, perStudent: 2500, referralFees: 0, discount: 0, total: 15000, issuedAt: '2026-09-01T08:00:00Z', dueAt: '2026-09-15T08:00:00Z', status: 'paid', paidAt: '2026-09-04T10:00:00Z', method: 'Airtel Money' },
    ],
    payments: [
      { id: 'pay1', payerId: 'sch-kigali', payerKind: 'school', amount: 47000, method: 'MTN MoMo', reference: 'MP260809.1120.C44812', status: 'confirmed', createdAt: '2026-08-09T11:20:00Z', purpose: 'Invoice 2026-08' },
      { id: 'pay2', payerId: 'u-ind2', payerKind: 'learner', amount: 4000, method: 'MTN MoMo', reference: 'MP260831.0915.A11932', status: 'confirmed', createdAt: daysAgo(20), purpose: 'Exam Pass (60 days)' },
      { id: 'pay3', payerId: 'sch-rubavu', payerKind: 'school', amount: 15000, method: 'Airtel Money', reference: 'AM260904.1000.R0021', status: 'confirmed', createdAt: '2026-09-04T10:00:00Z', purpose: 'Invoice 2026-09' },
    ],
    enrolmentRequests: [
      { id: 'er1', userId: 'u-ind2', schoolId: 'sch-kigali', shareHistory: true, status: 'requested', createdAt: daysAgo(1), message: 'I would like to join a car (B) cohort starting in October.', referralFee: 5000 },
    ],
    notifications: [],
    audit: [
      { id: 'au1', actorId: 'u-admin', action: 'certificate.issued', target: 'KSD-2026-000127 · Olivier Mugenzi', createdAt: daysAgo(11) },
      { id: 'au2', actorId: 'u-super', action: 'school.approved', target: 'Rubavu Lakeside Driving', createdAt: daysAgo(59) },
      { id: 'au3', actorId: 'u-teacher', action: 'moderation.hide', target: 'Post in Cohort A board', createdAt: daysAgo(5) },
      { id: 'au4', actorId: 'u-super', action: 'school.dashboard.viewed', target: 'Musanze Road Academy (read-only)', createdAt: daysAgo(2) },
    ],
    tickets: [
      { id: 'tk1', fromId: 'u-admin-mu', channel: 'whatsapp', subject: 'Cannot pay invoice with Airtel Money', body: 'The payment link says "transaction failed" for our August invoice.', status: 'open', createdAt: daysAgo(2), replies: [] },
      { id: 'tk2', fromId: 'u-s11', channel: 'in_app', subject: 'Video does not download', body: 'Lesson "Braking in rain" stops at 60% when downloading on Wi-Fi.', status: 'open', createdAt: daysAgo(1), replies: [] },
      { id: 'tk3', fromId: 'u-ind2', channel: 'in_app', subject: 'Exam Pass not activated', body: 'I paid but still see the free plan.', status: 'resolved', createdAt: daysAgo(20), replies: [{ by: 'u-super', body: 'Payment confirmed and pass activated. Sorry for the delay!', at: daysAgo(20) }] },
    ],
    reports: [
      { id: 'r1', itemKind: 'question', itemId: 'q38', userId: 'u-s7', reason: 'The question asks for an order but only one answer can be chosen — confusing.', status: 'open', createdAt: daysAgo(2) },
      { id: 'r2', itemKind: 'lesson', itemId: 'l-urban-speed', userId: 'u-s5', reason: 'The text should say the exact urban speed limit number.', status: 'open', createdAt: daysAgo(4) },
    ],
    examResults: [
      { id: 'ex1', userId: 'u-s8', date: daysAgo(10), passed: true, score: 88, confirmedBy: 'u-teacher2' },
      { id: 'ex2', userId: 'u-s9', date: daysAgo(5), passed: true, score: 80 },
    ],
    attendance: [
      { id: 'at1', cohortId: 'c-kg-a', date: daysAgo(7), topic: 'Road signs — classroom', present: ['u-student', 'u-kevin', 'u-s3', 'u-s5', 'u-s7'] },
      { id: 'at2', cohortId: 'c-kg-a', date: daysAgo(4), topic: 'Priority rules — classroom', present: ['u-student', 'u-s3', 'u-s4', 'u-s5', 'u-s7', 'u-kevin'] },
    ],
    studentNotes: [
      { id: 'sn1', studentId: 'u-s4', authorId: 'u-teacher', body: 'Struggles with roundabouts — pair with Divine on Thursday.', createdAt: daysAgo(3) },
    ],
    discountCodes: [
      { code: 'PILOT2026', percent: 100, description: 'First cohort free for pilot schools', active: true, uses: 3 },
      { code: 'RENTREE10', percent: 10, description: 'October back-to-school Exam Pass discount', active: true, uses: 17 },
    ],
    settings: {},
    pricing: { starterPerStudent: 2500, proBase: 20000, proPerStudent: 2000, examPass: 4000, examPassDays: 60, referralFee: 5000, starterMaxStudents: 30 },
    studyDays: {},
    downloads: {},
    otpLog: [],
  }
  buildActivity(state)
  // Notifications for the demo accounts
  const n = (userId: string, title: string, body: string, channel: 'push' | 'whatsapp' | 'dashboard' | 'email', link: string, d: number, read = false) =>
    state.notifications.push({ id: `nt-${state.notifications.length}`, userId, title, body, channel, link, read, createdAt: daysAgo(d, 8) })
  n('u-student', 'New exam from Jean-Paul', 'School theory exam — Cohort A is open until next week.', 'push', '/app/assignments', 0)
  n('u-student', 'Teacher answered in Entering a roundabout', 'Jean-Paul marked a best answer.', 'push', '/app/learn/lesson/l-roundabout-entry#comments', 3, true)
  n('u-student', 'Exam in 12 days', 'Your provisional theory exam is coming. Aim for 2 passed mocks.', 'whatsapp', '/app/practice', 1, true)
  n('u-teacher', 'Fabrice inactive 7 days', 'Fabrice Niyomugabo has not studied for 7 days.', 'dashboard', '/app/teacher/at-risk', 0)
  n('u-teacher', 'Unanswered question in class discussion', 'Aline Uwase asked in Cohort A board.', 'email', '/app/discussions/class:c-kg-a', 1)
  n('u-teacher', 'Post held for review', 'A post with a phone number was held in Cohort A board.', 'dashboard', '/app/teacher/discussions', 0)
  n('u-admin', 'New enrolment request', 'Sandrine Mutesi wants to join (referral).', 'dashboard', '/app/school/enrolments', 1)
  n('u-admin', 'Certificate awaiting issuance', 'Grace Ishimwe was confirmed by Claudine Uwimana.', 'dashboard', '/app/school/certificates', 1)
  n('u-guardian', 'Weekly progress — Kevin', 'Kevin studied 4 days this week. Readiness 49%. Weakest: Priority rules.', 'whatsapp', '/app/guardian', 2)
  n('u-super', 'New school awaiting approval', 'Huye Driving Center submitted documents.', 'dashboard', '/app/admin/schools', 1)
  n('u-editor', '2 content reports', 'Learners reported a question and a lesson.', 'dashboard', '/app/editor/reports', 1)
  n('u-individual', 'Tip of the day', 'At every unmarked junction ask: "Is anyone on my right?"', 'whatsapp', '/app/home#tip', 0)
  // Shuffle once more so review of the attempts varies but stays deterministic
  state.attempts = shuffle(state.attempts, seeded(7)).sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  return state
}
