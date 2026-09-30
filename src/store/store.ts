// Client-side store. Every mutation goes through `update`, so replacing the
// actions in ./actions.ts with API calls later does not touch the pages.
import { produce, type Draft } from 'immer'
import { useSyncExternalStore } from 'react'
import { createSeed, STATE_VERSION } from '../data/seed'
import type { AppState } from './state'

const KEY = 'dslp-state'

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      if (parsed.version === STATE_VERSION) return parsed
    }
  } catch {
    /* storage unavailable or corrupt — fall back to seed */
  }
  return createSeed()
}

let state: AppState = load()
const listeners = new Set<() => void>()
let saveTimer: number | undefined

const persist = () => {
  clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* quota or private mode — the demo keeps working in memory */
    }
  }, 150)
}

export const getState = () => state

export function update(recipe: (draft: Draft<AppState>) => void) {
  state = produce(state, recipe)
  persist()
  listeners.forEach((l) => l())
}

export function resetDemo(keepSession = true) {
  const session = state.sessionUserId
  state = createSeed()
  if (keepSession) state.sessionUserId = session
  persist()
  listeners.forEach((l) => l())
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export const useAppState = () => useSyncExternalStore(subscribe, getState)

export const useCurrentUser = () => {
  const s = useAppState()
  return s.users.find((u) => u.id === s.sessionUserId) ?? null
}

/** Current user when the route guard guarantees a session. */
export const useMe = () => {
  const u = useCurrentUser()
  if (!u) throw new Error('No session')
  return u
}
