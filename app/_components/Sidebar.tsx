'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Nav from './Nav'

// Desktop: renders the same 212px sidebar as before (the top bar + scrim are
// display:none at ≥1024px, so the desktop layout is unchanged).
// Mobile (≤1023px): a sticky top bar with a hamburger opens the sidebar as a
// slide-in drawer with a tap-to-close overlay; it auto-closes after navigation.
export default function Sidebar() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Close the drawer whenever the route changes (i.e. after tapping a nav item).
  useEffect(() => { setOpen(false) }, [pathname])

  // Lock background scroll + close on Escape while the drawer is open.
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <>
      <header className="topbar">
        <button
          type="button"
          className="hamburger"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="app-sidebar"
          onClick={() => setOpen(true)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"
               fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className="topbar-brand"><span className="logo" aria-hidden="true" /> Your AI HQ</span>
      </header>

      <div
        className={`scrim${open ? ' show' : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <aside id="app-sidebar" className={`side${open ? ' open' : ''}`}>
        <div className="brand"><span className="logo" aria-hidden="true" /> Your AI HQ</div>
        <Nav />
        <p className="hint">One <code>records</code> table behind all 8 tabs.</p>
      </aside>
    </>
  )
}
