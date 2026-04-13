import { defineJob } from '../../lib/queue.js'
import { sendEmail } from '../../lib/email/index.js'
import type { SendEmailParams } from '../../lib/email/index.js'

export default defineJob<'send-email', SendEmailParams>({
  name: 'send-email',
  handler: async (payload) => {
    await sendEmail(payload)
  },
})
