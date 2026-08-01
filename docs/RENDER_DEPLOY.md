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

### PostgreSQL (required)

**Error `Connection to localhost:5432 refused`** = database env vars missing on Render.

1. Render Dashboard → **New → PostgreSQL** (free, same region as backend)
2. Open your **backend Web Service** → **Environment**
3. Click **Add from Database** → select the Postgres you created  
   → Render adds **`DATABASE_URL`** automatically (recommended)
4. **Save** → **Manual Deploy**

Or set manually (from Postgres **Connections** tab):

```env
POSTGRES_HOST=dpg-xxxxx-a.oregon-postgres.render.com
POSTGRES_PORT=5432
POSTGRES_DB=pulsechat
POSTGRES_USER=pulsechat
POSTGRES_PASSWORD=<password from dashboard>
```

### Redis (required for startup)

[Upstash](https://upstash.com) → free Redis → copy **Redis URL** (`rediss://...`):

```env
REDIS_URL=rediss://default:YOUR_PASSWORD@YOUR_HOST.upstash.io:6379
```

Or separate vars:

```env
REDIS_HOST=YOUR_HOST.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=<password>
```

### Other environment variables

```env
JWT_SECRET=<long-random-secret>
CORS_ORIGINS=https://YOUR-FRONTEND.onrender.com
SPRING_PROFILES_ACTIVE=prod
```

The backend accepts **`DATABASE_URL`** (Render auto-injects when linked) or **`POSTGRES_*`** vars.

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
