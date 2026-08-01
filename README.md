# PulseChat

Real-time anonymous chat app with gender-based matchmaking, friends, voice calls, and WebSocket messaging.

**Repository:** [github.com/suraj9716/pulsechat](https://github.com/suraj9716/pulsechat)

![Java](https://img.shields.io/badge/Java-17-orange)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.2-green)
![Angular](https://img.shields.io/badge/Angular-17-red)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)

---

## Features

| Feature | Description |
|---------|-------------|
| **Random Match** | Match by gender preference (Male / Female) |
| **Next Partner** | Leave chat; waiting users auto-connect from queue |
| **Friends** | Send / accept requests, persistent friend chat |
| **Real-time Chat** | STOMP WebSocket, typing indicator, read receipts |
| **Voice Calls** | WebRTC audio calls between matched users / friends |
| **Block & Report** | Block users; chat history removed on unfriend/block |
| **Mobile UI** | Responsive layout with collapsible navigation |

---

## Tech Stack

### Backend
- Java 17, Spring Boot 3.2, Spring Security, Spring Data JPA
- WebSocket (STOMP over SockJS) + JWT handshake
- PostgreSQL + Flyway migrations
- Redis (configured for future scaling)
- Bucket4j rate limiting

### Frontend
- Angular 17, Angular Material, RxJS, Signals
- STOMP client (`@stomp/stompjs` + SockJS)

---

## Project Flow & Architecture

Full diagrams and step-by-step flows:

**[docs/PROJECT_FLOW.md](docs/PROJECT_FLOW.md)**

Includes: system architecture, auth, matchmaking queue, Next partner logic, friends flow, WebSocket topics, and database schema overview.

---

## Quick Start

### Prerequisites
- JDK 17, Maven 3.9+
- Node.js 18+
- PostgreSQL 16, Redis 7 (or Docker)

### 1. Database & Redis (Docker)
```bash
docker-compose up -d postgres redis
```

### 2. Backend
```bash
cd backend
# Windows PowerShell
$env:JWT_SECRET="your-256-bit-secret-key-change-in-production"
mvn spring-boot:run
```
API: **http://localhost:8080**

### 3. Frontend
```bash
cd frontend
npm install
npm start
```
App: **http://localhost:4200**

### Full stack (backend + DB via Docker)
```bash
docker-compose up -d
# Frontend still runs locally: cd frontend && npm start
```

---

## Project Structure

```
pulsechat/
├── backend/                 # Spring Boot API + WebSocket
│   ├── src/main/java/com/anochat/
│   │   ├── controller/      # REST endpoints
│   │   ├── service/         # Business logic
│   │   ├── matchmaking/     # In-memory match queue
│   │   ├── websocket/       # STOMP + notifications
│   │   └── security/        # JWT, rate limit
│   └── src/main/resources/db/migration/   # Flyway SQL
├── frontend/                # Angular SPA
│   └── src/app/
│       ├── features/        # chat, friends, profile, auth
│       ├── core/services/   # API, WebSocket, auth
│       └── layout/          # Main shell + nav
├── docs/
│   ├── PROJECT_FLOW.md      # Architecture & flow diagrams
│   └── API.md               # API reference
└── docker-compose.yml
```

---

## Environment Variables (Backend)

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_HOST` | localhost | PostgreSQL host |
| `POSTGRES_DB` | postgres | Database name |
| `POSTGRES_USER` | postgres | DB user |
| `POSTGRES_PASSWORD` | root | DB password |
| `REDIS_HOST` | localhost | Redis host |
| `JWT_SECRET` | (dev) | **Required in production** |
| `CORS_ORIGINS` | http://localhost:4200 | Frontend URL(s) |

---

## API & WebSocket

- REST API docs: [docs/API.md](docs/API.md)
- WebSocket endpoint: `/ws` (SockJS + STOMP)
- Auth: `Authorization: Bearer <token>` or `?token=` on connect

---

## Deploy

- **Render:** [docs/RENDER_DEPLOY.md](docs/RENDER_DEPLOY.md) — fix Dockerfile path, backend + frontend steps
- **Architecture:** [docs/PROJECT_FLOW.md](docs/PROJECT_FLOW.md)

---

## Author

**Suraj** — [suraj9716/pulsechat](https://github.com/suraj9716/pulsechat)

## License

MIT
