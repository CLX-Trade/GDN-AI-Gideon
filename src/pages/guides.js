// Guides written from the GDN desk's point of view. Each answers one question a trader,
// importer or forwarder actually searches for, plainly and without invented statistics.
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { page, breadcrumbSchema, closingCta, faqHtml, faqSchema } from '../layout.js';

const here = dirname(fileURLToPath(import.meta.url));
const UPDATED = '2026-11-09';

const article = ({ slug, path, title, name, description, lede, body, faq = [], updated = UPDATED }) => {
  const url = path || `/guides/${slug}`;
  return {
    path: url,
    updated,
    name,
    lede,
    html: page({
      path: url,
      title: `${title} · Gideon`,
      description,
      current: '/guides',
      ogType: 'article',
      schema: [
        { '@context': 'https://schema.org', '@type': 'Article', headline: title, description, datePublished: updated, dateModified: updated, author: { '@type': 'Organization', name: 'GDN trade desk' }, publisher: { '@type': 'Organization', name: 'GDN Enterprise Pty Ltd', logo: { '@type': 'ImageObject', url: 'https://www.gdn-ai.com/media/mark-512.png' } }, mainEntityOfPage: `https://www.gdn-ai.com${url}` },
        breadcrumbSchema([['Home', '/'], ['Guides', '/guides'], [name, url]]),
        ...(faq.length ? [faqSchema(faq)] : []),
      ],
      body: `
<section class="page-head"><div class="narrow">
  <p class="crumbs"><a href="/guides">Guides</a> / ${name}</p>
  <h1>${title}</h1>
  <p class="lede">${lede}</p>
  <p class="muted" style="font-size:14px;margin-top:12px">Written by the GDN trade desk, Brisbane</p>
</div></section>
<section style="padding-bottom:72px"><div class="narrow">
  <div class="prose">${body}</div>
  ${faq.length ? `<h2 class="h2" style="font-size:26px;margin:48px 0 8px">Common questions</h2>${faqHtml(faq)}` : ''}
  <p class="muted" style="font-size:13.5px;margin-top:36px">This guide is general information based on our own experience. It is not legal, financial or compliance advice.</p>
</div></section>
${closingCta()}`,
    }),
  };
};

const billOfLading = article({
  slug: 'verify-bill-of-lading',
  name: 'Verify a bill of lading',
  title: 'How to verify a bill of lading before you pay',
  description: 'A step-by-step way to check a bill of lading before money moves: the carrier, the vessel, the dates, and how to compare it with the rest of the pack.',
  lede: 'A bill of lading can look perfect and still be worthless. Here is how we check one before money moves.',
  body: `
<p>A bill of lading does three jobs: it is a receipt for the goods, evidence of the contract of carriage and, in its negotiable form, a document of title. Because holding it can mean controlling the cargo, it is also one of the most commonly forged documents in trade.</p>
<p>No single check proves that a B/L is genuine. What works is a series of checks that a forger would have to get right all at once.</p>
<h2>1. Read it for what it must say</h2>
<p>Start with the basics. A proper B/L names the carrier and is signed by the carrier, the master or a named agent acting for one of them, and it says which. It shows the port of loading and port of discharge, and it shows that the goods are on board, either pre-printed or with a dated on-board notation. Under a letter of credit, UCP 600 article 20 sets out these requirements.</p>
<p>If you cannot tell who the carrier is, or who signed and in what capacity, stop there and ask.</p>
<h2>2. Confirm with the carrier, independently</h2>
<p>This is the check that matters most. Find the shipping line's contact details yourself, from its official website, not from the document or from anyone connected with the deal. Give them the B/L number and ask them to confirm that it exists, along with the shipper, consignee, vessel and quantity.</p>
<p>Many lines have online tracking. Use the tracking page you reached through the line's own site. Forgers have used lookalike websites and phone numbers, so never follow a link provided in the deal correspondence.</p>
<h2>3. Check the vessel</h2>
<ul>
<li>Run the IMO number through our <a href="/tools/imo-number-checker">IMO checker</a>. If it fails, the number is wrong.</li>
<li>Look the number up in the IMO's GISIS database or on Equasis. Does the ship's name, type and size fit the cargo?</li>
<li>Check an AIS tracker. Was the ship at the port of loading on the on-board date?</li>
</ul>
<p>We have seen a vessel named on a B/L that was thousands of miles away on the date it was supposedly loading. Five minutes on a tracker found it.</p>
<h2>4. Check the containers</h2>
<p>For containerised cargo, run each number through our <a href="/tools/container-number-checker">container checker</a>, then track the containers on the carrier's site. Compare the list against the packing list, and check the seal numbers too.</p>
<h2>5. Check the dates make sense</h2>
<ul>
<li>A shipped B/L cannot be issued before the goods were on board.</li>
<li>Under a letter of credit, the on-board date must not be after the latest shipment date.</li>
<li>Documents that refer to the B/L should not be dated before it, unless there is a reason.</li>
</ul>
<h2>6. Compare it with the rest of the pack</h2>
<p>This is the principle behind everything we do: read across, not down. The shipper should match the seller on the invoice. The quantity should match the invoice and the packing list. The consignee and notify party should make sense against the contract.</p>
<p>An experienced eye does this in an afternoon. <a href="/try">Gideon does it in minutes</a>, and it tells you which of the checks above to do yourself.</p>
<div class="note"><strong>If something does not add up,</strong> do not confront the other party first, because that only improves the next forgery. Hold the payment, contact the carrier directly, and consider reporting it to the ICC International Maritime Bureau.</div>`,
  faq: [
    ['Can I verify a bill of lading online?', 'Partly. Many carriers offer tracking by B/L or container number, which is a useful start. Reach the page through the carrier\'s official website, and call them if the amounts are significant.'],
    ['What is the difference between an original and a copy B/L?', 'A negotiable original is what can transfer control of the cargo. A copy is for information only. Before paying against documents, know which you are getting, and how many originals were issued.'],
  ],
});

