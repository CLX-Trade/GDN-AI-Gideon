// Free checkers. These do two jobs: they are genuinely useful on their own, and they
// answer specific questions people type into search engines.
import { page, faqHtml, faqSchema, breadcrumbSchema, closingCta } from '../layout.js';

const UPDATED = '2026-11-09';

const widget = (kind, { label, placeholder, sample, pass }) => `
<div class="tool">
  <form data-tool="${kind}" data-pass="${pass}">
    <label class="field" style="margin:0"><span>${label}</span>
      <div class="tool-row"><input class="input" placeholder="${placeholder}" autocomplete="off" spellcheck="false" autocapitalize="characters"><button class="btn btn-primary">Check</button></div>
    </label>
  </form>
  <div class="tool-result" role="status"></div>
  <p class="tool-caveat">Runs on your device. Nothing you type is sent anywhere. For example, try <span class="mono">${sample}</span>.</p>
</div>`;

const crossSell = `<div class="note"><strong>One number passing is not the same as a pack agreeing.</strong> Gideon runs this check on every identifier in your documents, then compares every party, quantity and date across all of them. <a href="/try">Check a pack free</a>.</div>`;

const TOOLS = [
  {
    slug: 'imo-number-checker',
    name: 'IMO number checker',
    title: 'IMO Number Checker: Validate a Vessel\'s IMO Check Digit · Gideon',
    description: 'Free IMO number checker. See instantly whether a vessel\'s 7-digit IMO number passes its check digit, and what to do next to confirm the ship is real.',
    h1: 'IMO number checker',
    lede: 'Check whether a ship\'s IMO number is well formed. A number that fails was mistyped or made up.',
    widgets: [widget('imo', { label: 'IMO number', placeholder: 'IMO 9074729', sample: 'IMO 9074729', pass: 'Passes the IMO check digit.' })],
    body: `
<h2>What this check tells you</h2>
<p>Every IMO ship identification number has seven digits, and the last one is a check digit worked out from the first six. Multiply the first six digits by 7, 6, 5, 4, 3 and 2, add the results, and the last digit of that total must equal the seventh digit.</p>
<p>For IMO 9074729: (9×7) + (0×6) + (7×5) + (4×4) + (7×3) + (2×2) = 139. The last digit of 139 is 9, which matches.</p>
<h2>What it does not tell you</h2>
<p>A passing number is well formed, not proof that the vessel exists or is where the seller says it is. Someone inventing paperwork can pick any valid number, including one belonging to a real ship. So once it passes:</p>
<ul>
<li><strong>Look the number up</strong> in the IMO's public GISIS database, or on Equasis, which is free to register for.</li>
<li><strong>Compare the details.</strong> Name, flag, type, tonnage and year built should fit what you have been told. A 2,000-tonne coaster cannot carry a 50,000-tonne cargo.</li>
<li><strong>Check the position</strong> on an AIS tracker against the date and port on the documents.</li>
<li><strong>Remember that ships get renamed.</strong> The IMO number stays with the hull for life, so match the number, not the name.</li>
</ul>
<p>Our guide on <a href="/guides/check-a-vessel-is-real">how to check a vessel is real</a> covers this step by step.</p>
${crossSell}`,
    faq: [
      ['How many digits is an IMO number?', 'Seven. It is usually written with the prefix IMO, as in IMO 9074729. The seventh digit is the check digit.'],
      ['Does a valid IMO number mean the ship exists?', 'No. It means the number is correctly formed. Confirm it in the IMO GISIS database or Equasis, and compare the name, flag and vessel type with your documents.'],
      ['What should I do if the number fails?', 'Ask for the document to be corrected and find out why it was wrong. A single typing error happens, but on a vessel nomination or bill of lading it deserves a question before any money moves.'],
    ],
  },
  {
    slug: 'container-number-checker',
    name: 'Container number checker',
    title: 'Container Number Checker: ISO 6346 Check Digit Validator · Gideon',
    description: 'Free shipping container number checker. Validates the ISO 6346 format and check digit of any freight container number instantly, in your browser.',
    h1: 'Container number checker',
    lede: 'Check that a freight container number is valid under ISO 6346 before it goes on your bill of lading.',
    widgets: [widget('container', { label: 'Container number', placeholder: 'CSQU3054383', sample: 'CSQU3054383', pass: 'Passes the ISO 6346 check.' })],
    body: `
<h2>How a container number works</h2>
<p>An ISO 6346 container number has eleven characters:</p>
<ul>
<li><strong>Owner code:</strong> three letters identifying the registered owner or operator, such as CSQ. These are registered with the BIC (Bureau International des Containers).</li>
<li><strong>Equipment category:</strong> one letter. U is a freight container, J is detachable equipment, Z is a trailer or chassis.</li>
<li><strong>Serial number:</strong> six digits.</li>
<li><strong>Check digit:</strong> one digit calculated from the other ten.</li>
</ul>
<p>Each letter converts to a number, skipping multiples of 11, each value is multiplied by a power of two, and the total is divided by 11. The remainder gives the check digit. It catches almost every single-character typing error, which is exactly why it exists.</p>
<h2>What it does not tell you</h2>
<p>A valid number is not proof that the container is on the vessel, or that the owner code belongs to the company on your paperwork. To go further, track the number on the carrier's own website, using a web address you found yourself rather than one from the documents.</p>
<p>Also compare the list. The container numbers on the packing list and the bill of lading should match exactly, and that is the part most often skipped when there are dozens of them.</p>
${crossSell}`,
    faq: [
      ['What does the U in a container number mean?', 'It is the equipment category, and U means a freight container. J means detachable freight container equipment, and Z means a trailer or chassis.'],
      ['Why would a real container number fail this check?', 'Almost always a typing or OCR error, such as O for 0 or I for 1. If the number is on a document and fails, ask for the document to be checked against the physical container.'],
      ['Can I track a container with this tool?', 'No. This confirms the number is well formed. To track it, use the shipping line\'s own tracking page.'],
    ],
  },
  {
    slug: 'iban-checker',
    name: 'IBAN checker',
    title: 'IBAN Checker: Validate an IBAN Before You Pay · Gideon',
    description: 'Free IBAN checker. Validates country, length and mod-97 check digits instantly in your browser. Nothing you type is sent anywhere.',
    h1: 'IBAN checker',
    lede: 'Check a payment instruction\'s IBAN for the right length and valid check digits, before the money goes.',
    widgets: [widget('iban', { label: 'IBAN', placeholder: 'GB82 WEST 1234 5698 7654 32', sample: 'GB82 WEST 1234 5698 7654 32', pass: 'Passes the IBAN check.' })],
    body: `
<h2>What this check does</h2>
<p>An IBAN starts with a two-letter country code and two check digits, followed by the account details. Each country has one fixed length. This tool confirms the length matches the country and runs the ISO 7064 mod-97 calculation, which catches nearly all typing errors.</p>
<p>Some countries, including the United States, Australia and China, do not issue IBANs. An IBAN claiming to be from one of those countries is a serious warning sign.</p>
<h2>What it does not tell you</h2>
<p>This does not confirm that the account is open, or who holds it. That is the part that matters most, because in a payment-diversion fraud the IBAN is usually perfectly valid: it simply belongs to someone else.</p>
<ul>
<li><strong>Match the account name</strong> to the party you contracted with, exactly. Payment to a third party needs an explanation that holds up.</li>
<li><strong>Be suspicious of changed details.</strong> A late email saying the bank details have changed is the classic pattern.</li>
<li><strong>Call to confirm,</strong> using a number you found independently, never one from the same email or document.</li>
</ul>
<p>Gideon flags a third-party beneficiary automatically when it checks a pack. <a href="/try">Try it free</a>.</p>`,
    faq: [
      ['Does a valid IBAN mean the account exists?', 'No. It means the number is correctly formed. Only the bank can confirm that the account exists and who holds it.'],
      ['Does Australia use IBANs?', 'No. Australian accounts use a BSB and account number, with a SWIFT code for international payments. An IBAN claiming to be Australian is not genuine.'],
      ['Is it safe to type an IBAN here?', 'Yes. The check runs entirely in your browser. Nothing you type leaves your device.'],
    ],
  },
  {
    slug: 'swift-bic-checker',
    name: 'SWIFT / BIC checker',
    title: 'SWIFT Code Checker: Validate a BIC Format and Country · Gideon',
    description: 'Free SWIFT/BIC checker. Validates the format, identifies the country and flags test codes that cannot carry live payments.',
    h1: 'SWIFT / BIC checker',
    lede: 'Check that a SWIFT code is correctly formed, see which country it points to, and catch test codes.',
    widgets: [widget('bic', { label: 'SWIFT / BIC code', placeholder: 'OCBCSGSG', sample: 'DEUTDEFF500', pass: 'The format is correct.' })],
    body: `
<h2>How to read a SWIFT code</h2>
<p>A BIC under ISO 9362 has either 8 or 11 characters:</p>
<ul>
<li><strong>Institution:</strong> the first four characters identify the bank.</li>
<li><strong>Country:</strong> the next two are the ISO country code.</li>
<li><strong>Location:</strong> two more characters. If the last of these is 0, it marks a test code, which cannot carry a live payment.</li>
<li><strong>Branch:</strong> an optional final three characters. XXX, or nothing, means the head office.</li>
</ul>
<h2>What to look for</h2>
<p>Ask whether the country makes sense. A bank in a jurisdiction unrelated to the seller, the buyer or the cargo needs an explanation that holds up. If the payment instruction has both an IBAN and a SWIFT code, their country codes should normally match.</p>
<p>BIC has no check digit, so this tool checks shape and country only. It cannot tell you that the bank exists under that code. Confirm that with the bank, or through a directory your own bank has access to.</p>
${crossSell}`,
    faq: [
      ['Are SWIFT code and BIC the same thing?', 'Yes. BIC stands for Business Identifier Code, and people commonly call it a SWIFT code.'],
      ['Why does my code have 8 characters instead of 11?', 'Eight-character codes refer to the bank\'s head office. Eleven-character codes add a branch.'],
      ['What is a test BIC?', 'A BIC whose eighth character is 0 is a test and training code. It cannot be used for a real payment, so seeing one on a payment instruction is a serious red flag.'],
    ],
  },
  {
    slug: 'lei-checker',
    name: 'LEI checker',
    title: 'LEI Checker: Validate a Legal Entity Identifier · Gideon',
    description: 'Free LEI checker. Validates the ISO 17442 format and check digits of a Legal Entity Identifier instantly in your browser.',
    h1: 'LEI checker',
    lede: 'Check that a Legal Entity Identifier is correctly formed before you rely on it.',
    widgets: [widget('lei', { label: 'Legal Entity Identifier', placeholder: '5493001KJTIIGC8Y1R12', sample: '5493001KJTIIGC8Y1R12', pass: 'Passes the LEI check.' })],
    body: `
<h2>What an LEI is</h2>
<p>A Legal Entity Identifier is a 20-character code under ISO 17442 that identifies a company in financial transactions. The last two characters are check digits, calculated with the mod 97-10 method, and that calculation is what this tool runs.</p>
<h2>What to do next</h2>
<p>A passing result says the code is well formed. To confirm whom it belongs to, look it up in the public GLEIF database at gleif.org, and compare the legal name, the address and the status with your documents. An LEI record can lapse, so check that it is still current.</p>
<p>Then compare it with the registration number on the company's documents, and take that number to the actual company registry in the country it claims.</p>
${crossSell}`,
    faq: [
      ['Where can I look up an LEI?', 'In the free GLEIF database at gleif.org, which shows the registered legal name, address and status.'],
      ['Does a valid LEI mean the company is trustworthy?', 'No. It means the code is well formed. An LEI identifies a legal entity. It says nothing about whether the party you are dealing with is really that entity.'],
    ],
  },
  {
    slug: 'abn-acn-checker',
    name: 'ABN and ACN checker',
    title: 'ABN and ACN Checker: Validate Australian Company Numbers · Gideon',
    description: 'Free ABN and ACN checker. Validates the check digits of Australian Business Numbers and Australian Company Numbers instantly in your browser.',
    h1: 'ABN and ACN checker',
    lede: 'Check that an Australian Business Number or Australian Company Number is correctly formed.',
    widgets: [
      widget('abn', { label: 'ABN (11 digits)', placeholder: '51 824 753 556', sample: '51 824 753 556', pass: 'Passes the ABN check.' }),
      widget('acn', { label: 'ACN (9 digits)', placeholder: '666 495 263', sample: '666 495 263', pass: 'Passes the ACN check.' }),
    ],
    body: `
<h2>ABN and ACN: what is the difference?</h2>
<p>An <strong>ACN</strong> is the nine-digit number ASIC gives to a company when it is registered. An <strong>ABN</strong> is the eleven-digit number used for tax and business dealings. Companies usually have both, and a company's ABN is commonly its ACN with two extra digits in front.</p>
<p>Both contain check digits, so a typing error will almost always fail. A number that fails on a contract or invoice was either mistyped or made up.</p>
<h2>What to do next</h2>
<p>This confirms a number is well formed, not that it belongs to the company on the letterhead. Impersonation frauds often use a real company's real number. So:</p>
<ul>
<li>Search the ABN on the government's free ABN Lookup at abr.business.gov.au.</li>
<li>Search the ACN on the ASIC register, and compare the name exactly, including the suffix.</li>
<li>Check the status is active, and that the registration date makes sense against the contract date.</li>
<li>Contact the company using details you found independently, not those on the paperwork.</li>
</ul>
<p>Our <a href="/counterparty-verification-checklist">counterparty verification checklist</a> walks through the whole process.</p>`,
    faq: [
      ['How do I check if an ABN is real?', 'Use the free ABN Lookup at abr.business.gov.au. This tool only tells you whether the number is correctly formed.'],
      ['Is an ACN the same as an ABN?', 'No. An ACN identifies a registered company and has nine digits. An ABN identifies a business for tax purposes and has eleven.'],
    ],
  },
];

