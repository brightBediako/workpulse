# Deploy WorkPulse Connect

Staging/production checklist for the **API** (`api/`) and **client** (`client/` on Vercel).

---

## Live production

| Piece | URL |
| ----- | --- |
| Frontend (Vercel) | https://workpulse-omega.vercel.app |
| API + Socket.IO (Render) | https://workpulse-lbdp.onrender.com |
| Health | https://workpulse-lbdp.onrender.com/healthz |
| Paystack webhook | https://workpulse-lbdp.onrender.com/api/orders/webhook |

Vercel hosts **only** the Next.js client. The Express API stays on Render.

### Required env (already documented below)

**Vercel (`client`):**

- `NEXT_PUBLIC_API_URL=https://workpulse-lbdp.onrender.com`
- `NEXT_PUBLIC_SOCKET_URL=https://workpulse-lbdp.onrender.com`

**Render (`api`):**

- `CLIENT_URL=https://workpulse-omega.vercel.app`
- `COOKIE_SECURE=true`
- `NODE_ENV=production`
- Plus `MONGO_URI`, `JWT_KEY`, `PAYSTACK_SECRET_KEY`, etc.

After changing `NEXT_PUBLIC_*` on Vercel, **redeploy** (they are inlined at build time).

---

## Architecture

| Piece | Default local | Typical host |
| ----- | ------------- | ------------ |
| API + Socket.IO | `http://localhost:8000` | Render (`workpulse-lbdp`) |
| Client (Next.js) | `http://localhost:3000` | Vercel (`workpulse-omega`) |
| MongoDB | local / Atlas | Atlas URI in `MONGO_URI` |

CORS allows `https://workpulse-omega.vercel.app`, `CLIENT_URL`, and `*.vercel.app`.

---

## 1. Deploy API first (required)

1. Root or service directory: `api/`
2. Start command: `npm start` (or `node server.js`) — no build step
3. Set env vars from the API table below
4. `NODE_ENV=production` and `COOKIE_SECURE=true` when the client is on another HTTPS origin
5. Confirm `GET https://<api-host>/healthz` → `{ "status": "ok" }`
6. Confirm Socket.IO on the same host (`/socket.io`)
7. Register Paystack webhook: `https://<api-host>/api/orders/webhook` (`charge.success`)

**Render free tier:** The API sleeps after inactivity (~50s cold start). Browsers may show `CORS request did not succeed` with status `(null)` while the service wakes — this is a network timeout, not a misconfigured allow-list. The client retries REST calls and Socket.IO reconnects with polling first. For production, use a paid Render plan or an uptime ping to `/healthz` every 10–14 minutes.

### Environment checklist (API)

Copy `api/.env.example` → `api/.env` (never commit secrets).

| Variable | Required | Notes |
| -------- | -------- | ----- |
| `PORT` | No | Default `8000` |
| `MONGO_URI` | Yes | Atlas connection string in production |
| `JWT_KEY` | Yes | Long random secret |
| `PAYSTACK_SECRET_KEY` | Yes for payments | Live or test secret key |
| `PAYSTACK_PUBLIC_KEY` | Optional | For future inline JS checkout |
| `PAYSTACK_CURRENCY` | No | Default `GHS` (amounts in pesewas) |
| `PLATFORM_FEE_PERCENT` | No | Default `10` |
| `COOKIE_SECURE` | Prod | `true` when HTTPS + cross-site cookies |
| `CLIENT_URL` | Yes | **Vercel client URL** (emails + Paystack callback `/orders/callback`) |
| `BCRYPT_SALT_ROUNDS` | No | Default `12` |
| `SOCKET_PATH` | No | Default `/socket.io` |
| `MAIL_SMTP_HOST` | Optional | e.g. `smtp.hostinger.com` |
| `MAIL_SMTP_PORT` | Optional | `465` (SSL) or `587` (TLS) |
| `MAIL_SMTP_USER` | Optional | SMTP login (usually same as mailbox) |
| `MAIL_SMTP_PASS` | Optional | Quote if password has `\`, `"`, or `#` |
| `MAIL_SMTP_ENCRYPTION` | Optional | Set `ssl` for port 465 |
| `MAIL_FROM` / `MAIL_FROM_NAME` | Optional | From header; welcome + reset emails |
| `MAIL_TO` | Optional | Default reply-to address |
| `EMAIL_SMTP_VERIFY` | No | Set `true` to verify SMTP before each send |

### VPS sketch

```bash
cd api
npm ci --omit=dev
# set .env
npm start
# or: pm2 start server.js --name workpulse-api
```

---

## 2. Deploy Client (Vercel)

### Project settings

| Setting | Value |
| ------- | ----- |
| Framework Preset | Next.js |
| **Root Directory** | `client` |
| Build Command | `npm run build` (default) |
| Output | Next.js (default) |
| Install Command | `npm install` (default) |
| Node.js | 20.x recommended |

`client/vercel.json` marks the app as Next.js. Prefer setting **Root Directory = `client`** in the Vercel dashboard when importing the monorepo.

### Environment variables (Vercel → Project → Settings → Environment Variables)

Set for **Production** (and Preview if the API allows `*.vercel.app`):

| Variable | Example | Notes |
| -------- | ------- | ----- |
| `NEXT_PUBLIC_API_URL` | `https://workpulse-lbdp.onrender.com` | No trailing slash. **Inlined at build time** — redeploy after changing. |
| `NEXT_PUBLIC_SOCKET_URL` | same as API URL | Optional; defaults to API URL |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | `pk_live_…` | Optional |

Local template: `client/.env.example` → `client/.env.local`.

### Deploy steps (dashboard)

1. Push this repo to GitHub/GitLab/Bitbucket
2. [vercel.com/new](https://vercel.com/new) → Import the repo
3. Set **Root Directory** to `client`
4. Add `NEXT_PUBLIC_API_URL` (and optional socket/Paystack keys)
5. Deploy
6. Copy the deployment URL → set API `CLIENT_URL` to that origin and restart the API
7. Open the Vercel URL → register/login → Discover

### Deploy steps (CLI)

```bash
cd client
npm i -g vercel   # once
vercel            # link project; set root if prompted
vercel env add NEXT_PUBLIC_API_URL
vercel --prod
```

### Auth note

Cross-origin cookies may be blocked. The client stores the JWT and sends `Authorization: Bearer` after login (`credentials: "include"` still enabled for same-site setups).

### Custom domain

1. Add domain in Vercel → Domains
2. Add the exact origin to API `allowedOrigins` in `api/app/app.js` (or rely on an existing pattern)
3. Update API `CLIENT_URL` to the custom domain
4. Redeploy client if env URLs changed

---

## Smoke test after deploy

1. `GET /healthz` on the API
2. Register + login from the Vercel client
3. `GET /api/categories` and Discover gigs
4. Paystack test payment → webhook or `/orders/callback` marks order paid
5. Notification badge updates (Socket.IO) while logged in

---

## Related docs

- `api/API_DOCUMENTATION.md` — HTTP reference  
- `api/openapi.yaml` — OpenAPI 3  
- `client/README.md` — local frontend + Vercel summary  
- `context/progress-tracker.md` — feature status  
