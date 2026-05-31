# Deploy guide — GDN AI (Gideon)

This is the backend that powers the three pages: it holds your Claude key, talks to Claude, enforces the free trial, checks membership, and runs Stripe checkout. You do the few sensitive clicks yourself (logins, key entry, webhook), which is correct, because they protect your accounts and your spend.

## Repo layout

Put these in the repo `CLX-Trade/GDN-AI-Gideon`:

```
index.html          <- the trial page (rename of gdn-ai-trial.html)
membership.html     <- rename of gdn-ai-membership-portal.html
app.html            <- rename of gdn-ai-portal.html
package.json
vercel.json
.gitignore
api/
  chat.js
  checkout.js
  webhook.js
  status.js
  login.js
```

Do not commit `.env`. The `.env.example` lists the variables; the real values go into Vercel, not the repo.

## Step by step

1. **Push the files to GitHub.** Use the upload-files button on the repo page, or the git commands GitHub showed you.

2. **Import the repo into Vercel.** In Vercel, New Project, pick `GDN-AI-Gideon`, and deploy. The first deploy will work for the static pages even before the variables are set.

3. **Add a KV store.** In the Vercel project, open Storage, create a KV (Upstash Redis) database, and connect it to the project. Vercel adds the `KV_REST_API_URL` and `KV_REST_API_TOKEN` variables automatically. This is where trial counts and membership flags live.

4. **Add the environment variables.** Project, Settings, Environment Variables. Add:
   - `ANTHROPIC_API_KEY` = your new Claude key (paste it here, only here)
   - `CLAUDE_MODEL` = the current model name
   - `FREE_TRIAL_LIMIT` = 3
   - `STRIPE_SECRET_KEY` = your Stripe **test** secret key for now (sk_test_...)
   - `PUBLIC_BASE_URL` = your deployed URL
   Redeploy after adding them.

5. **Set up the Stripe webhook.** In Stripe, Developers, Webhooks, Add endpoint. URL: `https://YOURDOMAIN/api/webhook`. Event: `checkout.session.completed`. Save, copy the signing secret it gives you (whsec_...), add it to Vercel as `STRIPE_WEBHOOK_SECRET`, and redeploy.

6. **Test in Stripe test mode.** Open the trial page, use your free searches, hit the paywall, go to membership, pay with the Stripe test card `4242 4242 4242 4242` (any future date, any CVC). Confirm the webhook marks you a member and the app page unlocks.

7. **Go live last.** Only after testing end to end, switch Stripe to live keys, update `STRIPE_SECRET_KEY` and the webhook, and then point traffic and ads at the trial page.

## Endpoints the front end will call

- `POST /api/chat` with `{ messages: [...] }` returns `{ text, member, trialUsed, trialLimit }` or `402 { paywall: true }` when the free trial is used up.
- `POST /api/checkout` with `{ priceId, email }` returns `{ url }` to send the buyer to Stripe.
- `POST /api/login` with `{ email }` sets the session and returns `{ member }`.
- `GET /api/status` returns `{ member, trialUsed, trialLimit }`.

## Honest limitations to fix before scale

- **Login is MVP.** `api/login.js` trusts whatever email is typed. Before public launch, replace it with verified login (a magic link, or Clerk or Auth0) so nobody can claim a member's email. Until then, keep it in test or soft launch.
- **Trial limit is per browser.** It is enforced server side in KV but keyed to a browser cookie, so clearing cookies resets the three free searches. That is acceptable to start; tighten later if abuse appears.
- **Test before money.** Treat this as a working starting point, not a hardened payment system. Run it in Stripe test mode and ideally have a developer review it before you accept real payments.

## Still to do: wire the front end to these endpoints

The three HTML pages currently run the demo (they call the model directly and track the trial in the browser). They need to be repointed to call `/api/chat`, `/api/checkout`, `/api/login`, and `/api/status` instead. That is the next build step.
