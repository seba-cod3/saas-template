# Email

Email sending is ready out of the box. The infrastructure uses **Nodemailer** with a plain SMTP transporter, so swapping providers is a one-line env var change — no SDK lock-in.

In local development, **Mailpit** (included in `docker-compose.yml`) catches all outgoing mail and exposes a web UI at `http://localhost:8025`. Nothing reaches a real inbox during development.

## How it works

```
Any route / hook
  → doLater('send-email', { to, subject, html })   (BullMQ job, async)
    → sendEmail()                                   (lib/email/send.ts)
      → nodemailer transporter                      (lib/email/transporter.ts)
        → SMTP server (Mailpit locally, your provider in prod)
```

Sending is always async — jobs are enqueued with BullMQ and processed by the background worker. If the SMTP call fails, BullMQ retries it automatically.

For fire-and-forget cases where you want to call `sendEmail()` directly (e.g. inside another job), that is also fine — the function is exported from `lib/email/index.ts`.

## Local development

Mailpit starts with the rest of the stack:

```bash
docker compose up -d
```

Send a test email via the dev endpoint:

```bash
curl -X POST http://localhost:3001/api/test/email \
  -H 'Content-Type: application/json' \
  -d '{"to":"you@example.com","subject":"Hello","html":"<b>It works!</b>"}'
```

Open `http://localhost:8025` to see it in the Mailpit inbox.

## Creating templates

Templates are plain functions that receive data and return `{ subject, html, text }`. No templating framework required — add complexity only if you need it.

The welcome email in `lib/email/templates/welcome.ts` is a starting point:

```typescript
import { welcomeEmail } from '../lib/email/templates/welcome.js'
import { doLater } from '../lib/queue.js'

const { subject, html, text } = welcomeEmail({ name: user.name, appName: 'Acme' })

await doLater('send-email', { to: user.email, subject, html, text })
```

For richer HTML, drop in any string-based templating approach (`@react-email/render`, Handlebars, MJML, etc.) — the `sendEmail` function accepts any HTML string.

## Sending to all users (broadcast)

>This is a starter-point feature, not yet ready for production. For heavy email sending like a Black Friday campaing you should be getting users from a buffer table, and sending emails in batches.

`sendNews()` in `lib/email/broadcast.ts` queries the user table and enqueues one job per recipient:

```typescript
import { sendNews } from '../lib/email/broadcast.js'

const count = await sendNews({
  subject: 'New feature announcement',
  html: '<p>Check out what we shipped this week.</p>',
  onlyVerified: true, // skip unverified emails
})

console.log(`Queued ${count} emails`)
```

## Switching providers in production

The transporter reads from environment variables. To switch providers, update your env vars and restart the server — no code changes needed.

```env
# apps/server/.env

SMTP_HOST=smtp.youroprovider.com
SMTP_PORT=587
SMTP_USER=your-api-key-or-username
SMTP_PASS=your-secret
SMTP_FROM=Your App <noreply@yourdomain.com>
SMTP_SECURE=false
```

`SMTP_SECURE=true` enables implicit TLS (port 465). `false` uses STARTTLS or unencrypted (port 587 or 1025). Most modern providers use `false` with port 587.

### Recommended providers

| Provider | Free tier                          |
| -------- | ---------------------------------- |
| Resend   | 3,000 emails/month, max 100/day *  |
| Brevo    | 300 emails/day *                   |

#### Resend

1. Create an account at [resend.com](https://resend.com)
2. Add and verify your sending domain
3. Generate an API key

```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=re_xxxxxxxxxxxx   # your Resend API key
SMTP_FROM=You <you@yourdomain.com>
SMTP_SECURE=false
```

#### Brevo (formerly Sendinblue)

1. Create an account at [brevo.com](https://www.brevo.com)
2. Go to **SMTP & API** > **SMTP** tab
3. Copy your SMTP login and master password (or generate a dedicated SMTP key)

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your-brevo-login@example.com
SMTP_PASS=your-smtp-key
SMTP_FROM=You <you@yourdomain.com>
SMTP_SECURE=false
```

## Environment variables reference

| Variable    | Default                            | Description                                               |
| ----------- | ---------------------------------- | --------------------------------------------------------- |
| `SMTP_HOST` | `localhost`                        | SMTP server hostname                                      |
| `SMTP_PORT` | `1025`                             | SMTP server port                                          |
| `SMTP_USER` | _(empty)_                          | SMTP username / API key. Leave empty for Mailpit dev mode |
| `SMTP_PASS` | _(empty)_                          | SMTP password / API key secret                            |
| `SMTP_FROM` | `noreply@localhost`                | Default sender address shown to recipients                |
| `SMTP_SECURE` | `false`                          | `true` for implicit TLS (port 465), `false` for STARTTLS  |