const mustMatch = article({
  slug: 'documents-that-must-match',
  name: 'Documents that must match',
  title: 'Commercial invoice, packing list and bill of lading: what must match',
  description: 'A field-by-field checklist of what should agree across a commercial invoice, packing list and bill of lading, and which differences are normal.',
  lede: 'A field-by-field checklist of what should agree across the three core shipping documents, and which differences are normal.',
  body: `
<p>Mismatches between these three documents are one of the most common reasons shipments get held, and presentations get refused. The good news is that this is checkable before anyone else sees the paperwork.</p>
<h2>The checklist</h2>
<table>
<tr><th>Field</th><th>Invoice</th><th>Packing list</th><th>B/L</th><th>Should it match?</th></tr>
<tr><td>Seller / shipper</td><td>Seller</td><td>Seller</td><td>Shipper</td><td>Yes, normally the same legal name. If the shipper differs, ask why.</td></tr>
<tr><td>Buyer / consignee</td><td>Buyer</td><td>Buyer</td><td>Consignee</td><td>Usually. A B/L "to order" is normal under a letter of credit.</td></tr>
<tr><td>Goods description</td><td>Full</td><td>Full</td><td>May be general</td><td>Must not conflict. A B/L can use a more general description.</td></tr>
<tr><td>Net quantity</td><td>Yes</td><td>Yes</td><td>Often</td><td>Yes, exactly, or within the contract tolerance.</td></tr>
<tr><td>Gross weight</td><td>Sometimes</td><td>Yes</td><td>Yes</td><td>Yes.</td></tr>
<tr><td>Packages</td><td>Sometimes</td><td>Yes</td><td>Yes</td><td>Yes.</td></tr>
<tr><td>Container and seal numbers</td><td>Sometimes</td><td>Yes</td><td>Yes</td><td>Yes, every one.</td></tr>
<tr><td>Ports</td><td>Yes</td><td>Sometimes</td><td>Yes</td><td>Yes.</td></tr>
<tr><td>Vessel and voyage</td><td>Sometimes</td><td>Sometimes</td><td>Yes</td><td>Yes.</td></tr>
<tr><td>Invoice number</td><td>Yes</td><td>Yes</td><td>Sometimes</td><td>Yes, wherever it is quoted.</td></tr>
</table>
<h2>Differences that are normal</h2>
<ul>
<li><strong>Dates.</strong> The invoice date and the B/L date are often different, and that is fine. What matters is that the sequence makes sense.</li>
<li><strong>Consignee "to order".</strong> Common with letters of credit, because the bank wants control of the goods.</li>
<li><strong>Address differences.</strong> Under UCP 600 article 14, addresses need not match exactly, provided they are in the same country.</li>
<li><strong>A general goods description on the B/L,</strong> provided it does not conflict with the invoice.</li>
</ul>
<h2>Differences that are not</h2>
<ul>
<li><strong>A near-identical company name,</strong> such as "Meridian Commodities Pte Ltd" against "Meridian Commodity Trading Pte Ltd". It could be a slip, a related company or an impersonation. Each means something different, so find out which.</li>
<li><strong>Quantity that does not add up,</strong> including quantity times unit price not matching the invoice total.</li>
<li><strong>An invoice shipment date after the on-board date</strong> on the B/L, or a B/L issued before loading.</li>
<li><strong>A bank account in another company's name,</strong> with no clear reason.</li>
</ul>
<h2>See a worked example</h2>
<p>Our <a href="/sample-report">sample report</a> shows three planted errors found across these three documents. To check your own, <a href="/try">run your pack through Gideon</a>. Your three free queries cover a three-document pack.</p>`,
  faq: [
    ['Do the invoice and packing list need the same date?', 'Not necessarily, though they are usually issued close together. What matters is that each date makes sense against the shipment.'],
    ['Does the bill of lading need to show the invoice number?', 'Not usually, unless your letter of credit or contract requires it. If it is quoted, it must be correct.'],
  ],
});

