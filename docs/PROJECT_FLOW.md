# PulseChat — Project Flow & Architecture

This document describes how PulseChat works end-to-end: architecture, user flows, and key backend/frontend interactions.

---

## 1. High-Level Architecture

```mermaid
flowchart TB
    subgraph Client["Browser (Angular)"]
        UI[Pages: Home / Friends / Profile]
        WS[WebSocketService STOMP]
        API[HTTP Services + JWT Interceptor]
    end

    subgraph Server["Spring Boot Backend"]
        REST[REST Controllers]
        STOMP[STOMP WebSocket Handler]
        MM[MatchmakingService + Queue]
        SVC[Services: Chat, Friend, Message, Block]
        NOTIFY[RealtimeNotificationService]
    end

    subgraph Data["Data Layer"]
        PG[(PostgreSQL)]
        RD[(Redis)]
    end

    UI --> API
    UI --> WS
    API --> REST
    WS --> STOMP
    REST --> SVC
    STOMP --> SVC
    SVC --> PG
    MM --> SVC
    SVC --> NOTIFY
    NOTIFY --> STOMP
    SVC -.-> RD
```

| Layer | Responsibility |
|-------|----------------|
| **Angular UI** | Login, matchmaking UI, chat, friends list, calls |
| **REST API** | Auth, CRUD, matchmaking start/cancel, next partner |
| **WebSocket** | Live messages, typing, friend requests, match-found events |
| **PostgreSQL** | Users, rooms, messages, friendships, blocks |
| **In-memory queue** | Matchmaking wait list (per server instance) |

---

## 2. Application Routes (Frontend)

```mermaid
flowchart LR
    Login["/login"] --> Home["/chat Home"]
    Register["/register"] --> Home
    Home --> Friends["/friends"]
    Home --> Profile["/profile"]
    Friends --> FriendChat["/friends/chat/:id"]
    Profile --> OtherProfile["/profile/:id"]
```

| Route | Component | Purpose |
|-------|-----------|---------|
| `/chat` | Home + random chat | Matchmaking & stranger chat |
| `/friends` | Friends list | Pending requests + friend conversations |
| `/friends/chat/:id` | Friend chat | Persistent chat with a friend |
| `/profile` | Own profile | Edit bio, gender |
| `/profile/:id` | User profile | View / add friend / block |

---

## 3. Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Angular App
    participant A as Auth API
    participant DB as PostgreSQL

    U->>F: Register / Login
    F->>A: POST /api/auth/register or /login
    A->>DB: Save / verify user (BCrypt)
    A-->>F: accessToken + refreshToken + user
    F->>F: Store tokens (localStorage)
    F->>F: JWT Interceptor attaches Bearer token

    Note over F,A: On 401 → refresh token → retry request

    U->>F: Logout
    F->>A: POST /api/auth/logout
    F->>F: Clear tokens, redirect /login
```

**Security notes**
- Passwords hashed with BCrypt
- JWT in HTTP headers and WebSocket handshake (`?token=` or header)
- Rate limiting per authenticated user (Bucket4j)

---

## 4. Matchmaking Flow

Users pick a **gender preference** (who they want to match with). The queue matches compatible pairs.

**Compatibility rule:** User A matches User B when:
- A's preference = B's gender **AND**
- B's preference = A's gender

**Excluded from match:** blocked users, existing friends.

```mermaid
flowchart TD
    Start([User clicks Search]) --> Pref[Select preference MALE/FEMALE]
    Pref --> API[POST /api/matchmaking/search]
    API --> Queue{Someone waiting<br/>in queue?}
    Queue -->|Yes| Match[Create MATCHMAKING room]
    Queue -->|No| Wait[Add user to queue]
    Match --> WS[WS: match-found to both]
    Match --> Chat[Open chat UI]
    Wait --> Poll[Poll or wait for match-found event]
    Poll --> Chat
