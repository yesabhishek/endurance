<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Endurance

Single-user, local Next.js app: Kite Connect + AI keys from `.env`, data in JSON files under `.data/`. No database, no accounts. See the README for setup and SECURITY.md for the threat model.

```bash
npm run dev     # http://localhost:3000 (binds 127.0.0.1)
npm run demo    # sample portfolio, data in .data/demo
npm test && npm run lint && npm run typecheck && npm run build
```

Rules worth keeping:

- The Kite client stays read-only. Never add order endpoints.
- Every assistant tool returns a `source` block (`ref`, `title`, `origin`, `asOf`); answers cite `[S#]`. Keep that contract when adding tools, and add the title to `src/lib/ai/tool-titles.ts`.
- Model output is rendered by `src/components/chat/markdown.tsx` only: no HTML, links or images.
- Paths built at runtime need `/*turbopackIgnore: true*/` or the build traces the whole project.
