// api/chat.js — Vercel serverless function
// Proxies requests to Anthropic API.
// The ANTHROPIC_API_KEY env var is set in the Vercel dashboard — never in code.

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

// ── Rate limiting (in-memory, resets on cold start) ────────────
const RATE_LIMIT_MAX = 30;          // requests per window
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;  // 10 minutes
const ipStore = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const rec = ipStore.get(ip);
  if (!rec || now - rec.windowStart > RATE_LIMIT_WINDOW_MS) {
    ipStore.set(ip, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }
  if (rec.count >= RATE_LIMIT_MAX) {
    const resetIn = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - rec.windowStart)) / 1000);
    return { allowed: false, resetIn };
  }
  rec.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - rec.count };
}

// ── CORS helper ────────────────────────────────────────────────
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ── Handler ────────────────────────────────────────────────────
export default async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limit by IP
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const rate = checkRateLimit(ip);
  if (!rate.allowed) {
    return res.status(429).json({
      error: `Too many requests. Please wait ${rate.resetIn} seconds.`
    });
  }

  // Parse body
  const { messages, system, maxTokens } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const safeMaxTokens = Math.min(parseInt(maxTokens) || 1200, 2000);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not set in environment');
    return res.status(500).json({ error: 'Server configuration error — API key not set.' });
  }

  try {
    const upstream = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: safeMaxTokens,
        system: system || undefined,
        messages
      })
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      console.error('Anthropic error:', data);
      return res.status(upstream.status).json({ error: data?.error?.message || 'API error' });
    }

    res.setHeader('X-RateLimit-Remaining', String(rate.remaining));
    return res.status(200).json({ text: data.content?.[0]?.text || '' });

  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(502).json({ error: 'Failed to reach AI service. Please try again.' });
  }
}