const lcDiscrepancies = article({
  slug: 'letter-of-credit-discrepancies',
  name: 'L/C discrepancies',
  title: 'Letter of credit discrepancies: why banks refuse documents',
  description: 'The most common reasons documents get refused under a letter of credit, how UCP 600 treats them, and how to catch them before presenting.',
  lede: 'Why documents get refused under a letter of credit, how UCP 600 treats it, and how to catch problems before you present.',
  body: `
<p>A letter of credit pays against documents, not goods. Banks examine the documents on their face, so a small discrepancy can stop or delay payment, however well the actual shipment went. Most of these can be caught before presentation.</p>
<h2>The rule behind it: strict compliance, not identical wording</h2>
<p>Under UCP 600 article 14, data in a document need not be identical to the data in the credit or in other documents, but it must not conflict. So a difference is not automatically a discrepancy. A contradiction is.</p>
<p>The nominated and issuing banks each have up to five banking days after presentation to decide whether the documents comply (article 14b). If they refuse, they must give a single notice stating each discrepancy (article 16).</p>
<h2>Common reasons for refusal</h2>
<h3>Late shipment or late presentation</h3>
<p>The on-board date must not be after the latest shipment date. Separately, if the credit calls for transport documents, presentation must generally happen within 21 calendar days after shipment, and never after the credit expires (article 14c). People often watch the first deadline and miss the second.</p>
<h3>Invoice problems</h3>
<p>Under article 18, the invoice must appear to be issued by the beneficiary and made out to the applicant, in the same currency as the credit, and its goods description must correspond with the one in the credit. A description that has been shortened or changed so that it no longer corresponds is a classic reason for refusal, so the safest course is to copy it exactly. Other documents may describe the goods in general terms, as long as that does not conflict (article 14e).</p>
<h3>Quantity and amount out of tolerance</h3>
<p>Article 30 allows 10% either way on an amount, quantity or unit price described with "about" or "approximately". Otherwise, a 5% tolerance on the quantity of goods is allowed, provided the credit does not state the quantity as a number of packing units or individual items, and the total drawn does not exceed the credit amount.</p>
<h3>Bill of lading issues</h3>
<p>Under article 20, the B/L must name the carrier, be signed by the carrier, the master or a named agent, show the on-board notation, and show the ports the credit specifies. Claused or "dirty" bills, with notes about damaged goods, are generally not acceptable (article 27).</p>
<h3>Names that do not agree</h3>
<p>The beneficiary's name on the documents should not conflict with the credit. Near-identical but different legal names are the kind of thing an examiner picks up, and rightly.</p>
<h3>Missing documents, or the wrong number of originals</h3>
<p>Every document the credit asks for must be there, in the number of originals and copies stated, issued by whoever the credit specifies.</p>
<h2>How to catch them first</h2>
<ol>
<li>Read the credit line by line and list every document and condition.</li>
<li>Check each document against the credit.</li>
<li>Check the documents against each other, because that is where conflicts hide.</li>
<li>Work out your last date for presentation, and present well before it, leaving time to fix errors.</li>
</ol>
<p>Steps 2 and 3 are the tedious ones. <a href="/try">Gideon does much of that in minutes</a> by comparing every field across the pack, including checking the on-board date against the latest shipment date. Your own document checker or bank remains the final word, so treat it as a first pass.</p>
<div class="note">UCP 600 is published by the International Chamber of Commerce, and your credit must say that it applies. This guide is a plain-language summary. Always check the credit's own terms, which can change these defaults.</div>`,
  faq: [
    ['What happens if the bank finds a discrepancy?', 'It can refuse the documents, or approach the applicant for a waiver. Refused documents can often be corrected and presented again if time remains before expiry.'],
    ['How long does a bank have to check documents?', 'Up to five banking days following the day of presentation, under UCP 600 article 14b.'],
    ['What is the 21-day rule?', 'If the credit calls for transport documents and does not state another period, they must be presented within 21 calendar days after shipment, and in any case before the credit expires.'],
  ],
});

