import { getTransporter } from './transporter.js'

export interface SendEmailParams {
  to: string
  subject: string
  html: string
  text?: string
  replyTo?: string
}

export async function sendEmail(params: SendEmailParams): Promise<void> {
  const transporter = getTransporter()
  const from = process.env.SMTP_FROM ?? 'noreply@localhost'

  await transporter.sendMail({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
    replyTo: params.replyTo,
  })
}
