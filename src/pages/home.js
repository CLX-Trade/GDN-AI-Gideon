import { page, organizationSchema, websiteSchema, faqSchema, faqHtml, closingCta } from '../layout.js';

const FAQ = [
  ['What can I ask Gideon to do?', 'Anything you would hand to a sharp business manager who can read, research and write. Review a contract or a quote, compare an invoice against what was agreed, research a supplier, a market or a rule, draft an email or a letter, build a spreadsheet, or write up a report. You can type, attach files, or talk it through on a live call.'],
  ['How do the 2 free weeks work?', 'Choose the Simple plan and enter a card. You pay nothing for 14 days and get the full plan: 100 queries a month. Checkout shows the date of the first charge, we email you 3 days before it, and you can cancel from Manage billing before then and pay nothing. If you would rather not give a card, three free queries need no card and no sign-up.'],
  ['What kinds of documents can Gideon read?', 'PDFs, including scanned ones, plus photos, Word documents, Excel sheets and plain text. Contracts, quotes, invoices, statements, proposals, policies and trade documents are all handled the same way.'],
  ['Can Gideon make files for me?', 'Yes. Ask for a report, a letter, a spreadsheet or a summary and Gideon delivers it as a file you can download, in PDF, Word, Excel, CSV or Markdown.'],
  ['Does Gideon tell me if a document is fake?', 'No, and you should be wary of anything that claims to. Gideon tells you where documents disagree with each other and which identifiers fail their published checks. Whether a certificate or company is genuine has to be confirmed with the issuing body or registry, and Gideon tells you which ones to call.'],
  ['What happens to my documents?', 'Text is pulled out of your files in your own browser. That text, or page images for scanned documents, goes over an encrypted connection to the AI model for analysis. Gideon does not save your documents on its servers, and your history stays in your browser. The Security page has the detail.'],
  ['Who is behind Gideon?', 'GDN Enterprise Pty Ltd, an Australian trade and advisory firm with a desk in Brisbane. Gideon started as the checks our own desk runs on every deal, and grew into the business manager we wanted for ourselves. Its AI is powered by Claude, from Anthropic.'],
];

const jobs = [
  ['Reads your documents', 'Contracts, quotes, invoices, statements and proposals. Gideon reads every page and tells you what matters, in plain English.'],
  ['Finds what does not add up', 'An invoice over the quote, terms that changed between drafts, a total that does not match its lines. It compares documents against each other, not just one at a time.'],
  ['Researches live', 'Suppliers, markets, prices, rules and news, searched on the web as you ask, with the sources shown so you can check them.'],
  ['Writes it for you', 'Reports, letters, emails, spreadsheets and summaries, delivered as files in PDF, Word or Excel, ready to send or edit.'],
  ['Talks it through', 'Start a live voice call and think out loud with Gideon, the way you would with a manager across the desk. Paste or attach things as you go.'],
  ['Gets a second opinion', 'For bigger decisions, the Meeting Room puts up to four AI models around one problem and shows you where they agree and disagree.'],
];

const checks = [
  ['Parties', 'Seller, buyer, payee and account holder, compared across every document down to the legal suffix. Near-identical names get called out.'],
  ['Quantities and money', 'Quantities, prices, totals and currency. Units are converted, and quantity times price is recalculated rather than taken on trust.'],
  ['Dates and sequence', 'An invoice dated before the contract, a delivery after the deadline, a company registered after it signed.'],
  ['Identifiers', 'IBAN, SWIFT, ABN, LEI, IMO and container numbers checked against their published check digits.'],
  ['Payment details', 'Money going to anyone other than the party you contracted with, and bank details that change between documents.'],
  ['Judgement', 'Terms added late, missing documents, things that make no commercial sense. This is the AI layer, and it is labelled as such.'],
];

const audiences = [
  ['Small business owners', 'A manager for the paperwork, the research and the writing, without adding a salary.'],
  ['Sole traders and consultants', 'Quotes, proposals, contracts and follow-ups handled in minutes, so you can get back to the work you are paid for.'],
  ['Finance and admin teams', 'A consistent first read over invoices, statements and contracts, with the evidence laid out for whoever signs off.'],
  ['Importers, exporters and traders', 'Gideon was built on a working trade desk, so it is especially good at checking a document pack before the money moves.'],
];