const redFlags = article({
  slug: 'commodity-deal-red-flags',
  name: 'Commodity deal red flags',
  title: 'Commodity deal red flags: how to spot a bad offer',
  description: 'Practical warning signs in EN590, sugar and other commodity offers, from a working trade desk: procedure drift, deposits before inspection, and paperwork that does not reconcile.',
  lede: 'What we actually look for in EN590, sugar and other commodity offers, including which warning signs people over-weight.',
  updated: '2026-11-15',
  body: `
<p>Commodity markets attract a lot of paperwork that goes nowhere: chains of intermediaries, recycled offers, and some outright fraud. Most of it can be screened out cheaply if you look at the right things.</p>
<h2>Signals that matter</h2>
<h3>Money before verifiable cargo</h3>
<p>A request for a deposit, a "verification fee", a tank storage fee or a similar payment before you have independently confirmed the product exists is the most common way people lose money. The question is simple: what can you verify before funds leave your control? If the answer is only more paperwork from the same people, stop. We go through the usual paperwork in <a href="/guides/proof-of-product-documents">proof of product documents</a>.</p>
<h3>Procedure drift</h3>
<p>This one costs the most. Compare the procedure agreed at the start, line by line, with what is being asked for now. Be most careful with conditions that appear <strong>after</strong> you have committed something irreversible, such as a deposit lodged, an instrument opened or a vessel chartered. If new requirements arrive only once you cannot easily walk away, the sequencing itself is the signal.</p>
<h3>Entities that appear once</h3>
<p>List every legal entity named anywhere in the pack. In a genuine deal, names recur: the seller on the offer is on the invoice, and the charterer on the charter party is on the vessel questionnaire. A company that surfaces once and is never mentioned again is the most reliable red flag we know of.</p>
<h3>Registration numbers that do not fit</h3>
<p>Company numbers have a shape that depends on the country. An Australian ACN has nine digits, for instance. Check the shape, then take the number to the actual registry and compare the name exactly. See our <a href="/tools/abn-acn-checker">ABN and ACN checker</a>.</p>
<h3>Dates that cannot be true</h3>
<p>An inspection certificate issued before the vessel berthed. A company incorporated after the contract it signed. Forged packs get assembled in whatever order is convenient, not the order events happened in.</p>
<h3>Refusal of a real-world test</h3>
<p>Ask for something only a real party can provide: a video call with the named signatory, a visit to the tank, or a call to a registered office number you found yourself. Genuine counterparties find this mildly tedious. Fraudulent ones produce reasons.</p>
<h2>Signals people over-weight</h2>
<ul>
<li><strong>Poor grammar or odd formatting.</strong> International trade is full of it. It proves nothing.</li>
<li><strong>Urgency.</strong> Real deals are urgent too.</li>
<li><strong>A professional website and clean documents.</strong> These are cheap. In our experience, the most convincing packs have been the fraudulent ones.</li>
</ul>
<h2>A note on price</h2>
<p>A price well below the market deserves an explanation. It is not proof of anything on its own, but ask what makes this seller able to sell below everyone else. "Direct from the refinery" is not an answer you can verify.</p>
<h2>What to do</h2>
<ol>
<li>Work through our <a href="/counterparty-verification-checklist">counterparty verification checklist</a>.</li>
<li><a href="/try">Run the pack through Gideon</a> to find what does not reconcile across the documents.</li>
<li>Verify the high-severity items yourself, using contact details you found independently.</li>
<li>If it looks fraudulent, do not tip them off. Contact whichever company is being impersonated, and consider the ICC International Maritime Bureau.</li>
</ol>`,
  faq: [
    ['Is a request for a deposit always a scam?', 'No. Deposits are normal in many real contracts. What matters is what you can independently verify before you pay, who holds the money, and on what terms it comes back.'],
    ['How can I verify a commodity seller?', 'Confirm the company at the official registry, contact it through details you found yourself, verify the named signatory, and independently confirm the product and storage location before any money moves.'],
  ],
});

