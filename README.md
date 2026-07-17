# WorkPulse Connect

Workforce and service marketplace — Express API + Next.js client (Pulse Field).

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

Docs: `api/API_DOCUMENTATION.md` · `api/openapi.yaml` · `docs/deploy.md` · `context/`