const body = `
<section class="hero">
  <div class="wrap hero-grid">
    <div>
      <div class="eyebrow">Your AI business manager</div>
      <h1>A business manager for your desk. <em>First 2 weeks free.</em></h1>
      <p class="lede">Gideon reads your contracts, invoices and quotes and tells you what doesn't add up. It researches anything live, writes your reports, spreadsheets and letters, and talks it through with you on a call.</p>
      <div class="cta-row">
        <a class="btn btn-primary" href="/pricing">Start 2 weeks free</a>
        <a class="btn btn-ghost" href="/try">Ask 3 questions free</a>
      </div>
      <p class="hero-note">Card required for the free fortnight, A$60 a month after, cancel any time. Three free questions need no card.</p>
    </div>
    <div class="engine" id="engine" aria-label="Demonstration of Gideon comparing four fictional documents">
      <div class="engine-bar"><span class="engine-live"><i></i><span>Live demo: checking a document pack</span></span></div>
      <noscript><p style="padding:18px;font-size:13px">In this fictional pack Gideon finds a shipper name that differs from the seller, a packing list 20 MT short, a vessel IMO number that fails its check digit, and a shipment after the latest date the letter of credit allows.</p></noscript>
    </div>
  </div>
</section>

<section class="block">
  <div class="wrap">
    <div class="block-head reveal">
      <div class="eyebrow">What it does for you</div>
      <h2>The work that piles up on your desk, handled</h2>
      <p>Ask in plain English, attach what you have, or start a call. Gideon does the reading, the research and the writing.</p>
    </div>
    <div class="grid-3">
      ${jobs.map(([t, d]) => `<div class="card reveal"><h3>${t}</h3><p>${d}</p></div>`).join('')}
    </div>
  </div>
</section>

<section class="block block-alt" id="how">
  <div class="wrap">
    <div class="block-head reveal">
      <div class="eyebrow">How it works</div>
      <h2>Ask, attach, or just talk</h2>
    </div>
    <div class="steps">
      <div class="step reveal"><h3>Tell Gideon what you need</h3><p>Type a question, drop in PDFs, scans, photos, Word or Excel files, or start a voice call. Your files are read in your browser and are never stored on our servers. Only the text, or page images for scans, goes securely to the AI for analysis.</p></div>
      <div class="step reveal"><h3>Gideon gets to work</h3><p>It reads every document, compares them against each other, and searches the web when the answer depends on live facts.</p></div>
      <div class="step reveal"><h3>You get the answer</h3><p>A clear answer with the evidence and sources, or a finished report, letter or spreadsheet to download.</p></div>
    </div>
  </div>
</section>

<section class="block">
  <div class="wrap">
    <div class="block-head reveal">
      <div class="eyebrow">Who it's for</div>
      <h2>Anyone running a business on paperwork</h2>
    </div>
    <div class="grid-4">
      ${audiences.map(([t, d]) => `<div class="card reveal"><h3>${t}</h3><p>${d}</p></div>`).join('')}
    </div>
  </div>
</section>

<section class="block block-alt">
  <div class="wrap split">
    <div class="reveal">
      <div class="eyebrow">When the documents have to match</div>
      <p class="quote" style="margin-top:14px">The problem is almost never in a single document. It is in what fails to match across the set.</p>
    </div>
    <div class="reveal">
      <p class="lede">An invoice that looks fine on its own can still be over the quote. A contract can quietly change the terms you agreed by email. Gideon reads across your documents, not just down each one.</p>
      <p style="margin-top:16px;color:var(--ink-2)">It started as the checks the GDN trade desk runs on every deal, where a mismatch can cost a payment. Gideon does that reading in minutes instead of an afternoon.</p>
      <p style="margin-top:16px"><a href="/sample-report" style="color:var(--blue-2)">See a sample report &rarr;</a></p>
    </div>
  </div>
</section>

<section class="block">
  <div class="wrap">
    <div class="block-head reveal">
      <div class="eyebrow">What it checks</div>
      <h2>Every field, against every other document</h2>
    </div>
    <div class="grid-3">
      ${checks.map(([t, d]) => `<div class="card reveal"><h3>${t}</h3><p>${d}</p></div>`).join('')}
    </div>
  </div>
</section>

<section class="block block-alt">
  <div class="wrap">
    <div class="block-head reveal">
      <div class="eyebrow">Two engines, clearly labelled</div>
      <h2>Arithmetic you can trust. Judgement you can question.</h2>
      <p>Most AI tools blend facts and guesses into one confident paragraph. When Gideon checks documents, it keeps them apart, because you need to know which is which before you act.</p>
    </div>
    <div class="grid-2">
      <div class="card reveal"><span class="tag">Rule engine</span><h3>Deterministic checks</h3>
        <ul class="tick-list"><li>The same documents give the same result every time</li><li>Published standards: IMO, ISO 6346, ISO 13616, ISO 17442</li><li>Instructions hidden in a document have no effect on it</li><li>Findings cannot be downgraded by the AI</li></ul></div>
      <div class="card reveal"><span class="tag">AI review</span><h3>A senior reader on top</h3>
        <ul class="tick-list"><li>Spots terms that changed or were added late</li><li>Asks what is missing</li><li>Questions commercial sense and payment details</li><li>Marked as opinion, with the question to ask next</li></ul></div>
    </div>
  </div>
</section>

<section class="block">
  <div class="wrap split">
    <div class="reveal">
      <div class="eyebrow">Straight talk</div>
      <h2 class="h2">What Gideon will not do</h2>
      <p style="color:var(--ink-2)">Gideon is a strong second pair of eyes and a fast writer. It is not a substitute for the professionals you rely on.</p>
    </div>
    <div class="reveal">
      <ul class="tick-list cross-list">
        <li>It does not tell you a document is genuine or a counterparty is safe</li>
        <li>It does not check a registry or a bank on your behalf</li>
        <li>It does not replace your accountant, your lawyer or your own judgement</li>
        <li>It can make mistakes, so check anything you rely on before money moves</li>
      </ul>
      <p style="margin-top:18px;color:var(--ink-2)">What it does do is the reading, the research and the first draft, and it tells you what to go and verify yourself.</p>
    </div>
  </div>
</section>

<section class="block block-alt">
  <div class="wrap">
    <div class="block-head reveal">
      <div class="eyebrow">Free, no sign-up</div>
      <h2>Free checking tools you can use right now</h2>
      <p>Instant standards-based checks that run entirely in your browser. Nothing you type leaves your device.</p>
    </div>
    <div class="grid-3">
      <a class="card reveal" href="/tools/abn-acn-checker"><h3>ABN / ACN</h3><p>Australian business and company numbers.</p></a>
      <a class="card reveal" href="/tools/iban-checker"><h3>IBAN</h3><p>Country, length and checksum before you pay.</p></a>
      <a class="card reveal" href="/tools/swift-bic-checker"><h3>SWIFT / BIC</h3><p>Format, country and test-code detection.</p></a>
      <a class="card reveal" href="/tools/lei-checker"><h3>LEI</h3><p>Legal Entity Identifier checksum.</p></a>
      <a class="card reveal" href="/tools/imo-number-checker"><h3>IMO number</h3><p>Does this vessel's number pass its check digit?</p></a>
      <a class="card reveal" href="/tools/container-number-checker"><h3>Container number</h3><p>ISO 6346 validation for any freight container.</p></a>
    </div>
  </div>
</section>

<section class="block">
  <div class="wrap">
    <div class="block-head reveal">
      <div class="eyebrow">Pricing</div>
      <h2>A business manager for about A$2 a day</h2>
      <p>Prices are in Australian dollars. Cancel any time.</p>
    </div>
    <div class="grid-3">
      <div class="plan feat reveal"><h3>Simple</h3><div class="plan-price">A$60<small>/month</small></div><p class="plan-note">First 2 weeks free, card required. 100 queries a month. Packs up to 5 documents.</p><a class="btn btn-primary btn-block" href="/pricing" style="margin-top:18px">Start 2 weeks free</a></div>
      <div class="plan reveal"><h3>Professional</h3><div class="plan-price">A$210<small>/month</small></div><p class="plan-note">1,000 queries a month. Packs up to 20 documents.</p><a class="btn btn-ghost btn-block" href="/pricing" style="margin-top:18px">See plans</a></div>
      <div class="plan reveal"><h3>Done for you</h3><div class="plan-price">A$490<small> once</small></div><p class="plan-note">Up to five documents, reviewed by the GDN desk, delivered in two business days.</p><a class="btn btn-ghost btn-block" href="/pricing#pilot" style="margin-top:18px">Book a pilot</a></div>
    </div>
  </div>
</section>

<section class="block block-alt">
  <div class="narrow">
    <div class="block-head reveal"><div class="eyebrow">Questions</div><h2>Before you start</h2></div>
    ${faqHtml(FAQ)}
  </div>
</section>

${closingCta()}
`;

