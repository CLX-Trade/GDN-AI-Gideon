// The pages that run the product: workspace, sign-in, pricing.
import { page, esc, faqHtml, faqSchema, closingCta, CONTACT } from '../layout.js';

export const workspace = page({
  path: '/try',
  title: 'Gideon · Check a trade document pack',
  description: 'Drop in a trade document pack. Gideon compares every field across every document and shows you what does not reconcile. Three free queries, no card.',
  bodyClass: 'app',
  bare: true,
  head: '<link rel="stylesheet" href="/assets/workspace.css">',
  scripts: ['/assets/workspace.js'],
  noindex: false,
  body: `
<div class="ws" id="ws">
  <aside class="ws-rail">
    <a class="logo" href="/"><img src="/media/mark-96.png" width="30" height="30" alt=""><span>Gideon</span></a>
    <button class="rail-btn primary" id="new-check">New pack check</button>
    <button class="rail-btn" id="new-chat">New chat</button>
    <input class="rail-search" id="rail-search" type="search" placeholder="Search history" aria-label="Search history">
    <div class="history" id="history"></div>
    <button class="linkish" id="clear-history" style="align-self:flex-start;margin:8px 8px 0;color:var(--ink-3)">Clear history</button>
    <div class="account" id="account" aria-live="polite"><div class="account-plan">Loading…</div></div>
  </aside>
  <div class="ws-main">
    <header class="ws-top">
      <button class="ws-burger" id="burger" aria-label="Menu"><span></span><span></span></button>
      <div class="ws-title" id="ws-title"></div>
      <div class="ws-spacer"></div>
      <button class="toggle" id="voice" aria-pressed="false" title="Have Gideon read answers aloud"><i></i>Voice</button>
    </header>
    <div class="banner" id="banner" role="status" hidden></div>
    <div class="ws-view" id="view"></div>
    <div class="composer-wrap" id="composer-wrap">
      <form class="composer" id="composer">
        <div class="chips" id="chips" hidden></div>
        <div class="composer-row">
          <label class="icon-btn" title="Attach documents to your question"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.5 12.6 21a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4L15.6 9"/></svg><input type="file" id="attach" multiple aria-label="Attach documents"></label>
          <textarea id="input" rows="1" placeholder="Ask Gideon anything…" aria-label="Message Gideon"></textarea>
          <button class="icon-btn" type="button" id="mic" title="Speak your question" aria-label="Speak your question"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>
          <button class="icon-btn send" id="send" aria-label="Send"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>
        </div>
      </form>
      <p class="composer-note">Gideon can make mistakes. Verify anything you rely on before money moves.</p>
    </div>
  </div>
</div>
<dialog class="modal" id="paywall" aria-labelledby="pw-title">
  <h2 id="pw-title">Keep going with Gideon</h2>
  <p id="pw-text"></p>
  <div class="modal-plans">
    <div class="mplan"><b>Simple</b><strong>A$60</strong><small>per month, about A$2 a day. 100 queries, packs up to 5 documents.</small><button class="btn btn-sm btn-ghost btn-block" data-checkout="simple-monthly">Choose Simple</button><div class="plan-err"></div></div>
    <div class="mplan feat"><b>Professional</b><strong>A$210</strong><small>per month, about A$7 a day. 1,000 queries, packs up to 20 documents.</small><button class="btn btn-sm btn-primary btn-block" data-checkout="pro-monthly">Choose Professional</button><div class="plan-err"></div></div>
  </div>
  <div class="modal-foot">
    <span><a class="linkish" href="/pricing">Annual plans save 30%</a></span>
    <span><button class="linkish" type="button" id="pw-code-toggle">I have an access code</button> &nbsp; <a class="linkish" href="/signin">Sign in</a> &nbsp; <button class="linkish" type="button" id="pw-close">Not now</button></span>
  </div>
  <div class="modal-code" id="pw-code">
    <form id="pw-code-form">
      <input class="input" name="email" type="email" placeholder="Your email" required style="margin-bottom:8px" aria-label="Your email">
      <input class="input" name="code" placeholder="Access code" required style="margin-bottom:8px" aria-label="Access code">
      <button class="btn btn-sm btn-ghost btn-block">Apply code</button>
      <div class="form-msg" id="pw-code-msg"></div>
    </form>
  </div>
</dialog>`,
});

