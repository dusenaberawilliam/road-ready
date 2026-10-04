import { ClientOnly } from './client'

// Every URL lands here and React Router (src/App.tsx) picks the page in the browser.
export default function Page() {
  return <ClientOnly />
}