const vessel = article({
  slug: 'check-a-vessel-is-real',
  name: 'Check a vessel is real',
  title: 'How to check a vessel is real',
  description: 'How to check that a ship exists and can do what the paperwork says: IMO numbers, GISIS, Equasis, AIS positions, and the mistakes to watch for.',
  lede: 'Vessel details are easy to fake and easy to check. It takes about ten minutes.',
  body: `
<h2>Step 1: Get the IMO number</h2>
<p>Ask for the IMO number, not only the name. Ships get renamed and many share a name, but the seven-digit IMO number stays with the hull for life. If someone cannot or will not give you one, that tells you something.</p>
<p>Run it through our <a href="/tools/imo-number-checker">IMO number checker</a>. If it fails the check digit, it is wrong. Passing only means it is well formed.</p>
<h2>Step 2: Look it up in an independent source</h2>
<ul>
<li><strong>IMO GISIS</strong> (gisis.imo.org) is the International Maritime Organization's own database. It is free to use with a public account.</li>
<li><strong>Equasis</strong> (equasis.org) is free to register for and shows the ship's particulars, its managers, and its inspection history.</li>
</ul>
<p>Check the name, flag, type, tonnage and year built against what you have been told.</p>
<h2>Step 3: Does it make sense for this cargo?</h2>
<p>This is where most impossible vessels fall down. A product tanker cannot carry bulk sugar. A small coaster cannot carry a 50,000-tonne cargo. Compare the vessel's deadweight tonnage to your quantity, and its type to your commodity.</p>
<h2>Step 4: Check where it is, and where it was</h2>
<p>AIS tracking services such as MarineTraffic and VesselFinder show a ship's reported position. Was it at the claimed port on the claimed date? Is it heading where you are being told?</p>
<p>AIS is not proof on its own, because signals can be switched off or spoofed. A long gap in a ship's track around a sensitive port deserves a question.</p>
<h2>Step 5: Confirm the commercial story</h2>
<ul>
<li>Who is the registered owner or manager in Equasis? Do they appear in your documents?</li>
<li>Is there a charter party? Does the charterer named there appear anywhere else in the pack?</li>
<li>Contact the owner or manager directly, using details from an independent source, and ask whether the vessel is really on this voyage.</li>
</ul>
<h2>Sanctions</h2>
<p>Check the vessel and its owner against sanctions lists that apply to you, and be cautious with frequent recent changes of name, flag or owner. Take advice if you are unsure. It is a specialist area with serious consequences.</p>
<div class="note">Gideon runs the IMO check and compares vessel details across every document in your pack, but it does not look vessels up in these databases. <a href="/try">Check a pack free</a>, then do steps 2 to 5 yourself on anything flagged.</div>`,
  faq: [
    ['What is the difference between an IMO number and an MMSI?', 'An IMO number stays with the ship for life. An MMSI is a radio identifier that can change, for example when a ship changes flag.'],
    ['Can a ship change its name?', 'Yes, and it happens often. That is why you should match on the IMO number and not the name.'],
  ],
});

