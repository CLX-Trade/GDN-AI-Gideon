// Monthly and annual toggle, and what to say when someone comes back from Checkout.
const monthly = document.getElementById('bill-m');
const annual = document.getElementById('bill-a');

function setBilling(isAnnual) {
  monthly.setAttribute('aria-pressed', String(!isAnnual));
  annual.setAttribute('aria-pressed', String(isAnnual));
  document.querySelectorAll('[data-m]').forEach((el) => { el.hidden = isAnnual; });
  document.querySelectorAll('[data-a]').forEach((el) => { el.hidden = !isAnnual; });
  document.querySelectorAll('[data-monthly]').forEach((btn) => {
    btn.setAttribute('data-checkout', btn.getAttribute(isAnnual ? 'data-annual' : 'data-monthly'));
  });
}
monthly.addEventListener('click', () => setBilling(false));
annual.addEventListener('click', () => setBilling(true));

const state = new URLSearchParams(location.search).get('checkout');
const note = document.getElementById('checkout-note');
if (state === 'canceled') note.textContent = 'Checkout was cancelled and you have not been charged. Your free queries are still here if you want to try Gideon first.';
if (state === 'unpaid') note.textContent = 'That payment did not complete, and you have not been charged.';
