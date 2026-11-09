import { page, organizationSchema, faqSchema, faqHtml, closingCta } from '../layout.js';

const FAQ = [
  ['What does the free check include?', 'Three free queries with no card and no account. A query is one chat message or one document in a pack check, so you can run a three-document pack or ask three questions.'],
  ['What kinds of documents can Gideon read?', 'PDFs, including scanned ones, plus photos, Word documents, Excel sheets and plain text. Invoices, packing lists, bills of lading, letters of credit, contracts, certificates, company registrations and payment instructions are all handled the same way.'],
  ['Does Gideon tell me if a document is fake?', 'No, and you should be wary of anything that claims to. Gideon tells you where documents disagree with each other and which identifiers fail their published checks. Whether a certificate or company is genuine has to be confirmed with the issuing body or registry, and Gideon tells you which ones to call.'],
  ['What happens to my documents?', 'Text is pulled out of your files in your own browser. That text, or page images for scanned documents, goes over an encrypted connection to the AI model for analysis. Gideon does not save your documents on its servers, and your history stays in your browser. The Security page has the detail.'],
  ['How is this different from pasting documents into a chatbot?', 'Two things. First, the cross-checks are done by a rule engine with published check-digit algorithms, so the same pack always gets the same result and text hidden in a document cannot talk it out of a finding. Second, the AI review sits on top and is labelled separately, so you always know which findings are arithmetic and which are opinion.'],
  ['Who is behind Gideon?', 'GDN Enterprise Pty Ltd, an Australian international trade and advisory firm with a desk in Brisbane. Gideon started as the checks our own desk runs after counterparties approached us with clean paperwork and someone else\'s corporate identity. Its AI analysis is powered by Claude, from Anthropic.'],
];

const checks = [
  ['Parties', 'Seller, shipper, beneficiary, buyer, consignee and account holder, compared across every document down to the legal suffix. Near-identical names get called out.'],
  ['Quantities and money', 'Net weight, gross weight, price, totals and currency. Units are converted, and quantity times price is recalculated rather than taken on trust.'],
  ['Dates and sequence', 'Shipped after the latest shipment date. B/L issued before loading. Invoice dated before the contract. Company registered after it signed.'],
  ['Vessels and containers', 'IMO and ISO 6346 check digits on every number, vessel names across renames, and container and seal lists compared set against set.'],
  ['Payment details', 'IBAN checksums, SWIFT format and country, and money going to anyone other than the party you contracted with.'],
  ['Judgement', 'Procedure drift, missing documents, routes that make no sense, certificates with no verifiable reference. This is the AI layer, and it is labelled as such.'],
];

const audiences = [
  ['Traders and brokers', 'Screen a counterparty\'s pack before you commit a deposit, a vessel or your reputation.'],
  ['Importers and exporters', 'Catch the mismatch before the bank or customs does, while it is still cheap to fix.'],
  ['Freight forwarders', 'Reconcile shipping documents across a client\'s file without re-keying a single field.'],
  ['Trade finance and compliance', 'A consistent first pass over every presentation, with the evidence laid out for your reviewer.'],
];