const sblc = article({
  slug: 'verify-sblc-bank-guarantee',
  name: 'Check an SBLC or bank guarantee',
  title: 'How to check an SBLC or bank guarantee before you rely on it',
  description: 'How to check a standby letter of credit or bank guarantee before you ship or pay: how it should reach you, the issuing bank, the wording and the warning signs.',
  lede: 'A standby letter of credit is only worth what the issuing bank will pay against it. Here is how we check one before relying on it.',
  updated: '2026-11-15',
  body: `
<p>A standby letter of credit (SBLC) or bank guarantee is a bank's promise to pay you when you present a demand that meets its terms, usually a statement that the bank's customer has not done what the contract says. The bank pays on the documents, not on proof of what happened. It is only as good as three things: the bank that issued it, the wording, and the route by which it reached you. Each can be checked before you ship, pay or commit to anything.</p>
<h2>1. It must reach you through your own bank</h2>
<p>In cross-border trade, a guarantee or standby is normally issued bank to bank over SWIFT. The issuing bank sends an MT760 to your bank, your bank checks that the message is apparently authentic, and then it advises you. That check by your own bank is the one that counts. It tells you the instrument really came from the issuing bank. It does not tell you whether that bank is good for the money, which is step 3.</p>
<p>A PDF, a scan or a "SWIFT copy" sent by the applicant or a broker is not an instrument. It is a picture of one. Ask your bank three questions: has it received the message, from which bank, and was it authenticated? If your bank has nothing, you have nothing, whatever is in your inbox.</p>
<p>Guarantees are still issued on paper in some domestic markets. If you are given a paper original, have your own bank confirm it with the issuing bank, bank to bank.</p>
<h2>2. Know the message types</h2>
<ul>
<li><strong>MT760</strong> issues a guarantee or standby letter of credit.</li>
<li><strong>MT767</strong> amends one that has already been issued.</li>
<li><strong>MT799</strong> is a free-format message that banks use to write to each other. It is not the message used to issue a guarantee.</li>
</ul>
<p>Offers often describe an MT799 "pre-advice" or a "ready, willing and able" letter as if it were security. It is correspondence. Whether it commits the bank to anything depends entirely on its wording, and it usually does not. What you can draw on is the instrument itself.</p>
<h2>3. Check the issuing bank</h2>
<ul>
<li><strong>Is it a licensed bank?</strong> Look it up on the public register of the banking regulator in its home country, not on its own website.</li>
<li><strong>Does the BIC hold together?</strong> Run it through our <a href="/tools/swift-bic-checker">SWIFT/BIC checker</a>. That confirms the format and the country code, and nothing more.</li>
<li><strong>Would your bank take its risk?</strong> Ask your own bank whether it would accept that bank, and whether it would add its confirmation. A bank your bank will not deal with is a real answer.</li>
</ul>
<p>Be careful with names that resemble a well-known bank, and with issuers described as a "financial group", "trust" or "private bank" that do not appear on any regulator's register.</p>
<h2>4. Read the wording</h2>
<p>Most of the value is in the text. Go through it for these points.</p>
<ul>
<li><strong>Beneficiary.</strong> Your exact legal name, as on the contract.</li>
<li><strong>Applicant.</strong> If it is not your counterparty, find out who it is and why they are putting up security for someone else's deal.</li>
<li><strong>Amount and currency.</strong> Enough to cover what the contract says it secures.</li>
<li><strong>Expiry.</strong> The date, and the place where a demand must be presented. An instrument that expires before your counterparty's obligation falls due protects nothing.</li>
<li><strong>What you must present to be paid.</strong> A simple demand and a statement of default is normal. Be wary if payment depends on a document only the other side can give you, such as their signed acceptance.</li>
<li><strong>The rules.</strong> Standbys are usually subject to ISP98 or UCP 600, and demand guarantees to URDG 758. If no rules are named, find out which law governs it. It should be irrevocable. Check whether it is transferable if you need to pass it on.</li>
<li><strong>The contract reference.</strong> It should identify the deal you are actually doing.</li>
</ul>
<h2>5. Compare it with the contract</h2>
<p>Put the instrument next to the contract and read across: names, amounts, dates, the contract number, the goods, the trigger for a claim. A guarantee that is genuine but secures a slightly different company, or expires a week before delivery, fails you just as badly as a forged one. The same habit applies to documentary credits, which we cover in <a href="/guides/letter-of-credit-discrepancies">letter of credit discrepancies</a>.</p>
<p><a href="/try">Gideon does this read-across in minutes</a> and lists what does not reconcile. It does not contact banks and cannot see SWIFT traffic, so the check with your own bank in step 1 is still yours to do.</p>
<h2>Warning signs</h2>
<ul>
<li><strong>"Leased", "monetised", "fresh cut" or "seasoned" instruments,</strong> or a "provider" with no connection to the deal who will supply a guarantee for a fee.</li>
<li><strong>Fees before your bank has received anything:</strong> to "issue", "transmit" or "block funds".</li>
<li><strong>Verification only through contacts the other side gives you,</strong> such as a bank officer's mobile number or a private email address.</li>
<li><strong>Pressure to act on a copy</strong> while the "real" message is said to be on its way.</li>
<li><strong>An issuer you cannot find on a regulator's register.</strong></li>
</ul>
<p>The US Securities and Exchange Commission's investor alert <a href="https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-alerts/investor-57" rel="noopener">"Prime Bank" Investments Are Scams</a> names standby letters of credit and bank guarantees among the official-sounding terms these schemes use.</p>
<div class="note"><strong>If your bank has not received it, you have nothing.</strong> Do not ship, pay or release documents against a copy. Ask your bank to confirm receipt in writing first.</div>`,
  faq: [
    ['What is the difference between an SBLC and a bank guarantee?', 'In practice they do the same job: the bank pays if its customer does not perform. A standby letter of credit is usually issued subject to ISP98 or UCP 600, and a demand guarantee subject to URDG 758. The wording matters more than the name.'],
    ['Can I verify an SBLC from a copy?', 'No. A copy can only tell you what to ask about. Ask your own bank whether it has received the authenticated message from the issuing bank.'],
    ['Is an MT799 a bank guarantee?', 'No. An MT799 is a free-format message between banks. A guarantee or standby is issued by MT760.'],
  ],
});

