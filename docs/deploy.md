# Deploy WorkPulse Connect

Staging/production checklist for the **API** (`api/`) and **client** (`client/`) apps.

---

## Architecture

| Piece | Default local | Typical host |
| ----- | ------------- | ------------ |
| API + Socket.IO | `http://localhost:8000` | Render, Railway, or VPS (Node) |
| Client (Next.js) | `http://localhost:3000` | Vercel |
| MongoDB | local / Atlas | Atlas URI in `MONGO_URI` |

CORS on the API already allows `localhost:3000` and `*.vercel.app`. Add your production client origin to `api/app/app.js` `allowedOrigins` if it is a custom domain.

---

## Environment checklist (API)

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
| `CLIENT_URL` | Yes | Production client URL (emails + Paystack callback `/orders/callback`) |
| `BCRYPT_SALT_ROUNDS` | No | Default `12` |
| `SOCKET_PATH` | No | Default `/socket.io` |
| Email `EMAIL_*` | Optional | Welcome mail |

Webhook URL to register in Paystack:

`https://<api-host>/api/orders/webhook`

Event: `charge.success`. Signature uses HMAC SHA512 of the raw body with `PAYSTACK_SECRET_KEY` (`x-paystack-signature`). Local: tunnel the API (e.g. ngrok) or rely on the client callback verify path.

---

## Environment checklist (Client)

Copy `client/.env.example` → `client/.env.local`.

| Variable | Notes |
| -------- | ----- |
| `NEXT_PUBLIC_API_URL` | Public API origin, e.g. `https://api.example.com` |
| `NEXT_PUBLIC_SOCKET_URL` | Usually same as API URL |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Optional; for Paystack Inline JS later |

---

## Deploy API (Render / Railway / VPS)

1. Root or service directory: `api/`
2. Build: none (plain Node) — start command `npm start` (or `node server.js`)
3. Set env vars from the table above
4. Ensure `NODE_ENV=production` and `COOKIE_SECURE=true` if the client app is on another HTTPS origin
5. Confirm `GET /healthz` returns `{ "status": "ok" }`
6. Confirm Socket.IO clients can reach the same host (path `/socket.io`)

### VPS sketch

```bash
cd api
npm ci --omit=dev
# set .env
npm start
# or: pm2 start server.js --name workpulse-api
```

---

## Deploy Client (Vercel)

1. Import repo; set **Root Directory** to `client`
2. Framework: Next.js (auto)
3. Env: `NEXT_PUBLIC_API_URL` = production API URL
4. Deploy; open the Vercel URL and verify login against the API (cookie or Bearer)

If cookies are blocked cross-site, the client still sends `Authorization: Bearer` from localStorage after login.

---

## Smoke test after deploy

1. `GET /healthz`
2. Register + login from the client
3. `GET /api/categories` and Discover gigs
4. Paystack test payment → webhook or `/orders/callback` marks order paid
5. Notification badge updates (Socket.IO) while logged in

---

## Related docs

- `api/API_DOCUMENTATION.md` — HTTP reference  
- `api/openapi.yaml` — OpenAPI 3  
- `client/README.md` — local frontend  
- `context/progress-tracker.md` — feature status  
