# Setup Checklist

Maintained alongside the project. Mark items `[x]` when complete — do not delete entries.

---

## Summary

- [x] OpenAI API Key — needed for US-01: Secure Server-Side OpenAI API Route

---

## OpenAI API Key

**Needed for**: US-01 — Secure Server-Side OpenAI API Route  
**What it is**: A secret key that authenticates server-side requests to OpenAI's chat completions API. It is read exclusively from `process.env` and never sent to the browser.

### Setup Steps

1. Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys) and sign in (or create an account).
2. Click **Create new secret key**, give it a name (e.g. `educonnect-dev`), and copy the key immediately — it is only shown once.
3. Ensure your account has access to `gpt-4o-mini` (available on any paid tier).
4. Add the key to your local environment file (see below).

### Add to your `.env.local` file

```
OPENAI_API_KEY=sk-...your_key_here
```

> **Important**: `.env.local` is git-ignored. Never commit this file or paste the key anywhere in the codebase.

### Checklist

- [x] OpenAI account created / signed in
- [x] API key generated and copied
- [x] `OPENAI_API_KEY` added to `.env.local`
- [x] Verification: start the dev server (`npm run dev`) and POST to `/api/ai/lesson` with a valid auth token — you should receive a 200 response, not a 503

---