const proofOfProduct = article({
  slug: 'proof-of-product-documents',
  name: 'Proof of product documents',
  title: 'Proof of product in fuel deals: what the documents really prove',
  description: 'What a tank storage receipt, dip test authorisation and inspection report actually prove in EN590 and jet fuel deals, and how to check each one.',
  lede: 'A tank storage receipt, a dip test authorisation and an inspection report each prove less than they appear to. Here is how we test them.',
  updated: '2026-11-15',
  body: `
<p>Before paying for fuel that is said to be sitting in a tank, buyers are usually sent "proof of product": a tank storage receipt (TSR), an authority to verify (ATV) or dip test authorisation (DTA), and an inspection report. Each proves less than it appears to, and each is easy to produce on a laptop. Their real use is to tell you what to go and confirm.</p>
<h2>What usually arrives</h2>
<div class="table-scroll"><table>
<thead><tr><th>Document</th><th>What it claims</th><th>Who can actually confirm it</th></tr></thead>
<tbody>
<tr><td>Tank storage receipt</td><td>A named company holds a quantity of product in named tanks at a terminal.</td><td>The terminal operator, and only to someone the tank holder has authorised.</td></tr>
<tr><td>Dip test authorisation, or authority to verify</td><td>You may send an inspector to gauge and sample the tank.</td><td>The terminal, by letting your inspector in.</td></tr>
<tr><td>Inspection report (quantity and quality)</td><td>An inspection company measured and tested the product on a stated date.</td><td>The inspection company's issuing office.</td></tr>
<tr><td>Injection or tank-to-tank transfer report</td><td>Product was moved into, or between, tanks.</td><td>The terminal.</td></tr>
</tbody>
</table></div>
<p>None of these, on its own, shows that the seller owns the product or that it will still be there when you pay.</p>
<h2>1. Establish who controls the tank</h2>
<p>Two parties matter: the terminal operator, which owns and runs the tanks, and the tank holder, which rents the capacity and can instruct the terminal about the product in it. The holder is not always the owner of the product. Your seller should be the holder, or the owner with the holder's cooperation, or should be able to show in writing how the product passes from the owner to them and then to you.</p>
<p>If the name on the storage receipt is not your seller, ask for that chain in writing. A company that appears on one document and nowhere else in the pack is the pattern we describe in <a href="/guides/commodity-deal-red-flags">commodity deal red flags</a>.</p>
<h2>2. Confirm with the terminal, independently</h2>
<p>Find the terminal's contact details yourself, from its official website. Do not use the phone number, email address or web link printed on the receipt.</p>
<p>Expect the terminal to refuse to discuss a customer's stock with a stranger. That is normal and proves nothing either way. The useful test is whether the tank holder will instruct the terminal to confirm the product to you, or to admit your inspector. A genuine holder can usually arrange that. Someone with no connection to the tank cannot. Access shows who can instruct the terminal. It does not show who owns the product, so you still need the chain of title from step 1.</p>
<p>Fake terminal websites are a known problem. In Rotterdam, the Port Authority and the Dutch tank storage association VOTOB run a task force against "storage spoofing", and publish lists of fake and genuine terminal websites at storagespoofing.nl.</p>
<h2>3. Send your own inspector</h2>
<p>A dip test is a physical measurement of the tank, usually with samples taken for analysis. It only means something if the inspector is one you appointed and paid, and the terminal let them in on the tank holder's instruction.</p>
<p>A report the seller commissioned tells you what was in a tank on the day of the inspection. Check the date, the tank numbers, and who ordered it.</p>
<h2>4. Confirm the inspection report with the company that issued it</h2>
<p>Go to the inspection company's own website and contact the office named on the report, or use the company's own document verification service if it has one. Give the report number and ask whether they issued it, for whom, and with those results.</p>
<p>Be careful with QR codes and links printed on the document. Check the web address they open. A forged report can point to a forged verification page.</p>
<h2>5. Read across the documents</h2>
<ul>
<li>The same tank numbers in every document.</li>
<li>A quantity the tanks could hold, where the capacity is stated or you can find it.</li>
<li>Dates in an order that could have happened: stored before inspected, inspected before offered.</li>
<li>Company names and registration numbers identical everywhere, not nearly identical.</li>
<li>Product grade and specification matching the offer and the contract.</li>
</ul>
<p>For the companies named, work through our <a href="/counterparty-verification-checklist">counterparty verification checklist</a>.</p>
<h2>Paying before you have access</h2>
<p>Paying your own inspector for a dip test is a normal cost. Paying the seller, or a company the seller nominates, for storage extensions, "tank fees" or the authorisation itself before you have had any independent access is a different thing. We cover that in <a href="/guides/commodity-deal-red-flags">commodity deal red flags</a>.</p>
<div class="note">Gideon compares tank numbers, quantities, dates and company names across the documents in your pack and lists what does not reconcile. It does not contact terminals or inspection companies. <a href="/try">Check a pack free</a>, then do steps 2 to 4 yourself.</div>`,
  faq: [
    ['Is a tank storage receipt proof that the product exists?', 'No. It is a statement that can be confirmed or not. Only the terminal can confirm it, and normally only with the tank holder\'s authority.'],
    ['What is a dip test?', 'A physical measurement of the product in a storage tank, usually with samples taken for laboratory analysis. It should be done by an independent inspector you appointed.'],
    ['Should the buyer pay for the dip test?', 'Paying your own inspector is normal. Be careful about paying the seller or its nominee for access, storage or authorisation before you have been able to check anything independently.'],
  ],
});