export default page({
  path: '/',
  title: 'Gideon: Your AI Business Manager · First 2 Weeks Free',
  description: 'Gideon reads your contracts, invoices and quotes, flags what doesn\'t add up, researches live and writes your reports and letters. First 2 weeks free.',
  body,
  head: '<meta name="google-site-verification" content="o0e3BD2wVL47_petaxFvtRwMI67JdsSTcNnFqZBbcbQ">',
  scripts: ['/assets/hero.js'],
  schema: [
    organizationSchema,
    websiteSchema,
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Gideon',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web browser',
      url: 'https://www.gdn-ai.com/',
      description: 'An AI business manager. Reads business documents and flags what does not add up, researches live with sources, writes reports, spreadsheets and letters, and holds live voice calls.',
      offers: [
        { '@type': 'Offer', name: 'Free trial', price: '0', priceCurrency: 'AUD' },
        { '@type': 'Offer', name: 'Simple', price: '60.00', priceCurrency: 'AUD', priceSpecification: { '@type': 'UnitPriceSpecification', price: '60.00', priceCurrency: 'AUD', unitCode: 'MON' } },
        { '@type': 'Offer', name: 'Professional', price: '210.00', priceCurrency: 'AUD', priceSpecification: { '@type': 'UnitPriceSpecification', price: '210.00', priceCurrency: 'AUD', unitCode: 'MON' } },
      ],
      publisher: { '@type': 'Organization', name: 'GDN Enterprise Pty Ltd' },
    },
    faqSchema(FAQ),
  ],
});