```

### Example: Suraj, Heena, Ankit

```mermaid
sequenceDiagram
    participant S as Suraj (M, wants F)
    participant Q as Match Queue
    participant H as Heena (F, wants M)
    participant A as Ankit (M, wants F)

    S->>Q: startSearch(FEMALE)
    Q-->>S: waiting...

    H->>Q: startSearch(MALE)
    Q->>Q: Suraj + Heena compatible
    Q-->>H: matched → room created
    Note over S,H: Both in chat room

    A->>Q: startSearch(FEMALE)
    Q-->>A: waiting in queue...

    S->>Q: Next partner
    Q->>Q: Re-queue Heena (saved preference)
    Q->>Q: Heena matches Ankit instantly
    Q-->>H: match-found → Ankit
    Q-->>A: match-found → Heena
    Q->>Q: Re-queue Suraj → waiting
```

---

## 5. Next Partner Flow

When one user clicks **Next**:

1. Current **MATCHMAKING** room is deactivated
2. **Remaining user** is re-queued with their **last saved preference**
3. If someone is waiting (e.g. Ankit), they **match immediately**
4. Both get **`match-found`** WebSocket event with new room
5. User who clicked Next is also re-queued

```mermaid
flowchart LR
    Next[User clicks Next] --> Leave[leaveMatchRoomSilent]
    Leave --> ReOther[reenterMatchmaking other user]
    ReOther --> Instant{Match in queue?}
    Instant -->|Yes| MF[notify match-found]
    Instant -->|No| PS[notify partner-searching]
    Leave --> ReSelf[reenterMatchmaking leaver]
    ReSelf --> Wait[Leaver waits in queue]
```

---

## 6. Real-Time Chat Flow

```mermaid
sequenceDiagram
    participant U1 as User 1
    participant F1 as Angular
    participant WS as STOMP /ws
    participant S as MessageService
    participant DB as PostgreSQL
    participant F2 as Angular
    participant U2 as User 2

    U1->>F1: Type message + Send
    F1->>WS: /app/chat/{roomId}/send
    WS->>S: Persist message
    S->>DB: INSERT message
    WS->>F1: /topic/room/{roomId}
    WS->>F2: /topic/room/{roomId}
    F2->>U2: Show message

    U1->>F1: Typing...
    F1->>WS: /app/chat/{roomId}/typing
    WS->>F2: /topic/room/{roomId}/typing
```

| STOMP destination | Direction | Purpose |
|-------------------|-----------|---------|
| `/topic/room/{roomId}` | Server → clients | New messages |
| `/topic/room/{roomId}/typing` | Server → clients | Typing indicator |
| `/app/chat/{roomId}/send` | Client → server | Send message |
| `/user/queue/friend-requests` | Server → user | Friend request |
| `/user/queue/match-found` | Server → user | New match room |
| `/user/queue/calls` | Server → user | Voice call signaling |

---

## 7. Friends Flow

```mermaid
stateDiagram-v2
    [*] --> Strangers: Random chat
    Strangers --> PendingSent: Add Friend
    Strangers --> PendingReceived: Other sent request
    PendingSent --> Friends: Other accepts
    PendingReceived --> Friends: Confirm Friend
    PendingSent --> Friends: Mutual request auto-accept
    Friends --> Strangers: Remove friend / Block

    note right of Friends
        On accept during random chat:
        MATCHMAKING room → FRIEND room
        Same messages kept
    end note
```

**Steps**
1. **Add Friend** → `POST /api/friends/request/{userId}`
2. Receiver gets WebSocket + banner notification
3. **Confirm** → friendship row + room promoted to `FRIEND` type
4. **Remove friend** → friendship deleted + all chat rooms/messages between pair deleted

---

## 8. Voice Call Flow (WebRTC)

```mermaid
sequenceDiagram
    participant A as Caller
    participant WS as /user/queue/calls
    participant B as Receiver

    A->>WS: offer (SDP)
    WS->>B: incoming call UI
    B->>WS: answer (SDP)
    WS->>A: answer
    A->>WS: ICE candidates
    B->>WS: ICE candidates
    Note over A,B: Audio connected P2P
    A->>WS: hangup
    A->>A: POST call-log → chat message with duration
