# AI Music Studio — Vite + React + Tailwind Prototype

This repository is a beginner-friendly starter kit for an AI Lyrics Generator + AI Music Studio frontend with a minimal backend route for calling OpenAI. The audio processing in the Studio is mocked — replace with a real audio ML backend when ready.

## Features
- Vite + React + Tailwind frontend
- `/api/generate-lyrics` Express route that calls OpenAI GPT (requires OPENAI_API_KEY)
- Simple paywall & credits mock in the frontend
- Starter credits and subscription mock

## Setup
1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and paste your OpenAI key:

```
cp .env.example .env
# edit .env and add your real OPENAI_API_KEY
```

3. Start the dev server and the mock backend (server uses Node/Express):

```bash
# start vite dev server
npm run dev

# in another terminal (starts the API server)
npm run server
```

The frontend calls `http://localhost:3000/api/generate-lyrics` by default.

## Notes
- Payment/Stripe integration is mocked. See `server/stripe-placeholder.md` for where to add Stripe logic.
- The lyrics generator uses OpenAI; there is no key in the repo. Get a key from https://platform.openai.com and place it into `.env`.

## Deploy
Deploy the frontend with Vercel/Netlify and the server to a Node host (or combine into serverless functions).

---
Happy building!