// The desk's original checklist, carried over word for word from the old page.
const oldChecklist = await readFile(join(here, '../content/checklist.html'), 'utf8');
const checklist = article({
  path: '/counterparty-verification-checklist',
  name: 'Counterparty checklist',
  title: 'Counterparty verification checklist for commodity trade',
  description: 'The eight cross-checks a working trade desk runs before wiring a deposit, and why the tell is almost never inside any single document.',
  lede: 'What to cross-check before you wire a deposit, and why the tell is almost never inside any single document.',
  body: oldChecklist,
});

const LIST = [checklist, billOfLading, mustMatch, lcDiscrepancies, redFlags, vessel, sblc, proofOfProduct];

const hub = {
  path: '/guides',
  updated: '2026-11-15',
  html: page({
    path: '/guides',
    title: 'Trade Document Guides from a Working Desk · Gideon',
    description: 'Practical guides on checking bills of lading, letters of credit, bank guarantees, proof of product, vessels and commodity counterparties, written by the GDN trade desk.',
    current: '/guides',
    schema: [breadcrumbSchema([['Home', '/'], ['Guides', '/guides']])],
    body: `
<section class="page-head"><div class="wrap">
  <div class="eyebrow">Guides</div>
  <h1>What we check, and how</h1>
  <p class="lede" style="max-width:40em">Written by the GDN trade desk, from our own experience. No invented statistics.</p>
</div></section>
<section style="padding-bottom:72px"><div class="wrap"><div class="grid-2">
  ${LIST.map((a) => `<a class="card" href="${a.path}"><h3>${a.name}</h3><p>${a.lede}</p></a>`).join('')}
  <a class="card" href="/sample-report"><h3>Sample report</h3><p>See exactly what a Gideon report looks like, on a fictional pack with planted errors.</p></a>
</div></div></section>
${closingCta()}`,
  }),
};

export default [hub, ...LIST];
