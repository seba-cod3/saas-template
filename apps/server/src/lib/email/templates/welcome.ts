export interface WelcomeEmailData {
  name: string
  appName?: string
}

export function welcomeEmail(data: WelcomeEmailData): {
  subject: string
  html: string
  text: string
} {
  const appName = data.appName ?? 'My App'

  return {
    subject: `Welcome to ${appName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>Welcome, ${data.name}!</h1>
        <p>Your account is ready. Start exploring ${appName}.</p>
      </div>
    `,
    text: `Welcome, ${data.name}! Your account is ready. Start exploring ${appName}.`,
  }
}
