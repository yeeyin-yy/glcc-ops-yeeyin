'use server'

import { supabase, supabaseConfigured } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

// Server actions are invokable by anyone who can load the page, so every argument
// is untrusted. Defenses: whitelist the field, whitelist enum values, cap free-text
// length, and scope EVERY write to category='licensee' so it can never touch
// leads/invoices/contacts/etc. or any other column.
const STATUSES = ['active', 'onboarding', 'paused', 'lost']
const OWNERS = ['', 'Yee Yin'] // '' = Unassigned
// Free-text meta fields the user edits inline. No value whitelist (free text), so
// they are trimmed and hard length-capped instead.
const TEXT_FIELDS = ['email', 'phone', 'address', 'machines', 'contract']
const MAX_LEN = 200

type Result = { ok: boolean; error?: string }

export async function updateLicensee(id: number, field: string, value: string): Promise<Result> {
  if (!supabaseConfigured) return { ok: false, error: 'Supabase not configured' }
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'bad id' }
  const val = typeof value === 'string' ? value : ''

  // status is the only real column we touch; everything else lives in meta.
  if (field === 'status') {
    if (!STATUSES.includes(val)) return { ok: false, error: 'bad status' }
    const { error } = await supabase
      .from('records')
      .update({ status: val })
      .eq('id', id)
      .eq('category', 'licensee')
    if (error) return { ok: false, error: error.message }
    revalidatePath('/licensee')
    return { ok: true }
  }

  // Resolve the meta value for the allowed field, or reject.
  let metaVal: string
  if (field === 'owner') {
    if (!OWNERS.includes(val)) return { ok: false, error: 'bad owner' }
    metaVal = val
  } else if (TEXT_FIELDS.includes(field)) {
    metaVal = val.trim().slice(0, MAX_LEN)
  } else {
    return { ok: false, error: 'bad field' }
  }

  // Merge into the existing meta bag so we never clobber the other fields.
  const { data: cur, error: readErr } = await supabase
    .from('records')
    .select('meta')
    .eq('id', id)
    .eq('category', 'licensee')
    .single()
  if (readErr) return { ok: false, error: readErr.message }
  const meta = { ...(cur?.meta ?? {}), [field]: metaVal }
  const { error } = await supabase
    .from('records')
    .update({ meta })
    .eq('id', id)
    .eq('category', 'licensee')
  if (error) return { ok: false, error: error.message }

  revalidatePath('/licensee')
  return { ok: true }
}
