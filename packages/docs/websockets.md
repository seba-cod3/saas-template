# WebSockets

Real-time communication between server and frontend using typed channels. Uses `@hono/node-ws` on the backend and a singleton WebSocket client on the frontend, with Redis Pub/Sub to support multiple server instances.

## Architecture

```
Frontend (useChannel hook)
    │
    ▼
WebSocket connection (ws://localhost:3001/ws)
    │
    ▼
Hono server (upgrade + client tracking)
    │
    ▼
Redis Pub/Sub ◄── broadcast() from anywhere in the backend
    │
    ▼
All server instances forward to subscribed clients
```

The frontend subscribes to channels via JSON messages. The backend publishes events via `broadcast()`, which goes through Redis Pub/Sub so all server instances receive it and forward to their connected clients.

## Shared channels

Channels are defined in `packages/shared/src/ws/index.ts`. Both frontend and backend import from here:

```ts
// packages/shared/src/ws/index.ts
export const WS_CHANNELS = {
  TEST_NOTIFICATIONS: 'test-notifications',
  // Add your channels here:
  // WHITEBOARD: 'whiteboard',
  // CHAT: 'chat',
} as const
```

For entity-specific channels (e.g. a specific whiteboard or chat room), use `channelKey()`:

```ts
import { WS_CHANNELS, channelKey } from '@repo/shared/ws'

channelKey(WS_CHANNELS.TEST_NOTIFICATIONS)
// → 'test-notifications'

channelKey(WS_CHANNELS.WHITEBOARD, 'board-abc123')
// → 'whiteboard:board-abc123'
```

## Backend usage

### Sending events

```ts
import { broadcast } from './lib/ws.js'
import { WS_CHANNELS } from '@repo/shared/ws'

// Broadcast to all subscribers of a channel
await broadcast({ channel: WS_CHANNELS.TEST_NOTIFICATIONS }, {
  message: 'New notification!',
})

// Broadcast to a specific entity (e.g. a whiteboard room)
await broadcast(
  { channel: WS_CHANNELS.WHITEBOARD, entityId: 'board-abc123' },
  { action: 'draw', points: [...] },
)

// Broadcast to a specific user
await broadcast(
  { channel: WS_CHANNELS.USER_UPDATES, entityId: userId },
  { type: 'profile-updated' },
)
```

`broadcast()` publishes through Redis, so it works across multiple server instances.

### How it works internally

1. Client connects to `/ws` (WebSocket upgrade)
2. Client sends `{"type":"subscribe","channel":"test-notifications"}`
3. Server tracks the subscription and ensures Redis is subscribed to that channel
4. When `broadcast()` is called, it publishes to Redis
5. The Redis subscriber receives the message and forwards it to all local clients subscribed to that channel
6. Client can send `{"type":"unsubscribe","channel":"test-notifications"}` to stop receiving

## Frontend usage

### `useChannel` hook (React)

```tsx
import { useChannel } from '../lib/useChannel'
import { WS_CHANNELS, channelKey } from '@repo/shared/ws'

function NotificationBanner() {
  const [message, setMessage] = useState('')

  useChannel(WS_CHANNELS.TEST_NOTIFICATIONS, (payload) => {
    setMessage(payload.message)
  })

  return message ? <div className="banner">{message}</div> : null
}
```

With an entity ID:

```tsx
function WhiteboardCanvas({ boardId }: { boardId: string }) {
  useChannel(channelKey(WS_CHANNELS.WHITEBOARD, boardId), (data) => {
    // Handle whiteboard update
  })

  return <canvas />
}
```

### `subscribe` function (non-React)

For use outside of React components:

```ts
import { subscribe } from '../lib/ws'
import { WS_CHANNELS } from '@repo/shared/ws'

const unsubscribe = subscribe(WS_CHANNELS.TEST_NOTIFICATIONS, (payload) => {
  console.log('Got:', payload)
})

// Later:
unsubscribe()
```

### Connection behavior

- The WebSocket connection is a **singleton** — all `useChannel` hooks share one connection.
- The connection opens lazily when the first channel is subscribed.
- The connection closes when the last channel is unsubscribed.
- On disconnect, it **reconnects automatically** with exponential backoff (1s → 2s → 4s → ... → 30s max).
- On reconnect, all active subscriptions are re-sent automatically.

### Environment

The frontend derives the WebSocket URL from `VITE_API_URL` by replacing `http` with `ws`:

```
VITE_API_URL=http://localhost:3001    →  ws://localhost:3001/ws
VITE_API_URL=https://api.myapp.com    →  wss://api.myapp.com/ws
```

No additional env var needed.

## Testing locally

### 1. Start the server

```bash
docker compose up -d    # Postgres + Redis
pnpm dev                # Server + frontend
```

### 2. Connect with wscat

```bash
npx wscat -c ws://localhost:3001/ws
```

Once connected, subscribe to a channel:

```json
{"type":"subscribe","channel":"test-notifications"}
```

### 3. Send a test event

From another terminal:

```bash
curl -X POST http://localhost:3001/api/test/ws \
  -H 'Content-Type: application/json' \
  -d '{"message":"hello from curl"}'
```

You should see the message appear in the wscat terminal:

```json
{"channel":"test-notifications","payload":{"message":"hello from curl"}}
```

### 4. Test from the frontend

Use the `useChannel` hook in any component and trigger a broadcast from the backend (via an API call, a background job, or the test endpoint).

## Adding a new channel

1. Add the channel name to `WS_CHANNELS` in `packages/shared/src/ws/index.ts`:

   ```ts
   export const WS_CHANNELS = {
     TEST_NOTIFICATIONS: 'test-notifications',
     WHITEBOARD: 'whiteboard',  // new
   } as const
   ```

2. **Backend** — call `broadcast()` wherever the event originates:

   ```ts
   await broadcast(
     { channel: WS_CHANNELS.WHITEBOARD, entityId: boardId },
     { action: 'cursor-move', x: 100, y: 200 },
   )
   ```

3. **Frontend** — subscribe with `useChannel`:

   ```tsx
   useChannel(channelKey(WS_CHANNELS.WHITEBOARD, boardId), (data) => {
     // Handle event
   })
   ```

That's it. The channel is typed end-to-end — typos in channel names are caught at compile time.

## Production / Docker

WebSockets run on the **same port** as the HTTP server. No changes to the Dockerfile or additional services are needed. Railway and Fly.io both support WebSocket connections natively.

The only consideration for scaling: if you run multiple server instances, Redis Pub/Sub is already configured to broadcast across all of them. Just make sure all instances point to the same `REDIS_URL`.
