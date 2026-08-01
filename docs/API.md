# API Documentation

Base URL: `http://localhost:8080` (or your backend URL)

All authenticated endpoints require header: `Authorization: Bearer <access_token>`.

---

## Authentication

### POST /api/auth/register
Register a new user.

**Request body:**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePass1",
  "gender": "MALE"
}
```
- `username`: 3–50 chars, alphanumeric and underscore
- `password`: min 8 chars, at least one upper, one lower, one digit
- `gender`: `MALE` | `FEMALE`

**Response:** `200` – AuthResponse (accessToken, refreshToken, expiresIn, user)

---

### POST /api/auth/login
Login with username or email.

**Request body:**
```json
{
  "usernameOrEmail": "johndoe",
  "password": "SecurePass1"
}
```

**Response:** `200` – AuthResponse

---

### POST /api/auth/refresh
Refresh access token.

**Request body:**
```json
{
  "refreshToken": "<refresh_token>"
}
```

**Response:** `200` – AuthResponse

---

### POST /api/auth/logout
Invalidate refresh token (optional body: `{ "refreshToken": "..." }`).

**Response:** `200`

---

## User Profile

### GET /api/users/me
Get current user profile (no password or sensitive fields).

**Response:** `200` – UserResponse (id, username, email, gender, bio, onlineStatus, role, createdAt)

---

### PUT /api/users/me
Update profile (bio, gender).

**Request body:**
```json
{
  "bio": "Hello world",
  "gender": "FEMALE"
}
```

**Response:** `200` – UserResponse

---

## Matchmaking

### POST /api/matchmaking/search
Start search for a partner. Query param: `preference` = `MALE` | `FEMALE` (gender you want to be matched with).

**Response:**
- `200` – ChatRoomResponse if matched immediately
- `202` – `{ "status": "searching", "message": "Waiting for a match..." }` if queued

---

### POST /api/matchmaking/cancel
Cancel current search.

**Response:** `200`

---

### GET /api/matchmaking/status
Check if user is in queue.

**Response:** `200` – `{ "inQueue": true | false }`

---

## Chat

### GET /api/chat/room/current
Get current active chat room for the user.

**Response:** `200` – ChatRoomResponse or empty body if no room

---

### GET /api/chat/room/{roomId}/messages
Get message history (paginated). Query: `page` (default 0), `size` (default 50).

**Response:** `200` – Array of MessageResponse (id, senderId, receiverId, chatRoomId, content, status, timestamp)

---

### POST /api/chat/room/{roomId}/next
Leave current room and clear matchmaking (next partner flow).

**Response:** `200`

---

## Friends

### GET /api/friends
List friends.

**Response:** `200` – Array of UserResponse

---

### POST /api/friends/request/{receiverId}
Send friend request.

**Response:** `200` – FriendRequestResponse

---

### POST /api/friends/request/{requestId}/accept
Accept friend request.

**Response:** `200`

---

### POST /api/friends/request/{requestId}/reject
Reject friend request.

**Response:** `200`

---

### DELETE /api/friends/{friendId}
Remove friend.

**Response:** `200`

---

### GET /api/friends/requests/pending
List pending received friend requests.

**Response:** `200` – Array of FriendRequestResponse

---

## Blocks

### POST /api/blocks/{blockedId}
Block a user.

**Response:** `200`

---

### DELETE /api/blocks/{blockedId}
Unblock a user.

**Response:** `200`

---

## Reports

### POST /api/reports
Report a user (for moderation).

**Request body:**
```json
{
  "reportedUserId": "uuid",
  "reason": "Optional reason text"
}
```

**Response:** `200`

---

## Admin (requires role ADMIN)

### POST /api/admin/users/{userId}/ban
Ban user. Body: `{ "reason": "..." }`.

**Response:** `200` – UserResponse

---

### POST /api/admin/users/{userId}/unban
Unban user.

**Response:** `200` – UserResponse

---

### GET /api/admin/reports
List unresolved reports. Supports pagination (page, size).

**Response:** `200` – Page of report objects

---

## WebSocket (STOMP)

- **Connect:** SockJS endpoint `/ws`. Add JWT via query `?token=<access_token>` or header `Authorization: Bearer <access_token>` in CONNECT frame.
- **Subscribe to messages:** `/topic/room/{roomId}` – payload: MessageResponse JSON
- **Subscribe to typing:** `/topic/room/{roomId}/typing` – payload: `{ "userId": "uuid", "typing": true }`
- **Send message:** Publish to `/app/chat/{roomId}/send` – body: `{ "content": "Hello" }`
- **Send typing:** Publish to `/app/chat/{roomId}/typing` – body: `{ "typing": true }`

---

## Error Responses

- `400` – Bad request (validation or business rule); body: `{ "error": "message" }` or `{ "errors": { "field": "message" } }`
- `401` – Unauthorized (missing or invalid token)
- `403` – Forbidden (e.g. not admin)
- `404` – Not found; body: `{ "error": "message" }`
- `429` – Too many requests (rate limit)
