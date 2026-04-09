import { defineJob } from '../../lib/queue.js'

export default defineJob({
  name: 'example-log',
  handler: async (payload: { message: string }) => {
    console.log(`[job:example-log] ${payload.message}`)
  },
})
