# Endurance web app

Next.js App Router app, background sync worker, Prisma (Postgres) and BullMQ (Redis).
See the [root README](../README.md) for setup, architecture and the security model.

## Commands

```bash
npm run dev            # app on http://localhost:3000
npm run worker         # background sync worker (separate terminal)
npm run seed:demo      # sample Zerodha portfolio for demo@endurance.local (dev databases only)
npm run db:migrate     # apply migrations to DATABASE_URL
npm run db:migrate:dev # create a new migration after editing prisma/schema.prisma
npm test               # unit tests
npm run lint
npm run typecheck
npm run audit:prod     # fails on unreviewed high/critical advisories
npm run build
```

## Where things live

| Path | What it does |
| --- | --- |
| `src/proxy.ts` | Host allowlist, cross-site write blocking, CSP nonce, security headers |
| `src/lib/db.ts` | `tenantDb(userId)`: the only way to touch user-owned tables |
| `src/lib/auth/` | Passwords (scrypt), server-side sessions, route guards |
| `src/lib/crypto.ts` | Versioned AES-256-GCM bound to row context; APP_SECRET rotation |
| `src/lib/credentials.ts` | Encrypted per-user Kite app and AI provider keys |
| `src/lib/kite/` | Read-only Kite Connect client, login, sync |
| `src/lib/securities.ts` | NSE sector reference data and fund/ETF classification |
| `src/lib/finance/portfolio.ts` | Sector allocation, concentration, limit breaches |
| `src/lib/finance/risk.ts` | The five risk-zone checks shared by the dashboard and chat |
| `src/lib/finance/forecast.ts` | Bucket mix, baseline assumptions and the seeded 20-year Monte Carlo |
| `src/lib/ai/` | Provider adapters, the read-only chat tools, and AI forecast assumptions |
| `src/components/dashboard/` | Dashboard charts: value trend, heatmap, risk zones and map, allocation, forecast |
| `src/components/chat/chat-dock.tsx` | The Ask panel docked beside every page, plus Ask buttons on charts |
| `src/worker/sync-worker.ts` | BullMQ worker entrypoint |
