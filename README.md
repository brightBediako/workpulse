# WorkPulse Connect

Workforce and service marketplace — Express API + Next.js client (Pulse Field).

## Live

| App | URL |
| --- | --- |
| Frontend | https://workpulse-omega.vercel.app |
| API | https://workpulse-lbdp.onrender.com |
| Health | https://workpulse-lbdp.onrender.com/healthz |

## Quick start

### API (`api/`)

```bash
cd api
cp .env.example .env   # set MONGO_URI, JWT_KEY, Paystack keys
npm install
npm run server         # http://localhost:8000
```

Health: `GET http://localhost:8000/healthz`

### Client (`client/`)

```bash
cd client
cp .env.example .env.local
npm install
npm run dev            # http://localhost:3000
```

### Production (Vercel client)

Set Vercel **Root Directory** to `client`, add:

- `NEXT_PUBLIC_API_URL=https://workpulse-lbdp.onrender.com`
- `NEXT_PUBLIC_SOCKET_URL=https://workpulse-lbdp.onrender.com`

On Render, set `CLIENT_URL=https://workpulse-omega.vercel.app` and `COOKIE_SECURE=true`.

Details: [`docs/deploy.md`](docs/deploy.md).

Docs: `api/API_DOCUMENTATION.md` · `api/openapi.yaml` · `docs/deploy.md` · `context/`
