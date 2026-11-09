// Runs the free checker on each tools page. Everything happens on this device: no
// request is made, which is the privacy promise on those pages.
import { checkImo, checkContainer, checkIban, checkBic, checkLei, checkAbn, checkAcn } from './checks.js';

const CHECKS = { imo: checkImo, container: checkContainer, iban: checkIban, bic: checkBic, lei: checkLei, abn: checkAbn, acn: checkAcn };

document.querySelectorAll('form[data-tool]').forEach((form) => {
  const kind = form.getAttribute('data-tool');
  const input = form.querySelector('input');
  const out = form.parentElement.querySelector('.tool-result');
  const passLine = form.getAttribute('data-pass');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = input.value.trim();
    if (!value) return;
    const r = CHECKS[kind](value);
    out.className = `tool-result show ${r.valid ? 'pass' : 'fail'}`;
    out.textContent = '';
    const head = document.createElement('b');
    head.textContent = r.valid ? (passLine || 'Passes the check.') : 'Fails the check.';
    const body = document.createElement('span');
    body.textContent = r.reason;
    out.append(head, body);
    if (window.Gideon) window.Gideon.track('tool_used', { tool: kind, valid: r.valid });
  });
});
