# Mobilkod QR Menu

Standalone React frontend for restaurant QR menus. POS Cloud remains
responsible for serving menu data, verifying Firebase sign-in, accepting
orders, and reporting order status.

## Development

1. Copy `.env.example` to `.env.local`.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open `http://localhost:5173/<table-token>`.

The Vite development proxy forwards `/m/*` requests to `http://localhost:4000`.
Set `QR_API_PROXY_TARGET` if the local POS Cloud API uses a different address.

## Production (`qr.mobilkod.com`)

The production build uses `https://pos.mobilkod.com` as its API base URL from
`.env.production`. Run `npm run build` and host the generated `dist/` directory
on `qr.mobilkod.com`, with HTTPS and SPA fallback to `index.html` for paths
such as `/<table-token>`.

Set `QR_MENU_URL=https://qr.mobilkod.com` in the POS Cloud production
environment and restart/redeploy POS Cloud. This makes new table QR links point
to the React app and redirects old `/m/<token>` links there. POS Cloud enables
CORS for the configured QR menu origin only.

Add `qr.mobilkod.com` to Firebase Authentication's authorized domains. The
frontend is a static site; keep Firebase credentials in the menu API response
and never put server secrets in Vite environment variables.

Orders are sent to the restaurant for approval; this frontend does not process
online payments. Customers can open **Siparişlerim** on the same table QR link
to see their order status, estimated total, and the final total after POS
approval. The order list requires the same Google or Apple account used to
place the orders.
