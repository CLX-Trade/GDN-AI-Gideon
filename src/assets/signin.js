// Requests a sign-in link, or finishes signing in when opened from one. The token is
// only spent when the person presses Continue, so mail scanners that pre-open links
// cannot use it up first.
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const token = params.get('token');

const INTROS = {
  pending: 'Your payment went through. Enter the email you used to pay and we will send you a link.',
};
if (INTROS[params.get('checkout')]) $('signin-intro').textContent = INTROS[params.get('checkout')];

$('signin-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('signin-msg');
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  msg.className = 'form-msg';
  msg.textContent = 'Sending…';
  try {
    const res = await fetch('/api/auth?action=login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: new FormData(e.target).get('email') }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'We could not send your link. Please try again.');
    msg.className = 'form-msg ok';
    msg.textContent = 'Check your inbox. The link works once and expires in 15 minutes.';
  } catch (err) {
    msg.className = 'form-msg bad';
    msg.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

if (token) {
  $('signin-request').hidden = true;
  $('signin-confirm').hidden = false;
  history.replaceState(null, '', '/signin');
  $('signin-go').addEventListener('click', async (e) => {
    const msg = $('signin-go-msg');
    e.target.disabled = true;
    msg.className = 'form-msg';
    msg.textContent = 'Signing you in…';
    try {
      const res = await fetch('/api/auth?action=verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'That link did not work. Please request a new one.');
      location.href = data.member ? '/app' : '/try';
    } catch (err) {
      msg.className = 'form-msg bad';
      msg.textContent = err.message;
      $('signin-request').hidden = false;
      e.target.disabled = false;
    }
  });
}
