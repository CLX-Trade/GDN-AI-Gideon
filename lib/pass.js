// Meeting Room passes. A pass opens a 24-hour window when first used.
import { store } from './deps.js';

export const DAY_MS = 24 * 60 * 60 * 1000;

export async function readPass(email) {
  if (!email) return null;
  return (await store().get(`pass:${email}`)) || null;
}

export async function writePass(email, pass) {
  await store().set(`pass:${email}`, pass);
}

export async function activePass(email) {
  try {
    const pass = await readPass(email);
    return pass && pass.startedAt && Date.now() < pass.startedAt + DAY_MS ? pass : null;
  } catch (e) {
    console.error('pass lookup failed', e && e.message);
    return null;
  }
}
