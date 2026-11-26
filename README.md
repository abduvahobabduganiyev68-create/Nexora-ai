# NEXORA AI

NEXORA AI is a production-oriented, multi-model AI workspace built with Next.js, Supabase, PostgreSQL, and OpenRouter.

## Features

- Supabase email/password authentication
- Persistent conversations and messages
- Row Level Security for user-owned data
- Shared conversation context when switching models
- OpenRouter streaming chat
- Centralized model registry
- Responsive workspace UI
- Markdown and code rendering
- Memory, project, and usage database foundations

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Environment variables

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase browser-safe anon key
- `SUPABASE_SERVICE_ROLE_KEY`: Server-only service role key
- `OPENROUTER_API_KEY`: Server-only OpenRouter API key
- `NEXT_PUBLIC_APP_URL`: Public application URL

Never expose server-only keys through `NEXT_PUBLIC_*`.

## Supabase setup

1. Create a Supabase project.
2. Run `database/001_initial.sql` in the Supabase SQL editor.
3. Configure the Site URL and auth redirects in Supabase.
4. Add the public Supabase values to `.env.local`.

## OpenRouter setup

Create an OpenRouter API key and set `OPENROUTER_API_KEY` in `.env.local`. AI requests are made only from server routes. Models are declared in `lib/ai/models.ts`.

## Validation

```bash
npm run lint
npm run build
npm start
```