```

---

## 9. Database Overview

```mermaid
erDiagram
    USERS ||--o{ CHAT_ROOMS : participates
    USERS ||--o{ FRIENDSHIPS : has
    USERS ||--o{ FRIEND_REQUESTS : sends
    CHAT_ROOMS ||--o{ MESSAGES : contains
    USERS ||--o{ BLOCKS : blocks

    USERS {
        uuid id PK
        string username
        string email
        string gender
        boolean online_status
    }

    CHAT_ROOMS {
        uuid id PK
        uuid user1_id FK
        uuid user2_id FK
        string room_type
        boolean active
    }

    MESSAGES {
        uuid id PK
        uuid chat_room_id FK
        uuid sender_id FK
        string content
        string message_type
        string status
    }

    FRIENDSHIPS {
        uuid id PK
        uuid user1_id FK
        uuid user2_id FK
    }

    FRIEND_REQUESTS {
        uuid id PK
        uuid sender_id FK
        uuid receiver_id FK
        string status
    }
```

**Room types**
| Type | Use |
|------|-----|
| `MATCHMAKING` | Random stranger chat |
| `FRIEND` | Permanent friend chat (same room can be promoted from match) |

---

## 10. Backend Module Map

```mermaid
flowchart LR
    subgraph Controllers
        AuthC[AuthController]
        ChatC[ChatController]
        MatchC[MatchmakingController]
        FriendC[FriendController]
    end

    subgraph Services
        AuthS[AuthService]
        ChatS[ChatRoomService]
        MatchS[MatchmakingService]
        FriendS[FriendService]
        MsgS[MessageService]
        BlockS[BlockService]
    end

    AuthC --> AuthS
    ChatC --> ChatS
    ChatC --> MatchS
    MatchC --> MatchS
    FriendC --> FriendS
    ChatS --> MsgS
    FriendS --> ChatS
    MatchS --> ChatS
```

---

## 11. Frontend Services Map

| Service | Role |
|---------|------|
| `AuthService` | Login, register, token storage |
| `WebSocketService` | STOMP connect, room/friend/call subscriptions |
| `ChatApiService` | Rooms, messages, next partner |
| `MatchmakingApiService` | Start / cancel search |
| `FriendApiService` | Friends, requests, overview |
| `FriendNotificationService` | Pending request badges + polling |
| `UnreadCountService` | Unread counts (debounced overview fetch) |
| `CallService` | WebRTC + call UI state |

---

## 12. Deployment Overview

```mermaid
flowchart TB
    subgraph FreeOption1["Option A: Single VPS (Oracle Free)"]
        VPS[Ubuntu VM]
        VPS --> DC[docker-compose]
        DC --> PG2[PostgreSQL]
        DC --> RD2[Redis]
        DC --> BE[Spring Boot :8080]
        NG[Nginx] --> FE[Angular static build]
        NG --> BE
    end

    subgraph FreeOption2["Option B: Split services"]
        Vercel[Vercel / Cloudflare Pages] --> FE2[Frontend]
        Render[Render / Fly.io] --> BE2[Backend]
        Neon[Neon / Supabase] --> PG3[PostgreSQL]
        Upstash[Upstash] --> RD3[Redis]
        FE2 --> BE2
        BE2 --> PG3
    end
```

**Production checklist**
- Set strong `JWT_SECRET`
- Set `CORS_ORIGINS` to your frontend URL
- Enable HTTPS (required for WebRTC + secure cookies)
- Configure Nginx WebSocket proxy headers
- Never commit `.env` or database passwords

---

## 13. Local Development Diagram

```mermaid
flowchart LR
    Dev[Developer Machine]
    Dev -->|:4200| NGDev[ng serve Angular]
    Dev -->|:8080| SB[mvn spring-boot:run]
    Dev -->|:5432| PGDev[(PostgreSQL)]
    Dev -->|:6379| RDDev[(Redis)]
    NGDev --> SB
    SB --> PGDev
    SB --> RDDev
```

---

## Related Docs

- [API.md](./API.md) — REST endpoint reference
- [README.md](../README.md) — Setup & features
