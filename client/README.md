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
