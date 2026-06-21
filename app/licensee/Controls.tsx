'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateLicensee } from './actions'

// Small interactive cells embedded inside the SERVER-rendered table. They never
// touch Supabase directly — they call the updateLicensee server action, which
// runs the write server-side with the service_role key. Styling lives in the
// .lsel / .linp classes (globals.css) so they go 16px / 44px on mobile.

const STATUSES = ['active', 'onboarding', 'paused', 'lost']

export function StatusToggle({ id, status }: { id: number; status: string }) {
  const [val, setVal] = useState(status)
  const [pending, start] = useTransition()
  const router = useRouter()
  return (
    <select
      aria-label="Licensee status"
      className="lsel"
      value={val}
      disabled={pending}
      style={{ opacity: pending ? 0.6 : 1 }}
      onChange={e => {
        const v = e.target.value
        const prev = val
        setVal(v)
        start(async () => {
          const r = await updateLicensee(id, 'status', v)
          if (!r?.ok) setVal(prev) // revert on failure
          router.refresh()
        })
      }}
    >
      {STATUSES.map(s => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  )
}

export function OwnerSelect({ id, owner, owners }: { id: number; owner: string; owners: string[] }) {
  const [val, setVal] = useState(owner || '')
  const [pending, start] = useTransition()
  const router = useRouter()
  return (
    <select
      aria-label="Assigned owner"
      className="lsel"
      value={val}
      disabled={pending}
      style={{ opacity: pending ? 0.6 : 1 }}
      onChange={e => {
        const v = e.target.value
        const prev = val
        setVal(v)
        start(async () => {
          const r = await updateLicensee(id, 'owner', v)
          if (!r?.ok) setVal(prev) // revert on failure
          router.refresh()
        })
      }}
    >
      <option value="">Unassigned</option>
      {owners.map(o => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  )
}

// Inline-editable free-text cell. Saves on blur or Enter; optimistic with revert.
export function EditCell({
  id, field, value, placeholder, type = 'text',
}: { id: number; field: string; value: string; placeholder?: string; type?: string }) {
  const [val, setVal] = useState(value || '')
  const [saved, setSaved] = useState(value || '')
  const [pending, start] = useTransition()

  const commit = () => {
    // Mirror the server's trim + 200-char cap so the field shows exactly what's stored.
    const next = val.trim().slice(0, 200)
    if (next !== val) setVal(next)
    if (next === saved) return // nothing changed
    start(async () => {
      const r = await updateLicensee(id, field, next)
      if (r?.ok) setSaved(next)
      else setVal(saved) // revert on failure
    })
  }

  return (
    <input
      aria-label={field}
      className="linp"
      type={type}
      value={val}
      placeholder={placeholder ?? '—'}
      disabled={pending}
      style={{ opacity: pending ? 0.6 : 1 }}
      onChange={e => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
    />
  )
}
