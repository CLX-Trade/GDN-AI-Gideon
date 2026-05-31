import { kv } from '@vercel/kv';
import { parse } from 'cookie';

export default async function handler(req, res) {
  const cookies = parse(req.headers.cookie || '');
  const sid = cookies.gid_sid;
  const email = cookies.gid_email;
  let member = false, trialUsed = 0, pass = null;
  if (email) { try { member = (await kv.get('member:' + email.toLowerCase())) === true; } catch (e) {} }
if (email) { try { pass = (await kv.get('pass:' + email.toLowerCase())) || null; } catch (e) {} }
  if (sid) { try { trialUsed = (await kv.get('trial:' + sid)) || 0; } catch (e) {} }
  return res.status(200).json({
    member,
    trialUsed,
    trialLimit: parseInt(process.env.FREE_TRIAL_LIMIT || '3', 10),
    email: email || null,
    pass
  });
}
