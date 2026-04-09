import { registerJobs } from '../lib/queue.js'
import type { JobDefinition } from '../lib/queue.js'
import { allJobs } from './definitions/index.js'

type DeriveJobMap<T extends readonly JobDefinition<string, any>[]> = {
  [J in T[number] as J extends JobDefinition<infer N, any> ? N : never]:
    J extends JobDefinition<string, infer P> ? P : never
}

declare module '../lib/queue.js' {
  interface JobMap extends DeriveJobMap<typeof allJobs> {}
}

registerJobs([...allJobs] as JobDefinition[])