export const signin = page({
  path: '/signin',
  title: 'Sign in · Gideon',
  description: 'Sign in to your Gideon workspace with a one-time link sent to your email.',
  noindex: true,
  scripts: ['/assets/signin.js'],
  body: `
<section class="page-head">
  <div class="wrap" style="max-width:480px">
    <div id="signin-request">
      <div class="eyebrow">Members</div>
      <h1 style="font-size:36px">Sign in</h1>
      <p class="muted" id="signin-intro">No password. We email you a link that works once.</p>
      <form id="signin-form" style="margin-top:22px">
        <label class="field"><span>Email address</span><input class="input" type="email" name="email" required autocomplete="email" autofocus></label>
        <button class="btn btn-primary btn-block">Email me a sign-in link</button>
        <div class="form-msg" id="signin-msg" role="status"></div>
      </form>
      <p class="muted" style="margin-top:22px;font-size:14.5px">Not a member? <a href="/try" style="color:var(--blue-2)">Try Gideon free</a> or <a href="/pricing" style="color:var(--blue-2)">see plans</a>.</p>
    </div>
    <div id="signin-confirm" hidden>
      <div class="eyebrow">Almost there</div>
      <h1 style="font-size:36px">Continue to Gideon</h1>
      <p class="muted">Press the button to finish signing in on this device.</p>
      <button class="btn btn-primary btn-block" id="signin-go" style="margin-top:22px">Continue</button>
      <div class="form-msg" id="signin-go-msg" role="status"></div>
    </div>
  </div>
</section>`,
});

const PRICING_FAQ = [
  ['What counts as a query?', 'One chat message, or one document in a pack check. A five-document pack uses five queries. Your counter resets each calendar month.'],
  ['What currency am I charged in?', 'Australian dollars. Your bank may show a converted amount if your card is in another currency.'],
  ['Can I cancel?', 'Yes, at any time, from Manage billing in your account menu. Access continues until the end of the period you have paid for, and you are not charged again.'],
  ['What happens if I reach my monthly limit?', 'Gideon tells you, and new queries pause until your counter resets or you upgrade. You are never charged extra without choosing to.'],
  ['Is there a refund if it is not for me?', 'See our refund policy. If something is not working, email us first: a person at GDN answers, and Australian Consumer Law guarantees always apply.'],
  ['How does the founding pilot work?', 'Send up to five documents and the GDN trade desk reviews them with Gideon, then delivers a written report in two business days. It is a one-off fee with no subscription. We take a limited number while we prove the service.'],
];

const planCard = ({ id, name, badge, featured, monthly, annual, annualMonthly, perDay, features }) => `
<div class="plan${featured ? ' feat' : ''}" data-plan="${id}">
  <div class="plan-badge">${badge || ''}</div>
  <h3>${name}</h3>
  <div class="plan-price"><span data-m>A$${monthly}<small>/month</small></span><span data-a hidden>A$${annual.toLocaleString('en-AU')}<small>/year</small></span></div>
  <p class="plan-note"><span data-m>About A$${perDay} a day. Billed monthly.</span><span data-a hidden>A$${annualMonthly} a month equivalent. Billed once a year.</span></p>
  <ul class="tick-list">${features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
  <button class="btn btn-block ${featured ? 'btn-primary' : 'btn-ghost'}" data-checkout="${id}-monthly" data-monthly="${id}-monthly" data-annual="${id}-annual">Choose ${name}</button>
  <div class="plan-err" role="alert"></div>
</div>`;

