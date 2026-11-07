# QR Menu agent guide

Read [README.md](README.md) before changing the frontend.

- This repository is a Vite/React static client. The Cloud backend, database,
  auth verification, price calculation, order approval, and report behavior
  belong to `../pos-cloud/`.
- Treat POS Cloud controller validation and response types as authoritative.
  Update both projects' API documentation when their contract changes.
- Preserve Firebase ID-token auth for profile/order/history routes. Never
  store Firebase private credentials or trust browser-provided prices.
- Keep table QR (`DINE_IN`) and restaurant directory delivery (`DELIVERY`)
  behavior distinct. Maintain route parsing and SPA fallback when adding URLs.
- Preserve visible API errors; do not make a failed request look successful or
  silently substitute an empty menu.
- Run `npm run lint` and `npm run build`. Do not claim Firebase/CORS or live
  order flow was tested unless it was exercised against configured services.
