# Project Lens

> Ask anything about your device. Answers from the actual manufacturer manual — cited to the exact page and section.

## What it does

- **Read** — Natural language Q&A with citations (e.g. *"Source: Page 34, Section 4.2"*)
- **Watch** — AI-generated video tutorial built from manual content, with voiceover
- **Talk** — Conversational voice assistant grounded strictly in the manual

## Products pre-loaded

| Product | Type | Manual chunks |
|---|---|---|
| Fujifilm X-E3 | Camera | 28 |
| Electrolux KODGH70TXA | Oven | 24 |
| Resideo T6 / T6R | Thermostat | 15 |
| Electrolux KODDP71XA | Oven | 15 |

Any product manual can also be added by uploading a PDF.

## Deploy to Vercel (5 minutes)

1. Fork this repo
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import this repo
3. Add environment variable: `ANTHROPIC_API_KEY` = your `sk-ant-api03-…` key
4. Click **Deploy** — you get a live HTTPS URL

## Local development

```bash
npm i -g vercel
vercel dev
```

Then open `http://localhost:3000`. The dev panel at the top of the product selector accepts your API key for local testing.

## Architecture

```
Browser (index.html)
  └── fetch POST /api/chat
        └── api/chat.js  (Vercel serverless function)
              └── Anthropic API  (key never leaves server)
```

Manual knowledge is pre-processed into semantic chunks stored in `index.html`. Retrieval uses keyword overlap scoring — no vector database needed for this scale. The Talk mode uses a hybrid context strategy: broad context loaded upfront, re-retrieved when topic shift is detected (keyword overlap < 25%).

## Tech

- **Frontend**: Vanilla JS, Web Speech API (mic + voice output), pdf.js for PDF upload
- **Backend**: Vercel serverless function (Node.js), rate limited at 30 req / 10 min per IP
- **AI**: Claude Sonnet via Anthropic API
