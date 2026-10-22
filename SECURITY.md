# Security

## Reporting a vulnerability

Please open a private security advisory on GitHub (Security → Advisories → New draft) instead of a public issue. Include steps to reproduce and the version or commit you tested.

## How Endurance is meant to run

Endurance is a single-user app for your own computer. It has no sign-in: it listens on `127.0.0.1` only (`npm run dev`, `npm start`, and the Docker port mapping all bind to loopback), so nothing else on your network can reach it. Don't expose it to the internet. If you want it on another device, put it behind something that authenticates you first (Tailscale, Cloudflare Access, an auth proxy) and add that host name to `ALLOWED_HOSTS`.

## What it protects against

| Threat | Protection |
| --- | --- |
| Another device on your Wi-Fi opens the app | Bound to 127.0.0.1 only |
| A website you visit sends requests to your local app (CSRF) | `src/proxy.ts` rejects cross-site writes using `Origin` and `Sec-Fetch-Site` |
| DNS rebinding | Requests are refused unless the `Host` is loopback, `APP_URL`, or listed in `ALLOWED_HOSTS` |
| Someone pushes their own Kite login into your app | Random `state` in a short-lived HttpOnly cookie, checked on the callback |
| Prompt injection through broker data | The assistant's tools are read-only and return only portfolio figures; answers render as plain text with no links, images or HTML |
| XSS and clickjacking | Strict nonce-based CSP, `frame-ancestors 'none'`, `nosniff` |
| Leaked secrets in git | Only `.env.example` is tracked; CI runs gitleaks on every push and pull request |
| Vulnerable dependencies | CI fails on unreviewed high or critical advisories; Dependabot opens weekly updates |

## Secrets and data on disk

| What | Where | Notes |
| --- | --- | --- |
| Kite API key and secret, AI key | `.env` | Never committed. Readable by anyone with access to your user account, like any config file. |
| Today's Kite access token | `.data/kite-session.json` | File mode 600. Expires about 6 AM IST the next morning; **Log out of Kite** on the Setup page revokes it at Zerodha. |
| Portfolio snapshots and chats | `.data/` | File mode 600. Delete the folder to remove everything. |

## If a key leaks

- **Kite API secret**: regenerate it in the [Kite developer console](https://developers.kite.trade/apps) and update `.env`. Removing a leaked value from git history does not undo the exposure; rotation does.
- **AI key**: revoke it in your provider's console and put the new one in `.env`.

## Scope

Endurance is read-only towards Zerodha: `src/lib/kite/client.ts` calls only the session, profile, holdings, mutual fund holdings, positions and margins endpoints. Changes that add order placement are out of scope for this project.
