// One-time helper to get your GMAIL_REFRESH_TOKEN.
//
//   1) In .env, set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET (from a Google
//      Cloud "Desktop app" OAuth client with the Gmail API enabled).
//   2) Run:  node scripts/get-gmail-token.mjs
//   3) A browser tab opens — sign in to the Gmail account and click "Allow".
//   4) The refresh token prints in the terminal. Paste it as GMAIL_REFRESH_TOKEN
//      into BOTH .env and Vercel → Settings → Environment Variables.
//
// Safe to re-run. It only needs to succeed once.
import http from 'node:http'
import { readFileSync } from 'node:fs'
import { exec } from 'node:child_process'

const SCOPE = 'https://www.googleapis.com/auth/gmail.modify'
const PORT = 5555
const REDIRECT = `http://127.0.0.1:${PORT}/oauth2callback`

function fromEnv(key) {
  if (process.env[key]) return process.env[key].trim()
  try {
    const line = readFileSync(new URL('../.env', import.meta.url), 'utf8')
      .split(/\r?\n/).find(l => l.startsWith(key + '='))
    return line ? line.slice(key.length + 1).trim() : ''
  } catch { return '' }
}

const CLIENT_ID = fromEnv('GMAIL_CLIENT_ID')
const CLIENT_SECRET = fromEnv('GMAIL_CLIENT_SECRET')
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('X  Put GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env first (Desktop-app OAuth client).')
  process.exit(1)
}

const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT,
  response_type: 'code',
  scope: SCOPE,
  access_type: 'offline',
  prompt: 'consent',
})

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith('/oauth2callback')) { res.writeHead(404); res.end(); return }
  const code = new URL(req.url, REDIRECT).searchParams.get('code')
  if (!code) { res.writeHead(400); res.end('No code in callback.'); return }
  try {
    const tok = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT, grant_type: 'authorization_code',
      }),
    }).then(r => r.json())
    if (tok.refresh_token) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end('<h2>Done — close this tab and return to the terminal.</h2>')
      console.log('\nOK  Your GMAIL_REFRESH_TOKEN (paste into .env and Vercel):\n')
      console.log(tok.refresh_token + '\n')
    } else {
      res.writeHead(200); res.end('No refresh_token returned. Re-run after revoking prior access.')
      console.error('\nX  No refresh_token returned. Google only sends one on first consent.\n', tok)
    }
  } catch (e) {
    res.writeHead(500); res.end('Error exchanging code.'); console.error(e)
  } finally {
    setTimeout(() => server.close(() => process.exit(0)), 400)
  }
})

server.listen(PORT, () => {
  console.log('\n1) A browser tab will open. Sign in and click "Allow".')
  console.log('   If it does not open, paste this URL into your browser:\n\n' + authUrl + '\n')
  const open = process.platform === 'win32' ? `start "" "${authUrl}"`
    : process.platform === 'darwin' ? `open "${authUrl}"` : `xdg-open "${authUrl}"`
  exec(open, () => {})
})
