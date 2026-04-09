import { Queue, Worker } from 'bullmq'
import { redis } from './redis.js'

const QUEUE_NAME = 'default'

const queue = new Queue(QUEUE_NAME, { connection: redis })

// --- Job definition helper ---

export interface JobDefinition<N extends string = string, P = unknown> {
  name: N
  handler: (payload: P) => Promise<void>
}

export function defineJob<N extends string, P>(
  definition: JobDefinition<N, P>,
): JobDefinition<N, P> {
  return definition
}

// --- Internal registry ---

const handlers = new Map<string, (payload: any) => Promise<void>>()

export function registerJobs(jobs: JobDefinition[]) {
  for (const job of jobs) {
    handlers.set(job.name, job.handler)
  }
}

// --- Public API ---

export async function doLater<K extends string>(
  name: K,
  payload: DoLaterPayload<K>,
) {
  await queue.add(name, payload)
}

// This type is overridden by the module augmentation in jobs/index.ts
export interface JobMap {}

type DoLaterPayload<K extends string> = K extends keyof JobMap
  ? JobMap[K]
  : never

// --- Worker ---

export function startWorker() {
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const handler = handlers.get(job.name)
      if (!handler) {
        console.warn(`[queue] No handler registered for job: ${job.name}`)
        return
      }
      await handler(job.data)
    },
    { connection: redis },
  )

  worker.on('completed', (job) => {
    console.log(`[queue] Job completed: ${job.name} (${job.id})`)
  })

  worker.on('failed', (job, err) => {
    console.error(`[queue] Job failed: ${job?.name} (${job?.id})`, err.message)
  })

  console.log('[queue] Worker started')
  return worker
}
