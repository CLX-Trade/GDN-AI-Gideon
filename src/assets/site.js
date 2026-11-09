// Runs on every page: analytics with consent, first-touch attribution, scroll reveals,
// and shared helpers exposed as window.Gideon for the page-specific scripts.
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  var GA_ID = 'G-GQ8KSQX46N';
  var ADS_ID = 'AW-18205283835';
  var ADS_PURCHASE = 'AW-18205283835/CgrjCMa9w7ccEPur-uhD';
  var CONSENT_KEY = 'gdn_consent';
  var REF_KEY = 'gdn_ref';
  // EEA, UK and Switzerland require opt-in. Elsewhere analytics is on by default,
  // disclosed in the privacy policy, with a one-click opt-out in the banner.
  var OPT_IN_REGIONS = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'GB', 'CH'];

  function read(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function write(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* private mode */ } }

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;

  var choice = read(CONSENT_KEY);
  gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'denied', wait_for_update: 400 });
  gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', region: OPT_IN_REGIONS });
  if (choice) setConsent(choice === 'granted');

  function setConsent(granted) {
    var v = granted ? 'granted' : 'denied';
    gtag('consent', 'update', { analytics_storage: v, ad_storage: v, ad_user_data: v, ad_personalization: 'denied' });
  }

  gtag('js', new Date());
  gtag('config', GA_ID);
  gtag('config', ADS_ID);
  var tag = document.createElement('script');
  tag.async = true;
  tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(tag);

  function track(name, params) {
    try { gtag('event', name, params || {}); } catch (e) { /* never break the page */ }
  }

  // First touch only: where this visitor originally came from.
  (function captureSource() {
    if (read(REF_KEY)) return;
    var p = new URLSearchParams(location.search);
    var source = p.get('utm_source');
    var value = '';
    if (source) value = [source, p.get('utm_medium'), p.get('utm_campaign')].filter(Boolean).join('/');
    else if (document.referrer) {
      try {
        var host = new URL(document.referrer).hostname.replace(/^www\./, '');
        if (host !== location.hostname.replace(/^www\./, '')) value = host;
      } catch (e) { /* ignore */ }
    }
    write(REF_KEY, value || 'direct');
  }());

  function source() { return read(REF_KEY) || 'direct'; }

  async function startCheckout(plan, email) {
    track('begin_checkout', { items: [{ item_id: plan }] });
    var res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: plan, email: email || undefined, ref: source() }),
    });
    var data = await res.json().catch(function () { return {}; });
    if (data.url) { location.href = data.url; return; }
    throw new Error(data.error || 'Checkout could not start. Please try again.');
  }

  function reportPurchase(params) {
    var value = parseFloat(params.get('v'));
    var id = params.get('tid');
    if (!id || !isFinite(value)) return;
    var key = 'gdn_conv_' + id;
    if (read(key)) return;
    write(key, '1');
    track('purchase', { transaction_id: id, value: value, currency: 'AUD', items: [{ item_id: params.get('welcome') }] });
    track('conversion', { send_to: ADS_PURCHASE, value: value, currency: 'AUD', transaction_id: id });
  }

  window.Gideon = { track: track, source: source, startCheckout: startCheckout, reportPurchase: reportPurchase };

  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  ready(function () {
    // Consent notice, once.
    if (!choice) {
      var box = document.createElement('div');
      box.className = 'consent';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-label', 'Cookies');
      box.innerHTML = 'We use analytics cookies to see how the site is used. Your documents are never part of this. <a href="/privacy">Privacy</a><div class="consent-row"><button class="btn btn-sm btn-ghost" data-c="denied">Decline</button><button class="btn btn-sm btn-primary" data-c="granted">Accept</button></div>';
      box.addEventListener('click', function (e) {
        var c = e.target && e.target.getAttribute && e.target.getAttribute('data-c');
        if (!c) return;
        write(CONSENT_KEY, c);
        setConsent(c === 'granted');
        box.remove();
      });
      document.body.appendChild(box);
    }

    // Reveal on scroll.
    var items = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) { if (entry.isIntersecting) { entry.target.classList.add('in'); io.unobserve(entry.target); } });
      }, { rootMargin: '0px 0px -8% 0px' });
      items.forEach(function (el) { io.observe(el); });
    } else {
      items.forEach(function (el) { el.classList.add('in'); });
    }

    // Close the mobile menu after a tap.
    var menu = document.querySelector('.nav-menu');
    if (menu) menu.addEventListener('click', function (e) { if (e.target.tagName === 'A') menu.removeAttribute('open'); });

    // Every enquiry form on the site.
    document.querySelectorAll('form[data-lead]').forEach(function (form) {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var msg = form.querySelector('.form-msg');
        var btn = form.querySelector('button[type=submit]');
        var body = Object.fromEntries(new FormData(form).entries());
        body.kind = form.getAttribute('data-lead');
        body.source = source();
        btn.disabled = true;
        try {
          var res = await fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          var data = await res.json().catch(function () { return {}; });
          if (!res.ok) throw new Error(data.error || 'That did not send.');
          msg.className = 'form-msg ok';
          msg.textContent = 'Thanks. A person at GDN will reply by email.';
          form.reset();
          track('generate_lead', { lead_type: body.kind });
        } catch (err) {
          msg.className = 'form-msg bad';
          msg.textContent = err.message;
        } finally {
          btn.disabled = false;
        }
      });
    });

    // Any button that starts a checkout.
    document.body.addEventListener('click', async function (e) {
      var el = e.target.closest && e.target.closest('[data-checkout]');
      if (!el) return;
      e.preventDefault();
      var original = el.textContent;
      var err = el.parentElement.querySelector('.plan-err');
      if (err) err.textContent = '';
      el.disabled = true;
      el.textContent = 'Opening secure checkout…';
      try {
        await startCheckout(el.getAttribute('data-checkout'));
      } catch (error) {
        el.disabled = false;
        el.textContent = original;
        if (err) err.textContent = error.message;
      }
    });
  });
}());
