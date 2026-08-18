/* Lab state sync — so Sean's verdicts follow him between phone and laptop.
 *
 * NOT an account system, deliberately. One person, one sync key, one blob. Sign-up,
 * password reset and sessions would be a real build for a review tool used by one
 * reviewer, and every one of those is a thing that can break on the morning he needs it.
 *
 * The key never reaches storage in the clear: the blob is named by a SHA-256 of it, so
 * a dump of the blob store does not hand anyone the key that opens it. That is the whole
 * of the security model and it is worth being blunt about — anyone holding the key can
 * read and write this state. The contents are design opinions about underlines, the URL
 * is public, and Sean chose this knowing both. Do not extend it to anything that matters
 * more without replacing the model rather than tightening it.
 */
import { getStore } from '@netlify/blobs';

const MAX = 256 * 1024;          // a verdict set is ~2KB; this is 100x headroom, not a limit to design against
const MIN_KEY = 8;

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json',
    'cache-control': 'no-store',       // a stale verdict set is worse than a slow one
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,PUT,OPTIONS',
    'access-control-allow-headers': 'content-type,x-lab-key',
  },
});

async function blobName(key) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('brg-lab:' + key));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export default async (req) => {
  if (req.method === 'OPTIONS') return json(204, {});

  const key = req.headers.get('x-lab-key') || '';
  if (key.length < MIN_KEY) return json(400, { error: `sync key must be at least ${MIN_KEY} characters` });

  // STRONG consistency, not the default. Netlify Blobs reads are eventually consistent
  // unless asked otherwise, and the very first round-trip proved it: PUT returned
  // {"ok":true,"savedAt":...} and the GET a second later returned state:null. The write
  // had happened; the read had not caught up. A sync tool whose read can miss its own
  // write is worse than no sync — it looks like the notes were eaten.
  const store = getStore({ name: 'brg-lab', consistency: 'strong' });
  const name = await blobName(key);

  if (req.method === 'GET') {
    const data = await store.get(name, { type: 'json' });
    // A key that has never been used is not an error — it is a new device, or a first save.
    return json(200, { state: data?.state ?? null, savedAt: data?.savedAt ?? null });
  }

  if (req.method === 'PUT') {
    const body = await req.text();
    if (body.length > MAX) return json(413, { error: 'state too large' });
    let state;
    try { state = JSON.parse(body); }
    catch { return json(400, { error: 'body must be JSON' }); }
    const savedAt = new Date().toISOString();
    await store.setJSON(name, { state, savedAt });
    return json(200, { ok: true, savedAt });
  }

  return json(405, { error: 'GET or PUT' });
};

export const config = { path: '/api/lab-state' };