function toolPage(t) {
  const path = `/tools/${t.slug}`;
  return {
    path,
    updated: UPDATED,
    html: page({
      path,
      title: t.title,
      description: t.description,
      current: '/tools',
      scripts: ['/assets/tool.js'],
      schema: [
        faqSchema(t.faq),
        breadcrumbSchema([['Home', '/'], ['Free tools', '/tools'], [t.name, path]]),
        { '@context': 'https://schema.org', '@type': 'WebApplication', name: t.name, url: `https://www.gdn-ai.com${path}`, applicationCategory: 'BusinessApplication', operatingSystem: 'Web browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'AUD' } },
      ],
      body: `
<section class="page-head"><div class="narrow">
  <p class="crumbs"><a href="/tools">Free tools</a> / ${t.name}</p>
  <h1>${t.h1}</h1>
  <p class="lede">${t.lede}</p>
</div></section>
<section style="padding-bottom:64px"><div class="narrow">
  <div style="display:grid;gap:14px">${t.widgets.join('')}</div>
  <div class="prose" style="margin-top:44px">${t.body}</div>
  <h2 class="h2" style="font-size:26px;margin:48px 0 8px">Common questions</h2>
  ${faqHtml(t.faq)}
</div></section>
${closingCta('Now check the whole pack.', 'Every identifier, party, quantity and date, compared across every document. Three free queries, no card.')}`,
    }),
  };
}

const hub = {
  path: '/tools',
  updated: UPDATED,
  html: page({
    path: '/tools',
    title: 'Free Trade Document Tools: IMO, Container, IBAN, SWIFT, LEI · Gideon',
    description: 'Free tools for checking trade documents. Validate IMO numbers, container numbers, IBANs, SWIFT codes, LEIs, ABNs and ACNs instantly in your browser, with no sign-up.',
    current: '/tools',
    schema: [breadcrumbSchema([['Home', '/'], ['Free tools', '/tools']])],
    body: `
<section class="page-head"><div class="wrap">
  <div class="eyebrow">Free, no sign-up</div>
  <h1>Trade document tools</h1>
  <p class="lede" style="max-width:40em">Instant checks against published standards. They run in your browser, so nothing you type leaves your device.</p>
</div></section>
<section style="padding-bottom:72px"><div class="wrap"><div class="grid-3">
  ${TOOLS.map((t) => `<a class="card" href="/tools/${t.slug}"><h3>${t.name}</h3><p>${t.lede}</p></a>`).join('')}
</div></div></section>
${closingCta('Got a whole pack?', 'Gideon runs all of these and compares every field across every document.')}`,
  }),
};

export default [hub, ...TOOLS.map(toolPage)];
