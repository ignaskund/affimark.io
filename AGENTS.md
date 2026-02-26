# AffiMark - Agent Instructions

## Cursor Cloud specific instructions

### Architecture
- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind on port 3000
- **Backend**: Cloudflare Workers (Hono) via Wrangler on port 8787
- **Database**: Supabase (hosted, not local)

Standard dev commands are in `CLAUDE.md` (root, frontend, backend).

### Running the backend locally
Wrangler requires `--local --show-interactive-dev-session false` flags in non-interactive/CI environments. The AI binding is only available remotely and will show as "not supported" locally — this is expected and non-blocking.

```bash
cd backend && npx wrangler dev --port 8787 --local --show-interactive-dev-session false
```

### Running the frontend
```bash
cd frontend && npm run dev
```

The frontend proxies `/api/*` requests to `http://127.0.0.1:8787` via `next.config.js` rewrites, so both services must be running simultaneously.

### Environment files
- **Frontend**: Copy `frontend/.env.local.recommended` → `frontend/.env.local`
- **Backend**: Copy `backend/.env.local.recommended` → `backend/.dev.vars` (wrangler convention)

### ESLint
The frontend requires a `.eslintrc.json` file for `next lint` to work non-interactively. If missing, create it with `{"extends": "next/core-web-vitals"}`.

### Pre-existing issues
- Backend has TypeScript errors (run `npx tsc --noEmit` in `backend/`). These are pre-existing and do not block `wrangler dev`.
- Frontend lint (`npm run lint` in `frontend/`) reports unescaped entity warnings. These are pre-existing.

### Supabase
The app uses a hosted Supabase instance. No local database setup is needed. Credentials are in the `.env.local.recommended` files.
