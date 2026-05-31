# GDN AI — Gideon

A Claude powered business and trade assistant, branded as Gideon and sold by membership under GDN Enterprise Pty Ltd.

This package contains the three front end pages and the assets. It also explains the visitor flow, what is real in this preview, and what the backend must do before you can take payments or run ads.

---

## The three pages

| File | Role | Public route (suggested) |
|------|------|--------------------------|
| `gdn-ai-trial.html` | Free trial. The landing page visitors hit first. Three free searches with Gideon, then a paywall. | `gdn-ai.com/` (set as index) |
| `gdn-ai-membership-portal.html` | Membership. The Gideon hero video, the pricing, and sign up. | `gdn-ai.com/membership` |
| `gdn-ai-portal.html` | Unlimited workspace. The full chat for paying members. | `gdn-ai.com/app` |

Assets: `gideon-intro.mp4` (hero video), `gideon-figure.jpg`, `gideon-avatar.jpg`.

---

## The visitor flow

1. A visitor lands on `gdn-ai.com`, which serves the **trial** page.
2. They get **three free searches** with Gideon. A counter in the header shows how many remain.
3. On the fourth attempt a **paywall** appears and sends them to the **membership** page.
4. On the membership page they choose a tier ($2 or $7 per day, billed monthly or annually, annual saves 30 percent) and pay.
5. After payment they are unlocked and sent to the **unlimited** workspace.
6. A returning member uses the **Log in** button and goes straight to the unlimited workspace.

Entitlement follows the **account login**, not the IP address or the device. IPs change and computers are shared, so an account is the only reliable gate. The Log in button is that gate.

---

## What is real in this preview vs what needs the backend

This preview is **front end only**. The pages, the look, the chat, the voice, the trial counter, the paywall, and the navigation are all built. Two things behave as production stubs:

- **The Claude responses** run on the preview environment's model. In production they run through **your** Claude API key.
- **The trial limit and the membership unlock** are tracked in the browser for demonstration. A determined visitor could clear them. In production both must be enforced on the server.

Because each page is sandboxed separately inside this chat preview, the cross page steps (navigating from trial to membership to app, and carrying the unlock between them) will not fully chain here. They chain correctly once the three files are deployed together on your domain with the backend below.

---

## What the backend must do

The front end never holds secrets. A small backend server sits behind these pages and does four jobs.

1. **Holds the Claude API key and calls Claude.** The page sends the user's message to your server, the server adds the key and calls Claude, then returns the answer. If the key ever sat in the page, anyone could read it and spend your money.

2. **Authentication (login).** Use an auth provider such as Auth0, Clerk, or Supabase Auth. Do not build your own password storage. The session tells every page whether the visitor is a member.

3. **Payments (Stripe).** Create Stripe subscription products for the two plans and connect your bank for payouts inside the Stripe dashboard. When a payment succeeds, Stripe notifies your server (a webhook), and your server marks that account as a member. That member flag is what unlocks the app page.

4. **Enforcement and metering.** The server counts the three free searches per account, blocks past the limit, checks membership on every request to the app, and records token usage per member against the tier caps.

---

## The money flow

There is no automatic split that routes a percentage to Anthropic on each payment. Two separate systems meet at your margin.

- **In:** members pay GDN through Stripe. Stripe pays out to your bank.
- **Out:** GDN holds its own Anthropic account funded by **prepaid usage credits**. Turn on **auto reload** in the Anthropic Console so it tops up your credits automatically when the balance runs low, billed to your card. This is the same top up behaviour as a personal account.

Your Stripe revenue funds the card that auto reloads your Claude credits. Profit is membership income minus token cost. The per tier query caps and the three search free limit are what keep the token cost below what you collect.

If you ever want a formal reseller or revenue share arrangement, that is a direct commercial conversation with Anthropic, not a Stripe setting.

---

## Build order (recommended)

1. Stand up the backend and move the Claude call behind your API key.
2. Add the auth provider and the Log in flow.
3. Add Stripe subscriptions for the $2 and $7 daily plans plus the annual 30 percent, and connect your bank.
4. Move the trial limit and membership checks onto the server.
5. Turn on Anthropic auto reload and set a monthly spend ceiling.
6. Only then point ads and traffic at the trial page.

Do not run paid promotion before steps 1 to 4 are live. Until then the site cannot take real payments and your API spend is not protected.

---

GDN Enterprise Pty Ltd · ACN 666 495 263 · Brisbane · Dubai · Orlando · São Paulo
Powered by Claude (Anthropic). Confirm the current "powered by Claude" wording and any logo use against Anthropic's brand guidelines before public launch.
