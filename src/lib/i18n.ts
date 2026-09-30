import { useCurrentUser } from '../store/store'
import type { Lang } from '../types'

// UI strings in Kinyarwanda, English and French (§20 Localisation).
const dict = {
  home: { en: 'Home', rw: 'Ahabanza', fr: 'Accueil' },
  learn: { en: 'Lessons', rw: 'Amasomo', fr: 'Leçons' },
  practice: { en: 'Practice & exams', rw: 'Imyitozo n\'ibizamini', fr: 'Pratique et examens' },
  assignments: { en: 'From my teacher', rw: 'Ibyo mwarimu yatanze', fr: 'De mon enseignant' },
  notes: { en: 'My notes', rw: 'Inyandiko zanjye', fr: 'Mes notes' },
  discussions: { en: 'Discussions', rw: 'Ibiganiro', fr: 'Discussions' },
  progress: { en: 'My progress', rw: 'Iterambere ryanjye', fr: 'Ma progression' },
  whatsapp: { en: 'WhatsApp bot', rw: 'WhatsApp', fr: 'Bot WhatsApp' },
  certificate: { en: 'Certificate', rw: 'Icyemezo', fr: 'Certificat' },
  plans: { en: 'Exam Pass', rw: 'Exam Pass', fr: 'Pass Examen' },
  findSchool: { en: 'Find a school', rw: 'Shaka ishuri', fr: 'Trouver une école' },
  settings: { en: 'Settings', rw: 'Igenamiterere', fr: 'Paramètres' },
  notifications: { en: 'Notifications', rw: 'Ubutumwa', fr: 'Notifications' },
  logout: { en: 'Sign out', rw: 'Sohoka', fr: 'Se déconnecter' },
  readiness: { en: 'Readiness', rw: 'Kwitegura', fr: 'Préparation' },
  todayPlan: { en: 'Today\'s plan', rw: 'Gahunda y\'uyu munsi', fr: 'Programme du jour' },
  weakest: { en: 'Weakest topics', rw: 'Ingingo zikugoye', fr: 'Sujets les plus faibles' },
  tip: { en: 'Tip of the day', rw: 'Inama y\'uyu munsi', fr: 'Conseil du jour' },
  start: { en: 'Start', rw: 'Tangira', fr: 'Commencer' },
  continue: { en: 'Continue', rw: 'Komeza', fr: 'Continuer' },
  save: { en: 'Save', rw: 'Bika', fr: 'Enregistrer' },
  cancel: { en: 'Cancel', rw: 'Hagarika', fr: 'Annuler' },
  next: { en: 'Next', rw: 'Ibikurikira', fr: 'Suivant' },
  back: { en: 'Back', rw: 'Subira inyuma', fr: 'Retour' },
  submit: { en: 'Submit', rw: 'Ohereza', fr: 'Soumettre' },
  check: { en: 'Check answer', rw: 'Reba igisubizo', fr: 'Vérifier' },
  correct: { en: 'Correct', rw: 'Ni byo', fr: 'Correct' },
  wrong: { en: 'Not quite', rw: 'Si byo', fr: 'Pas tout à fait' },
  video: { en: 'Video', rw: 'Amashusho', fr: 'Vidéo' },
  text: { en: 'Text', rw: 'Inyandiko', fr: 'Texte' },
  comments: { en: 'Comments', rw: 'Ibitekerezo', fr: 'Commentaires' },
  attachments: { en: 'Additional material', rw: 'Ibindi bikoresho', fr: 'Matériel supplémentaire' },
  dashboard: { en: 'Dashboard', rw: 'Imbonerahamwe', fr: 'Tableau de bord' },
  students: { en: 'Students', rw: 'Abanyeshuri', fr: 'Élèves' },
  teachers: { en: 'Teachers', rw: 'Abarimu', fr: 'Enseignants' },
  content: { en: 'Content', rw: 'Ibirimo', fr: 'Contenu' },
  reports: { en: 'Reports', rw: 'Raporo', fr: 'Rapports' },
  billing: { en: 'Billing', rw: 'Kwishyura', fr: 'Facturation' },
  guardian: { en: 'My child', rw: 'Umwana wanjye', fr: 'Mon enfant' },
  search: { en: 'Search', rw: 'Shakisha', fr: 'Rechercher' },
  language: { en: 'Language', rw: 'Ururimi', fr: 'Langue' },
  notReady: { en: 'Not ready', rw: 'Ntiwiteguye', fr: 'Pas prêt' },
  almostReady: { en: 'Almost ready', rw: 'Uri hafi', fr: 'Presque prêt' },
  examReady: { en: 'Exam-ready', rw: 'Witeguye ikizamini', fr: 'Prêt pour l\'examen' },
  greeting: { en: 'Good to see you', rw: 'Muraho', fr: 'Bonjour' },
} satisfies Record<string, Record<Lang, string>>

export type TKey = keyof typeof dict
export const isTKey = (k: string): k is TKey => k in dict

export const translate = (key: TKey, lang: Lang) => dict[key][lang] ?? dict[key].en

export function useT() {
  const user = useCurrentUser()
  const lang: Lang = user?.language ?? 'en'
  return Object.assign((key: TKey) => translate(key, lang), { lang })
}

export const langNames: Record<Lang, string> = { rw: 'Kinyarwanda', en: 'English', fr: 'Français' }

export const readinessLabel = (label: string, lang: Lang) =>
  label === 'Exam-ready' ? translate('examReady', lang) : label === 'Almost ready' ? translate('almostReady', lang) : translate('notReady', lang)
