import type { WSContext } from 'hono/ws'
import { Redis as IORedis } from 'ioredis'
import { channelKey } from '@repo/shared/ws'
import type { WsChannel, WsClientMessage, WsEnvelope } from '@repo/shared/ws'

const REDIS_PREFIX = 'ws:'

// ---- Client tracking ----

interface ConnectedClient {
  ws: WSContext
  channels: Set<string>
}

const clients = new Set<ConnectedClient>()
const wsToClient = new WeakMap<WSContext, ConnectedClient>()

export function registerClient(ws: WSContext): void {
  const client: ConnectedClient = { ws, channels: new Set() }
  clients.add(client)
  wsToClient.set(ws, client)
}

export function unregisterClient(ws: WSContext): void {
  const client = wsToClient.get(ws)
  if (client) {
    clients.delete(client)
    wsToClient.delete(ws)
  }
}

/** Local WS client counts (this process only — multi-instance stats need Redis). */
export function getLocalWsStats(): { clients: number; subscriptions: number } {
  let subscriptions = 0
  for (const c of clients) subscriptions += c.channels.size
  return { clients: clients.size, subscriptions }
}

export function handleClientMessage(ws: WSContext, raw: string): void {
  const client = wsToClient.get(ws)
  if (!client) return

  try {
    const msg: WsClientMessage = JSON.parse(raw)
    if (msg.type === 'subscribe') {
      client.channels.add(msg.channel)
      ensureRedisSubscription(msg.channel)
    } else if (msg.type === 'unsubscribe') {
      client.channels.delete(msg.channel)
    }
  } catch {
    // Invalid message, ignore
  }
}

// ---- Redis Pub/Sub ----
// Subscriber connection is separate because ioredis enters subscriber mode

let subscriber: IORedis | null = null
const subscribedChannels = new Set<string>()

function getSubscriber(): IORedis {
  if (!subscriber) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
    subscriber = new IORedis(redisUrl, { maxRetriesPerRequest: null })

    subscriber.on('message', (redisChannel: string, message: string) => {
      const channel = redisChannel.slice(REDIS_PREFIX.length)
      for (const client of clients) {
        if (client.channels.has(channel)) {
          try {
            client.ws.send(message)
          } catch {
            // Client disconnected — cleaned up on close
          }
        }
      }
    })
  }
  return subscriber
}

function ensureRedisSubscription(channel: string): void {
  const redisChannel = `${REDIS_PREFIX}${channel}`
  if (!subscribedChannels.has(redisChannel)) {
    subscribedChannels.add(redisChannel)
    getSubscriber().subscribe(redisChannel)
  }
}

// ---- Public API ----

export interface BroadcastTarget {
  channel: WsChannel
  entityId?: string
}

/** Send a message to all clients subscribed to the target channel. */
export async function broadcast<T = unknown>(
  target: BroadcastTarget,
  payload: T,
): Promise<void> {
  const fullChannel = channelKey(target.channel, target.entityId)
  const envelope: WsEnvelope<T> = { channel: fullChannel, payload }
  const message = JSON.stringify(envelope)

  // Publish via Redis so all server instances receive it
  const { redis } = await import('./redis.js')
  await redis.publish(`${REDIS_PREFIX}${fullChannel}`, message)
}
