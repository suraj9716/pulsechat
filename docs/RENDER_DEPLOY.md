# Deploy on Render

## Error: `open Dockerfile: no such file or directory`

Render repo **root** se Dockerfile dhoondhta hai. Dockerfile **`backend/`** folder mein hai.

### Fix (Dashboard)

Backend Web Service → **Settings**:

| Setting | Value |
|---------|--------|
| **Root Directory** | `backend` |
| **Environment** | Docker |
| **Dockerfile Path** | `./Dockerfile` (default) |

Save → **Manual Deploy** → Deploy latest commit.

---

## Backend setup

1. **New → Web Service** → connect `suraj9716/pulsechat`
2. **Root Directory:** `backend`
3. **Runtime:** Docker
4. **Instance type:** Free

### Environment variables

```env
JWT_SECRET=<long-random-secret>
CORS_ORIGINS=https://YOUR-FRONTEND.onrender.com
POSTGRES_HOST=<from Render Postgres or Neon>
POSTGRES_PORT=5432
POSTGRES_DB=<db name>
POSTGRES_USER=<user>
POSTGRES_PASSWORD=<password>
REDIS_HOST=<Upstash or Render Redis host>
REDIS_PORT=6379
SPRING_PROFILES_ACTIVE=prod
```

**PostgreSQL:** Render → New → PostgreSQL (or use [Neon](https://neon.tech) free).

**Redis (required for startup):** [Upstash](https://upstash.com) free Redis → copy host to `REDIS_HOST`.

---

## Frontend setup

1. **New → Static Site** → same repo
2. **Root Directory:** `frontend`
3. **Build Command:** `npm install && npm run build`
4. **Publish Directory:** `dist/frontend/browser`

Update `frontend/src/environments/environment.prod.ts` before deploy:

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://YOUR-BACKEND.onrender.com'
};
```

Commit & push → redeploy frontend.

Set backend `CORS_ORIGINS` to your frontend URL.

---

## Or use Blueprint

Repo root has `render.yaml`. Render → **New → Blueprint** → select repo → fill DB/Redis env vars when prompted.

---

## Notes

- Free tier sleeps after ~15 min inactivity (slow cold start).
- WebSockets work on Render Web Services.
- `server.port` uses Render's `PORT` env automatically.