const body = `
<section class="hero">
  <div class="wrap hero-grid">
    <div>
      <div class="eyebrow">Built by a working trade desk</div>
      <h1>Find what doesn't reconcile <em>before the money moves.</em></h1>
      <p class="lede">Drop in a trade document pack. Gideon reads every page, compares every field across every document, and shows you exactly where they disagree.</p>
      <div class="cta-row">
        <a class="btn btn-primary" href="/try">Check a pack free</a>
        <a class="btn btn-ghost" href="/sample-report">See a sample report</a>
      </div>
      <p class="hero-note">No card, no sign-up. Gideon does not store your documents.</p>
    </div>
    <div class="engine" id="engine" aria-label="Demonstration of Gideon comparing four fictional trade documents">
      <div class="engine-bar"><span class="engine-live"><i></i><span>Live demo</span></span></div>
      <noscript><p style="padding:18px;font-size:13px">In this fictional pack Gideon finds a shipper name that differs from the seller, a packing list 20 MT short, a vessel IMO number that fails its check digit, and a shipment after the latest date the letter of credit allows.</p></noscript>
    </div>
  </div>
</section>

<section class="block">
  <div class="wrap split">
    <div class="reveal">
      <div class="eyebrow">Why this exists</div>
      <p class="quote" style="margin-top:14px">The tell is almost never in a single document. It is in what fails to reconcile across the set.</p>
    </div>
    <div class="reveal">
      <p class="lede">Forged packs are built to survive a document-by-document read. Each one looks right on its own. What is hard to fake is six or seven files, produced at different times, that all agree with each other.</p>
      <p style="margin-top:16px;color:var(--ink-2)">Careless packs fail the same way, and those cost money too: a refused presentation, a held shipment, a demurrage bill. So the GDN desk's rule is to <strong style="color:var(--ink)">read across, not down</strong>. Gideon does that reading in minutes instead of an afternoon.</p>
      <p style="margin-top:16px"><a href="/counterparty-verification-checklist" style="color:var(--blue-2)">Read the checklist our desk uses &rarr;</a></p>
    </div>
  </div>
</section>

<section class="block block-alt" id="how">
  <div class="wrap">
    <div class="block-head reveal">
      <div class="eyebrow">How it works</div>
      <h2>From a folder of files to a clear verdict</h2>
    </div>
    <div class="steps">
      <div class="step reveal"><h3>Drop the pack</h3><p>PDFs, scans, photos, Word, Excel. Text is pulled out in your browser, so your files are not uploaded and stored.</p></div>
      <div class="step reveal"><h3>Gideon reads each document</h3><p>Every party, quantity, date, reference and identifier is extracted, exactly as printed, with the page it came from.</p></div>
      <div class="step reveal"><h3>You get the verdict</h3><p>What disagrees, how seriously, the evidence side by side, the questions to ask, and what to verify yourself.</p></div>
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
      <p>Most AI tools blend facts and guesses into one confident paragraph. Gideon keeps them apart, because you need to know which is which before you act.</p>
    </div>
    <div class="grid-2">
      <div class="card reveal"><span class="tag">Rule engine</span><h3>Deterministic checks</h3>
        <ul class="tick-list"><li>The same pack gives the same result every time</li><li>Published standards: IMO, ISO 6346, ISO 13616, ISO 17442</li><li>Instructions hidden in a document have no effect on it</li><li>Findings cannot be downgraded by the AI</li></ul></div>
      <div class="card reveal"><span class="tag">AI review</span><h3>A senior reader on top</h3>
        <ul class="tick-list"><li>Spots procedure drift and conditions added late</li><li>Asks what is missing for this kind of deal</li><li>Questions commercial sense, routes and banking</li><li>Marked as opinion, with the question to ask next</li></ul></div>
    </div>
  </div>
</section>

<section class="block">
  <div class="wrap split">
    <div class="reveal">
      <div class="eyebrow">Straight talk</div>
      <h2 class="h2">What Gideon will not tell you</h2>
      <p style="color:var(--ink-2)">It will not tell you a document is genuine or a counterparty is safe. Nothing that only reads paper can honestly claim that.</p>
    </div>
    <div class="reveal">
      <ul class="tick-list cross-list">
        <li>It does not check a registry, a bank or an inspection company on your behalf</li>
        <li>A clean report means the documents agree, not that the deal is real</li>
        <li>A passing check digit means a number is well formed, not that it exists</li>
        <li>It does not replace your KYC, your lawyer or your own judgement</li>
      </ul>
      <p style="margin-top:18px;color:var(--ink-2)">What it does do is the reading, and it tells you which three things to go and verify yourself.</p>
    </div>
  </div>
</section>

<section class="block block-alt">
  <div class="wrap">
    <div class="block-head reveal">
      <div class="eyebrow">Free, no sign-up</div>
      <h2>Trade document tools you can use right now</h2>
      <p>Instant standards-based checks that run entirely in your browser. Nothing you type leaves your device.</p>
    </div>
    <div class="grid-3">
      <a class="card reveal" href="/tools/imo-number-checker"><h3>IMO number</h3><p>Does this vessel's number pass its check digit?</p></a>
      <a class="card reveal" href="/tools/container-number-checker"><h3>Container number</h3><p>ISO 6346 validation for any freight container.</p></a>
      <a class="card reveal" href="/tools/iban-checker"><h3>IBAN</h3><p>Country, length and checksum before you pay.</p></a>
      <a class="card reveal" href="/tools/swift-bic-checker"><h3>SWIFT / BIC</h3><p>Format, country and test-code detection.</p></a>
      <a class="card reveal" href="/tools/lei-checker"><h3>LEI</h3><p>Legal Entity Identifier checksum.</p></a>
      <a class="card reveal" href="/tools/abn-acn-checker"><h3>ABN / ACN</h3><p>Australian business and company numbers.</p></a>
    </div>
  </div>
</section>

<section class="block">
  <div class="wrap">
    <div class="block-head reveal">
      <div class="eyebrow">Who it's for</div>
      <h2>Anyone who moves money on the strength of paper</h2>
    </div>
    <div class="grid-4">
      ${audiences.map(([t, d]) => `<div class="card reveal"><h3>${t}</h3><p>${d}</p></div>`).join('')}
    </div>
  </div>
</section>

<section class="block block-alt">
  <div class="wrap">
    <div class="block-head reveal">
      <div class="eyebrow">Pricing</div>
      <h2>Less than a single refused presentation</h2>
      <p>Prices are in Australian dollars. Cancel any time.</p>
    </div>
    <div class="grid-3">
      <div class="plan reveal"><h3>Simple</h3><div class="plan-price">A$60<small>/month</small></div><p class="plan-note">100 queries a month. Packs up to 5 documents.</p><a class="btn btn-ghost btn-block" href="/pricing" style="margin-top:18px">See plans</a></div>
      <div class="plan feat reveal"><h3>Professional</h3><div class="plan-price">A$210<small>/month</small></div><p class="plan-note">1,000 queries a month. Packs up to 20 documents.</p><a class="btn btn-primary btn-block" href="/pricing" style="margin-top:18px">See plans</a></div>
      <div class="plan reveal"><h3>Done for you</h3><div class="plan-price">A$490<small> once</small></div><p class="plan-note">Up to five documents, reviewed by the GDN desk, delivered in two business days.</p><a class="btn btn-ghost btn-block" href="/pricing#pilot" style="margin-top:18px">Book a pilot</a></div>
    </div>
  </div>
</section>

<section class="block">
  <div class="narrow">
    <div class="block-head reveal"><div class="eyebrow">Questions</div><h2>Before you start</h2></div>
    ${faqHtml(FAQ)}
    <p style="margin-top:28px;color:var(--ink-3);font-size:15px">Gideon is also a general business analyst, with web search, voice, and finished files in PDF, Word and Excel. For bigger questions, the <a href="/meeting-room" style="color:var(--blue-2)">Meeting Room</a> seats up to four AI models around one problem.</p>
  </div>
</section>

${closingCta()}
`;

export default page({
  path: '/',
  title: 'Gideon · Find what doesn\'t reconcile across your trade documents',
  description: 'Drop in a trade document pack. Gideon compares every party, quantity, date and identifier across every document and shows you where they disagree, before the money moves. Free to try, no card.',
  body,
  head: '<meta name="google-site-verification" content="o0e3BD2wVL47_petaxFvtRwMI67JdsSTcNnFqZBbcbQ">',
  scripts: ['/assets/hero.js'],
  schema: [
    organizationSchema,
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Gideon',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web browser',
      url: 'https://www.gdn-ai.com/',
      description: 'Trade document reconciliation. Compares every field across a document pack and reports what does not match.',
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
