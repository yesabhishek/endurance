# Endurance Web

Private local finance workspace built with Next.js App Router, shadcn/ui, Prisma Client, and SQLite.

## Local Setup

```bash
cp .env.example .env
npm install
npm run db:generate
npm run db:init
npm run dev
```

Open http://localhost:3000.

## Environment

- `DATABASE_URL`: SQLite URL. Default local path is `file:./dev.db`, resolved to `web/prisma/dev.db` by `db:init`.
- `APP_ENCRYPTION_KEY`: required before connecting Gmail.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`: Gmail OAuth.
- `KITE_MCP_URL`: read-only Kite MCP endpoint.
- `AI_GATEWAY_API_KEY`, `AI_MODEL`: optional Vercel AI Gateway settings. Without these, chat returns a deterministic local summary.

## Commands

```bash
npm run dev
npm run build
npm run lint
npm test
npm run db:init
```

`db:init` creates the SQLite tables expected by Prisma Client. The app keeps Gmail email persistence normalized-only: source IDs, headers, snippets, parsed values, and metadata; no raw email bodies.
