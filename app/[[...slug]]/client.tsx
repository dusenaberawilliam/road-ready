'use client'

import dynamic from 'next/dynamic'

// The store reads localStorage when it loads, so the app only renders in the browser.
const App = dynamic(() => import('../../src/App'), { ssr: false })

export function ClientOnly() {
  return <App />
}
