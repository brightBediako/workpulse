# WorkPulse Connect API Documentation

Workforce and service marketplace REST API (Node.js, Express 5, MongoDB/Mongoose).

**Source of truth:** route files under `api/routes/` and controllers. If this doc drifts, **code wins**.

**OpenAPI:** [`openapi.yaml`](./openapi.yaml) (Feature 17).

**Official UI:** [`../client/`](../client/) — Next.js + Pulse Field; default API `http://localhost:8000`.

Last synced: Feature 06 (Phase 0–1).

---

## Table of contents

- [Base information](#base-information)
- [Authentication](#authentication)
- [Users](#users)
- [Gigs](#gigs)
- [Orders](#orders)
- [Notifications](#notifications)
- [Conversations](#conversations)
- [Messages](#messages)
- [Reviews](#reviews)
- [Admin](#admin)
- [Health](#health)
- [Errors](#errors)

---

## Base information

| Item | Value |
| ---- | ----- |
| Base URL | `http://localhost:8000` |
| Content-Type | `application/json` |
| Run | `cd api && npm run server` (port `PORT` or **8000**) |
| Env | Copy `api/.env.example` → `api/.env` |

**Auth:** JWT in httpOnly cookie `accessToken` **or** header `Authorization: Bearer <token>` (cookie preferred if both present). Cookie clients must use `credentials: "include"`.

**Required env:** `MONGO_URI`, `JWT_KEY`. Orders: `STRIPE_SECRET_KEY`. Optional: `PLATFORM_FEE_PERCENT` (default `10`), `COOKIE_SECURE`, `BCRYPT_SALT_ROUNDS`, email + `CLIENT_URL`.

**Domain map:** Buyer = customer · Seller (`isSeller`) = worker · Employer (`isEmployer`) = hiring account · Gig = service listing · Order = paid engagement.

Account modes are **independent flags** (not a single enum): a user can buy services, sell as a worker (`isSeller`), and/or hire via job posts (`isEmployer`) on the same account.

---

## Authentication

Mount: `/api/auth`

### Register

`POST /api/auth/register`

```json
{
  "username": "string (required)",
  "email": "string (required, unique)",
  "password": "string (required)",
  "country": "string (required)",
  "address": "string (required)",
  "phone": "string (required, unique; Ghana 0XXXXXXXXX → +233…)",
  "desc": "string (optional)",
  "img": "string (optional)",
  "isSeller": "boolean (optional, default false) — worker mode",
  "isEmployer": "boolean (optional, default false) — hiring / job-post mode",
  "companyName": "string (optional, for employers)",
  "companyDesc": "string (optional)"
}
```

**201:** `{ "message": "User registered successfully", "user": { … } }` (no password). Creates welcome notification. bcrypt cost default **12**. Register ignores client `isAdmin` / verification / ban fields.

**400** duplicate email/phone or missing address · **500** server error.

### Login

`POST /api/auth/login`

```json
{
  "username": "string (username, email, or phone)",
  "password": "string"
}
```

**200:** `{ "message": "Login successful", "user": { …, "accountModes": { "customer", "worker", "employer", "admin" } }, "token": "<jwt>" }` + sets `accessToken` cookie.

JWT payload includes `id`, `isSeller`, `isEmployer`, `isAdmin`.

Cookie flags: `httpOnly`, `path=/`. Local: `SameSite=Lax`, `Secure=false`. Production / `COOKIE_SECURE=true`: `SameSite=None`, `Secure=true`.

**403** if `isBanned` · **400** wrong password · **404** user not found.

### Logout

`POST /api/auth/logout`

Clears `accessToken` with the **same** cookie options as login.

**200:** `{ "message": "User has been logged out." }`

---

## Users

Mount: `/api/users`

| Method | Path | Auth | Notes |
| ------ | ---- | ---- | ----- |
| GET | `/me/verification` | JWT | Own verification status + document URLs |
| PUT | `/me/verification` | JWT | Seller submits doc URLs for review |
| GET | `/me/employer` | JWT | Own employer mode + company profile |
| PUT | `/me/employer` | JWT | Enable/disable employer mode; refresh JWT cookie |
| GET | `/:id` | — | Public profile (no password; docs hidden) |
| PUT | `/update/:id` | JWT | Self only; cannot set `isVerified` / `verificationStatus` / admin fields |
| DELETE | `/:id` | JWT | Self only |

### Employer mode

Hiring identity for job posts (Feature 12). Independent of `isSeller` and of buying gigs.

| Method | Path | Auth | Notes |
| ------ | ---- | ---- | ----- |
| GET | `/api/users/me/employer` | JWT | Current flags + company |
| PUT | `/api/users/me/employer` | JWT | Toggle + company; returns new `token` |

```json
{
  "isEmployer": true,
  "companyName": "Accra Build Co",
  "companyDesc": "Residential construction"
}
```

- Omitting `isEmployer` on first enable call turns employer mode **on**
- Set `"isEmployer": false` to disable (keeps company fields unless cleared)
- Profiles and login expose `accountModes: { customer, worker, employer, admin }`
- Middleware `verifyEmployer` (DB-backed) is ready for job routes

---

### Submit worker verification

`PUT /api/users/me/verification` (seller / `isSeller: true`)

```json
{
  "documents": [
    "https://cdn.example.com/id-front.jpg",
    "https://cdn.example.com/proof-of-address.pdf"
  ]
}
```

- 1–10 `http(s)` URLs  
- Sets `verificationStatus: "pending"`, `isVerified: false`, stores `verificationDocuments`  
- Already-verified accounts cannot resubmit via this route  

### Admin review

`PUT /api/admin/users/:id/verify`

```json
{
  "verificationStatus": "verified | rejected | pending",
  "adminNotes": "optional string"
}
```

- `verified` requires at least one document on file  
- Syncs `isVerified` boolean  
- Notifies the worker (`type: verification`)

---

## Gigs

Mount: `/api/gigs`

New gigs default `status: "pending"`. Public list returns **approved** only (non-admin).

**Categories:** `cat` must be a taxonomy **slug** from `GET /api/categories`. Labels are normalized to slugs.

**Location (optional):** nested `location` or flat `city` / `region` / `area` / `country` / `lat` / `lng`. Coordinates stored as GeoJSON Point `[lng, lat]`.

| Method | Path | Auth | Notes |
| ------ | ---- | ---- | ----- |
| POST | `/` | JWT + `isSeller` | Create; validates `cat`; optional location |
| GET | `/` | — | Query: `cat`, `city`, `region`, `country`, `lat`, `lng`, `radiusKm`, `userId`, `min`, `max`, `search`, `sort` |
| GET | `/single/:id` | — | Single gig |
| PUT | `/:id` | JWT | Owner only |
| DELETE | `/:id` | JWT | Owner only |

### Categories taxonomy

`GET /api/categories` (public). Seed print: `npm run seed:categories`.

### Locations (Ghana suggestions)

`GET /api/locations` (public) — curated regions + cities.

### Worker discovery

`GET /api/users/workers?city=Accra&cat=plumbing&verified=true`

- With `cat`: sellers with approved gigs in that category (gig location filters apply)
- Without `cat`: filter by worker `serviceCity` / `serviceRegion`
- Optional geo on workers: `lat`, `lng`, `radiusKm` (profile `serviceCoordinates`)
- Response includes `availableNow` when the worker has availability windows

Set service area via `PUT /api/users/update/:id`: `serviceCity`, `serviceRegion`, `serviceCountry`, `serviceLat`, `serviceLng`.

### Availability (workers)

Weekly windows for booking UX cues (not a hard lock on orders). `dayOfWeek`: 0 = Sunday … 6 = Saturday. Times `HH:mm` (24h), timezone default `Africa/Accra`.

| Method | Path | Auth | Notes |
| ------ | ---- | ---- | ----- |
| GET | `/api/users/me/availability` | JWT | Own schedule |
| PUT | `/api/users/me/availability` | JWT seller | Replace full schedule |
| GET | `/api/users/:id/availability` | — | Public seller schedule |

```json
{
  "windows": [
    { "dayOfWeek": 1, "startTime": "09:00", "endTime": "17:00" },
    { "dayOfWeek": 2, "startTime": "09:00", "endTime": "13:00" }
  ],
  "timezone": "Africa/Accra",
  "note": "Call before visiting"
}
```

---

## Orders

Mount: `/api/orders`  
**Payment provider (Feature 15):** **Stripe** (not Paystack). Platform fee default **10%** (`PLATFORM_FEE_PERCENT`). Seller earnings = price − fee.

**Lifecycle**

1. `POST /create-payment-intent/:id` → `pending`, unpaid (Stripe PaymentIntent)  
2. Stripe charges the buyer → **`POST /api/orders/webhook`** (signed) marks paid, **or** buyer `PUT /` with `payment_intent` after client confirm (server re-checks Intent status with Stripe)  
3. `PUT /:id/complete` → `completed`  
4. `POST /:id/dispute` → `disputed` / `disputeStatus: open`

Webhook is the primary confirmation path. Client `PUT /` is a convenience that only succeeds when Stripe reports `succeeded` (idempotent with the webhook).

| Method | Path | Auth | Notes |
| ------ | ---- | ---- | ----- |
| GET | `/` | JWT | Buyer or seller orders (by `isSeller`) |
| GET | `/:id` | JWT | Party or admin |
| POST | `/create-payment-intent/:id` | JWT | Gig must be `approved`; not own gig. Returns `clientSecret`, `orderId`, `payment_intent` |
| POST | `/webhook` | Stripe signature | Raw body; `payment_intent.succeeded` → mark paid. Requires `STRIPE_WEBHOOK_SECRET` |
| PUT | `/` | JWT | Body `{ "payment_intent": "pi_…" }` — verifies Intent with Stripe, then marks paid |
| PUT | `/:id/complete` | JWT | Buyer or seller |
| POST | `/:id/dispute` | JWT | Body `{ "reason", "description?" }` |

**Webhook setup:** Stripe Dashboard → Webhooks → endpoint `https://<api-host>/api/orders/webhook` → event `payment_intent.succeeded` (optional: `payment_intent.payment_failed`). Local: `stripe listen --forward-to localhost:8000/api/orders/webhook`.

---

## Notifications

Mount: `/api/notifications` (JWT)

Auto-created on: welcome, order paid (seller), gig approved/rejected (seller), new message (recipient).

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/?unreadOnly=true&limit=50` | `{ notifications, unreadCount }` |
| PUT | `/:id/read` | Mark one read |
| PUT | `/read-all` | Mark all read |

Types: `welcome` · `order_paid` · `gig_approved` · `gig_rejected` · `new_message` · `verification` · `job_application` · `application_*` · `service_request` · `request_*` · `general`

Realtime: creating a notification also emits Socket.IO `notification:new` + `notification:badge` (see **Realtime**). Mark-read updates the badge.

---

## Conversations

Mount: `/api/conversations` (JWT)

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/` | List for buyer or seller |
| POST | `/` | Body `{ "to": "<otherUserId>" }` — builds composite `id` |
| GET | `/single/:id` | By conversation `id` string |
| PUT | `/:id` | Mark read for current role |

---

## Messages

Mount: `/api/messages` (JWT)

| Method | Path | Notes |
| ------ | ---- | ----- |
| POST | `/` | Body `{ "conversationId", "desc" }` — persists via REST; pushes `message:new` over Socket.IO |
| GET | `/:id` | Messages for conversation id |

---

## Realtime (Socket.IO)

Same HTTP server as the REST API. Path default `/socket.io` (override with `SOCKET_PATH`).

**Auth (required):** JWT via one of:

1. `auth: { token: "<jwt>" }` on connect (recommended for browser when using Bearer)
2. `Authorization: Bearer <jwt>` handshake header
3. Cookie `accessToken` (same as REST, when credentials are sent)

On connect the socket joins room `user:<userId>` and receives `socket:ready`.

### Client events (optional)

| Event | Payload | Effect |
| ----- | ------- | ------ |
| `conversation:join` | conversation id string | Join `conversation:<id>` for live thread |
| `conversation:leave` | conversation id string | Leave that room |

### Server → client events

| Event | When | Payload (shape) |
| ----- | ---- | --------------- |
| `socket:ready` | After auth | `{ userId, room }` |
| `message:new` | After `POST /api/messages` | `{ message, conversationId, conversation }` |
| `notification:new` | After any persisted notification | `{ notification, unreadCount }` |
| `notification:badge` | New notification or mark-read | `{ unreadCount }` |

REST remains the source of truth; sockets are push only. Deduplicate `message:new` by `message._id` if you join both user and conversation rooms.

Example (browser):

```js
import { io } from "socket.io-client";
const socket = io("http://localhost:8000", {
  auth: { token: accessToken },
  withCredentials: true,
});
socket.on("notification:badge", ({ unreadCount }) => { /* update UI */ });
socket.on("message:new", ({ message }) => { /* append if not duplicate */ });
socket.emit("conversation:join", conversationId);
```

---

## Reviews

Mount: `/api/reviews`

| Method | Path | Auth | Notes |
| ------ | ---- | ---- | ----- |
| POST | `/` | JWT | Buyer only; must have paid order for gig; one review per user/gig |
| GET | `/:gigId` | — | List reviews for gig |
| DELETE | `/:id` | JWT | Owner or admin; rolls back gig star aggregates |

Create body: `{ "gigId", "desc", "star": 1–5 }`

---

## Admin

Mount: `/api/admin`  
All routes: `verifyToken` + `verifyAdmin`.

### Dashboard & analytics

| Method | Path |
| ------ | ---- |
| GET | `/dashboard` |
| GET | `/analytics` |

### Users

| Method | Path |
| ------ | ---- |
| GET | `/users` |
| GET | `/users/:id` |
| PUT | `/users/:id/verify` |
| PUT | `/users/:id/ban` |
| PUT | `/users/:id/unban` |
| PUT | `/users/:id` |
| DELETE | `/users/:id` |

### Gigs (moderation)

| Method | Path |
| ------ | ---- |
| GET | `/gigs` |
| GET | `/gigs/:id` |
| PUT | `/gigs/:id/approve` |
| PUT | `/gigs/:id/reject` |
| PUT | `/gigs/:id/suspend` |
| PUT | `/gigs/:id` |
| DELETE | `/gigs/:id` |

Approve/reject create seller notifications.

### Orders

| Method | Path |
| ------ | ---- |
| GET | `/orders` |
| GET | `/orders/:id` |
| PUT | `/orders/:id/resolve-dispute` |
| PUT | `/orders/:id/status` |

### Payments & reports

| Method | Path | Status |
| ------ | ---- | ------ |
| GET | `/payments/stats` | Implemented |
| GET | `/payments/earnings` | Implemented |
| POST | `/payments/withdrawals/:id/process` | **501** not supported |
| POST | `/reports/generate` | Implemented (`type`: users \| gigs \| orders \| revenue) |
| GET | `/logs` | **501** not supported |

---

## Health

| Method | Path | Response |
| ------ | ---- | -------- |
| GET | `/` | Plain text `OK` |
| GET | `/healthz` | `{ "status": "ok" }` |

---

## Jobs & Applications

Mount: `/api/jobs`

Employer job posts (Feature 11 `isEmployer`) and worker applications (`isSeller`). Distinct from gig purchases / orders.

### Job posts

| Method | Path | Auth | Notes |
| ------ | ---- | ---- | ----- |
| POST | `/` | JWT + employer | Create open job |
| GET | `/` | — | Public list (default `status=open`); filters `cat`, `city`, `region`, `country`, `employmentType`, `employerId`, `status`, `limit` |
| GET | `/mine` | JWT + employer | Own posts |
| GET | `/:id` | — | Single job |
| PUT | `/:id` | JWT + employer | Update details / `status` open\|closed\|cancelled |
| DELETE | `/:id` | JWT + employer | Soft-cancel (`status: cancelled`) |

```json
{
  "title": "Site electrician — 2 weeks",
  "description": "Wiring for a small site in East Legon.",
  "cat": "electrical",
  "city": "Accra",
  "region": "Greater Accra",
  "budgetMin": 800,
  "budgetMax": 1500,
  "currency": "GHS",
  "employmentType": "short_term",
  "positions": 1
}
```

`employmentType`: `one_time` | `short_term` | `contract` | `full_time`. Category slugs match `GET /api/categories`.

Job `status`: `open` → `filled` (when accepted applicants reach `positions`) | `closed` | `cancelled`.

### Applications

| Method | Path | Auth | Notes |
| ------ | ---- | ---- | ----- |
| POST | `/:id/applications` | JWT seller | Apply (cover letter + optional `proposedRate`) |
| GET | `/:id/applications` | JWT employer (owner) | List applicants; optional `?status=` |
| GET | `/applications/mine` | JWT | Worker's own applications (+ nested `job`) |
| PUT | `/:id/applications/:appId/accept` | JWT employer | Accept; may set job `filled` |
| PUT | `/:id/applications/:appId/reject` | JWT employer | Reject |
| PUT | `/:id/applications/:appId/withdraw` | JWT worker | Withdraw pending application |

```json
{
  "coverLetter": "5 years commercial wiring experience.",
  "proposedRate": 1200
}
```

Application `status`: `pending` | `accepted` | `rejected` | `withdrawn`.

Notifications: employer on apply (`job_application`); worker on accept/reject.

---

## Service Requests

Mount: `/api/service-requests`

Customer demand posts (alongside seller gigs). Distinct from employer **jobs** (`/api/jobs`) and from paid **orders**.

### Lifecycle

`open` → `accepted` | `rejected` | `cancelled` → (`accepted` → `completed`)

- **Open board:** no `sellerId` — any worker can `accept` (claim)
- **Directed:** `sellerId` and/or `gigId` — that worker can `accept` or `reject`

### Routes

| Method | Path | Auth | Notes |
| ------ | ---- | ---- | ----- |
| POST | `/` | JWT | Customer creates request |
| GET | `/` | — | Open undirected board (default); filters `cat`, `city`, `region`, `status`, `sellerId`, `limit` |
| GET | `/mine` | JWT | Customer's own requests |
| GET | `/inbox` | JWT seller | Directed-to-me + open board |
| GET | `/:id` | — | Single request |
| PUT | `/:id` | JWT customer | Update while `open` |
| DELETE | `/:id` | JWT customer | Cancel |
| PUT | `/:id/accept` | JWT seller | Accept / claim |
| PUT | `/:id/reject` | JWT seller | Decline directed request |
| PUT | `/:id/complete` | JWT | Customer or accepted seller |

```json
{
  "title": "Fix kitchen sink leak",
  "description": "P-trap dripping under sink.",
  "cat": "plumbing",
  "city": "Accra",
  "budget": 250,
  "currency": "GHS",
  "preferredDate": "2026-07-20",
  "sellerId": "optionalWorkerId",
  "gigId": "optionalGigId"
}
```

If `gigId` is set, `sellerId` defaults to the gig owner. Directed creates notify the worker (`service_request`); accept/reject notify the customer.

---

## Errors

Typical shape from the global handler:

```json
{
  "message": "Error message",
  "stack": "… (may appear depending on environment)"
}
```

Common status codes: `400` validation · `401` unauthenticated · `403` forbidden / banned · `404` not found · `501` not implemented · `500` server.

---

## Quick route index

```
GET  / | /healthz
GET  /api/categories
GET  /api/locations
GET  /api/users/workers
GET|PUT /api/users/me/availability
GET|PUT /api/users/me/employer
GET  /api/users/:id/availability
POST|GET|PUT|DELETE /api/jobs/…
POST|GET|PUT|DELETE /api/service-requests/…
POST /api/auth/register | login | logout
GET|PUT|DELETE /api/users/…
POST|GET|PUT|DELETE /api/gigs/…
GET|POST|PUT /api/orders/…  (+ POST /api/orders/webhook)
GET|PUT /api/notifications/…
GET|POST|PUT /api/conversations/…
POST|GET /api/messages/…
WS   /socket.io  (JWT — see Realtime)
POST|GET|DELETE /api/reviews/…
* /api/admin/…  (see Admin)
```
