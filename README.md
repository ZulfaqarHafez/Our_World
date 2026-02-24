# Our Little World 💕

A private couple's web app for Zul & Wendy.

## Features

- **Date Log** — Track all your dates with photos, mood, journal entries
- **Scoreboard** — Log games and keep a competitive scorecard
- **Study Buddy** — AI-powered RAG chatbot for study notes (upload PDFs, ask questions)

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Framer Motion
- **Backend**: Express (serverless on Vercel)
- **Database**: Supabase (PostgreSQL + pgvector + Auth + Storage)
- **AI**: OpenAI (text-embedding-3-small, gpt-4o-mini)

## Development

```sh
# Install dependencies
npm install

# Run dev server (frontend + API)
npm run dev
```

## Deployment

Deployed on [Vercel](https://vercel.com). Set these environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- `ALLOWED_ORIGINS`