export const pricing = page({
  path: '/pricing',
  title: 'Pricing · Gideon trade document reconciliation',
  description: 'Gideon plans from A$60 a month. Check trade document packs and work with an AI trade analyst. Prices in Australian dollars, cancel any time. Free trial with no card.',
  current: '/pricing',
  scripts: ['/assets/pricing.js'],
  schema: [faqSchema(PRICING_FAQ)],
  body: `
<section class="page-head">
  <div class="wrap">
    <div class="eyebrow">Pricing</div>
    <h1>Less than one refused presentation.</h1>
    <p class="lede" style="max-width:40em">Start with three free queries, no card. Prices are in Australian dollars. Cancel any time.</p>
    <p id="checkout-note" class="form-msg" role="status"></p>
  </div>
</section>
<section style="padding-bottom:72px">
  <div class="wrap">
    <div class="price-toggle" role="group" aria-label="Billing period">
      <button id="bill-m" aria-pressed="true">Monthly</button>
      <button id="bill-a" aria-pressed="false">Annual <span class="save">save 30%</span></button>
    </div>
    <div class="grid-3">
      ${planCard({ id: 'simple', name: 'Simple', monthly: 60, annual: 504, annualMonthly: 42, perDay: 2, features: ['100 queries a month', 'Pack checks up to 5 documents', 'Rule checks and AI review', 'Chat with web search', 'Files in PDF, Word and Excel', 'Voice'] })}
      ${planCard({ id: 'pro', name: 'Professional', badge: 'For working desks', featured: true, monthly: 210, annual: 1764, annualMonthly: 147, perDay: 7, features: ['1,000 queries a month', 'Pack checks up to 20 documents', 'Rule checks and AI review', 'Chat with web search', 'Files in PDF, Word and Excel', 'Voice'] })}
      <div class="plan">
        <div class="plan-badge"></div>
        <h3>Enterprise</h3>
        <div class="plan-price" style="font-size:30px;padding:5px 0">Let's talk</div>
        <p class="plan-note">For teams, higher volumes, or private deployment.</p>
        <ul class="tick-list"><li>Volume and team pricing</li><li>Your own document rules and checks</li><li>Private deployment on request</li><li>Onboarding with the GDN desk</li></ul>
        <a class="btn btn-ghost btn-block" href="#enterprise">Contact GDN</a>
      </div>
    </div>
  </div>
</section>
<section class="block block-alt" id="pilot">
  <div class="wrap split">
    <div>
      <div class="eyebrow">Done for you</div>
      <h2 class="h2">Founding pilot: A$490</h2>
      <p style="color:var(--ink-2)">Have a live deal and want a person on it? Send up to five documents. The GDN trade desk reviews them with Gideon and sends a written report within two business days.</p>
      <ul class="tick-list"><li>One-off fee, with no subscription</li><li>Reviewed by people who trade</li><li>Limited places while we prove the service</li></ul>
      <p style="color:var(--ink-3);font-size:14px;margin-top:16px">Send your enquiry first, without the documents. We reply with how to send them securely and how to pay.</p>
    </div>
    <form class="card" data-lead="pilot">
      <label class="field"><span>Your name</span><input class="input" name="name" required autocomplete="name"></label>
      <label class="field"><span>Work email</span><input class="input" name="email" type="email" required autocomplete="email"></label>
      <label class="field"><span>Company</span><input class="input" name="company" autocomplete="organization"></label>
      <label class="field"><span>What are you trading, and what worries you?</span><textarea class="input" name="message"></textarea></label>
      <label class="hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>
      <button class="btn btn-primary btn-block" type="submit">Request a pilot</button>
      <div class="form-msg" role="status"></div>
    </form>
  </div>
</section>
<section class="block" id="enterprise">
  <div class="wrap split">
    <div>
      <div class="eyebrow">Enterprise</div>
      <h2 class="h2">For banks, forwarders and trading houses</h2>
      <p style="color:var(--ink-2)">Tell us your document volumes and what you need checked. We can add your own rules, and deploy privately where your compliance team requires it.</p>
      <p style="color:var(--ink-3);font-size:14.5px;margin-top:14px">Or email <a href="mailto:${CONTACT}" style="color:var(--blue-2)">${CONTACT}</a>.</p>
    </div>
    <form class="card" data-lead="enterprise">
      <label class="field"><span>Your name</span><input class="input" name="name" required autocomplete="name"></label>
      <label class="field"><span>Work email</span><input class="input" name="email" type="email" required autocomplete="email"></label>
      <label class="field"><span>Company</span><input class="input" name="company" autocomplete="organization"></label>
      <label class="field"><span>Volumes and what you need</span><textarea class="input" name="message"></textarea></label>
      <label class="hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>
      <button class="btn btn-primary btn-block" type="submit">Send enquiry</button>
      <div class="form-msg" role="status"></div>
    </form>
  </div>
</section>
<section class="block block-alt" id="passes">
  <div class="wrap">
    <div class="block-head"><div class="eyebrow">Meeting Room</div><h2>Put several AI models on one problem</h2><p>A four-seat AI meeting using your own Anthropic, OpenAI or Google API keys. Your keys stay in your browser and are never sent to GDN.</p></div>
    <div class="grid-2" style="max-width:760px">
      <div class="plan"><h3>Day pass</h3><div class="plan-price">A$26</div><p class="plan-note">A 24-hour window that starts with your first command.</p><button class="btn btn-ghost btn-block" data-checkout="room-day" style="margin-top:14px">Book a day pass</button><div class="plan-err" role="alert"></div></div>
      <div class="plan"><h3>Monthly</h3><div class="plan-price">A$85<small>/month</small></div><p class="plan-note">Four 24-hour sessions each billing month. Cancel any time.</p><button class="btn btn-ghost btn-block" data-checkout="room-month" style="margin-top:14px">Subscribe monthly</button><div class="plan-err" role="alert"></div></div>
    </div>
  </div>
</section>
<section class="block">
  <div class="narrow"><div class="block-head"><div class="eyebrow">Questions</div><h2>About billing</h2></div>${faqHtml(PRICING_FAQ)}</div>
</section>
${closingCta('Try it before you pay.', 'Three free queries. No card, no sign-up.')}`,
});

export const notFound = page({
  path: '/404',
  title: 'Page not found · Gideon',
  description: 'This page does not exist.',
  noindex: true,
  body: `<section class="page-head" style="min-height:50vh"><div class="wrap"><div class="eyebrow">404</div><h1>That page doesn't reconcile.</h1><p class="lede">It may have moved. Try one of these.</p><div class="cta-row"><a class="btn btn-primary" href="/">Home</a><a class="btn btn-ghost" href="/try">Check a pack</a><a class="btn btn-ghost" href="/tools">Free tools</a></div></div></section>`,
});
