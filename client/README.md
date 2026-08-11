# WorkPulse Connect Client

Official frontend for WorkPulse Connect (Feature 16). Lives in **`client/`**.

**Pulse Field** design system — tokens from `../context/ui-tokens.md`, screens adapted from `../context/designs/`.

## Run locally

1. Start the API on port **8000** (`cd ../api && npm run server`).
2. Copy `.env.example` → `.env.local` (defaults point at `http://localhost:8000`).
3. `npm install && npm run dev` → [http://localhost:3000](http://localhost:3000)

Auth uses JWT cookie (`credentials: "include"`) plus Bearer token stored after login for cross-origin reliability.

## Scripts

- `npm run dev` — Next.js dev server
- `npm run build` / `npm start` — production

## Deploy to Vercel

1. API is on Render: `https://workpulse-lbdp.onrender.com`
2. In Vercel: Import repo → **Root Directory = `client`**.
3. Set env:
   - `NEXT_PUBLIC_API_URL` = `https://workpulse-lbdp.onrender.com`
   - `NEXT_PUBLIC_SOCKET_URL` = same
4. Live frontend: `https://workpulse-omega.vercel.app`
5. On Render, set `CLIENT_URL` to that Vercel URL (Paystack callbacks + emails).

Full checklist: `../docs/deploy.md`.
