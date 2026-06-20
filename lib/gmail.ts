// Minimal Gmail REST client for the cloud cron (app/api/gmail-brief).
// Mints a short-lived access token from a stored OAuth refresh token, then calls
// the Gmail REST API with built-in fetch — no `googleapis` dependency. SERVER-ONLY:
// the refresh token + client secret must never reach a "use client" file or the browser.

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const API = 'https://gmail.googleapis.com/gmail/v1/users/me'

export type GmailMsg = {
  id: string
  threadId: string
  from: string
  fromEmail: string
  subject: string
  date: string
  messageId: string // RFC822 Message-ID header — needed to thread a reply draft
  snippet: string
  body: string // best-effort decoded plaintext, truncated
}

// --- auth -------------------------------------------------------------------
export async function getAccessToken(): Promise<string> {
  const client_id = process.env.GMAIL_CLIENT_ID?.trim()
  const client_secret = process.env.GMAIL_CLIENT_SECRET?.trim()
  const refresh_token = process.env.GMAIL_REFRESH_TOKEN?.trim()
  if (!client_id || !client_secret || !refresh_token) {
    throw new Error('Gmail not configured — set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN.')
  }
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id, client_secret, refresh_token, grant_type: 'refresh_token' }),
  })
  const json: any = await res.json().catch(() => ({}))
  if (!res.ok || !json.access_token) {
    throw new Error(`Gmail token refresh failed: ${json.error_description || json.error || res.status}`)
  }
  return json.access_token as string
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

// --- list + read ------------------------------------------------------------
export async function listUnreadInbox(token: string, max = 50): Promise<string[]> {
  const url = `${API}/messages?q=${encodeURIComponent('is:unread in:inbox')}&maxResults=${max}`
  const res = await fetch(url, { headers: auth(token) })
  const json: any = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Gmail list failed: ${json.error?.message || res.status}`)
  return (json.messages || []).map((m: any) => m.id as string)
}

export async function getMessage(token: string, id: string): Promise<GmailMsg> {
  const res = await fetch(`${API}/messages/${id}?format=full`, { headers: auth(token) })
  const json: any = await res.json()
  const headers: any[] = json.payload?.headers || []
  const h = (name: string) =>
    headers.find(x => x.name.toLowerCase() === name.toLowerCase())?.value || ''
  const from = h('From')
  const fromEmail = (from.match(/<([^>]+)>/)?.[1] || from).trim().toLowerCase()
  return {
    id: json.id,
    threadId: json.threadId,
    from,
    fromEmail,
    subject: h('Subject'),
    date: h('Date'),
    messageId: h('Message-ID') || h('Message-Id'),
    snippet: json.snippet || '',
    body: decodeBody(json.payload).slice(0, 2000),
  }
}

// Recursively pull the first text/plain part; fall back to stripped text/html.
function decodeBody(payload: any): string {
  if (!payload) return ''
  const dec = (data?: string) =>
    data ? Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8') : ''
  if (payload.mimeType === 'text/plain' && payload.body?.data) return dec(payload.body.data)
  if (payload.parts) {
    const plain = payload.parts.find((p: any) => p.mimeType === 'text/plain')
    if (plain?.body?.data) return dec(plain.body.data)
    for (const p of payload.parts) {
      const got = decodeBody(p)
      if (got) return got
    }
  }
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return dec(payload.body.data).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }
  return ''
}

// --- modify labels (file / archive / mark read) -----------------------------
export async function modifyLabels(token: string, id: string, add: string[], remove: string[]) {
  const res = await fetch(`${API}/messages/${id}/modify`, {
    method: 'POST',
    headers: { ...auth(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ addLabelIds: add, removeLabelIds: remove }),
  })
  if (!res.ok) {
    const j: any = await res.json().catch(() => ({}))
    throw new Error(`Gmail modify failed: ${j.error?.message || res.status}`)
  }
}

// --- create a draft reply (never sends — owner reviews in Gmail) -------------
export async function createDraftReply(token: string, msg: GmailMsg, replyText: string) {
  const to = msg.fromEmail || msg.from
  const subject = /^re:/i.test(msg.subject) ? msg.subject : `Re: ${msg.subject}`
  const headerLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    msg.messageId ? `In-Reply-To: ${msg.messageId}` : '',
    msg.messageId ? `References: ${msg.messageId}` : '',
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    replyText,
  ].filter(Boolean)
  const raw = Buffer.from(headerLines.join('\r\n'), 'utf8')
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const res = await fetch(`${API}/drafts`, {
    method: 'POST',
    headers: { ...auth(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { raw, threadId: msg.threadId } }),
  })
  if (!res.ok) {
    const j: any = await res.json().catch(() => ({}))
    throw new Error(`Gmail draft failed: ${j.error?.message || res.status}`)
  }
}
