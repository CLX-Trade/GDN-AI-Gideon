# Gideon

Trade document reconciliation at [gdn-ai.com](https://www.gdn-ai.com), by GDN Enterprise Pty Ltd.

Static pages generated at build time, plus Node serverless functions on Vercel.

    npm install
    npm test            # the backend and rule engine tests
    npm run build       # generates public/
    npm run dev         # full site on localhost:4178 with fake AI, payments and database

## Layout

- `api/` Vercel functions. Hobby allows 12 per deployment; there are 11.
- `lib/` Server code: sessions, entitlements, quotas, model calls, fulfilment.
- `shared/` Rule engine and identifier checks. Runs on the server and in the browser.
- `src/` Page templates and browser code.
- `static/` Files copied as they are, including two older pages (Meeting Room, investor brief).
- `test/` Tests. `test/support/fakes.js` also powers the dev server.

## How access works

Stripe is the source of truth for who has paid. Redis caches that for an hour, and also
holds counters, sign-in links and enquiries. If Redis is lost, paying members keep working,
looked up from Stripe, while the free trial refuses new queries so spend cannot run away.

## Environment variables

Required: `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SESSION_SECRET`,
`CRON_SECRET`, `RESEND_API_KEY`, `AUTH_FROM_EMAIL`, and the `KV_*` set from the Upstash integration.

Optional: `CLAUDE_MODEL`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `VOUCHER_CODES`
(`CODE:DAYS,CODE:DAYS`), `LEADS_EMAIL`, `FREE_TRIAL_LIMIT`, `TRIAL_IP_DAILY_LIMIT`,
`TRIAL_GLOBAL_DAILY_LIMIT`.

## Stripe webhook events

`checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.updated`,
`customer.subscription.deleted`.
