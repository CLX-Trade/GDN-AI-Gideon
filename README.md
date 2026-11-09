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


## Live voice conversation

The "Talk to Gideon" bar keeps the microphone open beside the written chat. Typing, pasting and attaching carry on during a call, and pasted material goes along with the next thing said.

- `src/assets/voice.js`: the Speaker (speech a sentence at a time, duck, hold, release, discard) and Talk (microphone, transcription, end of turn).
- `shared/speech.js`: the rules, covered by `test/voice.test.js`. What gets said, echo and interruption checks, end-of-turn timing.
- `api/speak.js`: one sentence of speech, capped in characters per day, and `?action=token` for a single-use transcription token.
- `api/chat.js` with `voice: true`: the spoken prompt (`VOICE_SYSTEM`) on the fast model (`CLAUDE_VOICE_MODEL`). Five light exchanges count as one query. Turns with documents or long answers are charged in full.
- `lib/tools.js`: `check_identifier` runs `shared/checks.js` for real when an IMO, container, IBAN and so on comes up, in both chat and voice.
- `static/media/voice/`: short recorded phrases in the site's voice. If `ELEVENLABS_VOICE_ID` changes, record them again through `/api/speak`.

Functions run in `syd1` next to the database. They used to run in `iad1`, which added about a second to every chat turn.

A real microphone and speakers cannot be tested by machine: echo cancelling needs a person in a room. Automated browsers on macOS also cannot open a fake capture device, so the end-to-end test plays a recording into a MediaStream instead.
