import { useEffect, useRef, useState } from 'react'
import { loginSchema, registerSchema } from '@repo/shared/auth'
import { authClient } from '../lib/auth-client'

type Mode = 'login' | 'register'

interface AuthModalProps {
  mode: Mode
  onClose: () => void
  onSwitchMode: (mode: Mode) => void
}

const googleEnabled = import.meta.env.VITE_OAUTH_GOOGLE === 'true'
const githubEnabled = import.meta.env.VITE_OAUTH_GITHUB === 'true'
const hasOAuth = googleEnabled || githubEnabled

export function AuthModal({ mode, onClose, onSwitchMode }: AuthModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    dialog.showModal()

    function handleClose() {
      onClose()
    }
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [onClose])

  function resetForm() {
    setName('')
    setEmail('')
    setPassword('')
    setErrors({})
    setServerError('')
  }

  function handleSwitch(newMode: Mode) {
    resetForm()
    onSwitchMode(newMode)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    setServerError('')

    const schema = mode === 'login' ? loginSchema : registerSchema
    const data = mode === 'login' ? { email, password } : { name, email, password }

    const result = schema.safeParse(data)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const field = issue.path[0]
        if (field && !fieldErrors[field]) {
          fieldErrors[field] = issue.message
        }
      }
      setErrors(fieldErrors)
      return
    }

    setLoading(true)

    if (mode === 'login') {
      const { error } = await authClient.signIn.email({
        email: result.data.email,
        password: result.data.password,
      })
      setLoading(false)
      if (error) {
        setServerError(error.message ?? 'Login failed')
        return
      }
    } else {
      const parsed = result.data as { name: string; email: string; password: string }
      const { error } = await authClient.signUp.email({
        name: parsed.name,
        email: parsed.email,
        password: parsed.password,
      })
      setLoading(false)
      if (error) {
        setServerError(error.message ?? 'Registration failed')
        return
      }
    }

    onClose()
    window.location.href = '/dashboard'
  }

  return (
    <dialog ref={dialogRef} style={styles.dialog} onClick={(e) => {
      if (e.target === dialogRef.current) dialogRef.current?.close()
    }}>
      <div style={styles.content}>
        <div style={styles.header}>
          <h2 style={styles.title}>{mode === 'login' ? 'Log in' : 'Create account'}</h2>
          <button style={styles.closeBtn} onClick={() => dialogRef.current?.close()}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {serverError && <div style={styles.serverError}>{serverError}</div>}

          {mode === 'register' && (
            <div style={styles.field}>
              <label style={styles.label} htmlFor="auth-name">Name</label>
              <input
                id="auth-name"
                style={styles.input}
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {errors.name && <span style={styles.fieldError}>{errors.name}</span>}
            </div>
          )}

          <div style={styles.field}>
            <label style={styles.label} htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              style={styles.input}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {errors.email && <span style={styles.fieldError}>{errors.email}</span>}
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              style={styles.input}
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {errors.password && <span style={styles.fieldError}>{errors.password}</span>}
          </div>

          <button type="submit" style={styles.submitBtn} disabled={loading}>
            {loading
              ? (mode === 'login' ? 'Logging in...' : 'Creating account...')
              : (mode === 'login' ? 'Log in' : 'Create account')}
          </button>
        </form>

        {hasOAuth && (
          <>
            <div style={styles.divider}>
              <span style={styles.dividerLine} />
              <span style={styles.dividerText}>or</span>
              <span style={styles.dividerLine} />
            </div>

            <div style={styles.oauthButtons}>
              {googleEnabled && (
                <button
                  style={{ ...styles.oauthBtn, cursor: 'pointer', opacity: 1 }}
                  onClick={() => authClient.signIn.social({ provider: 'google', callbackURL: '/dashboard' })}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" style={{ marginRight: '8px' }}>
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>
              )}
              {githubEnabled && (
                <button
                  style={{ ...styles.oauthBtn, cursor: 'pointer', opacity: 1 }}
                  onClick={() => authClient.signIn.social({ provider: 'github', callbackURL: '/dashboard' })}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" style={{ marginRight: '8px' }}>
                    <path fill="#333" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                  </svg>
                  Continue with GitHub
                </button>
              )}
            </div>
          </>
        )}

        <div style={styles.footer}>
          {mode === 'login' ? (
            <span>
              Don't have an account?{' '}
              <button style={styles.switchBtn} onClick={() => handleSwitch('register')}>
                Register
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{' '}
              <button style={styles.switchBtn} onClick={() => handleSwitch('login')}>
                Log in
              </button>
            </span>
          )}
        </div>
      </div>
    </dialog>
  )
}

const styles: Record<string, React.CSSProperties> = {
  dialog: {
    border: 'none',
    borderRadius: '12px',
    padding: 0,
    maxWidth: '420px',
    width: '100%',
    boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
  },
  content: {
    padding: '32px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  title: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#111827',
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#6b7280',
    padding: '4px',
    lineHeight: 1,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  label: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#374151',
  },
  input: {
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.15s',
  },
  fieldError: {
    fontSize: '13px',
    color: '#dc2626',
  },
  serverError: {
    padding: '10px 12px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    color: '#dc2626',
    fontSize: '14px',
  },
  submitBtn: {
    padding: '10px 16px',
    backgroundColor: '#111827',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '4px',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    margin: '24px 0',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    fontSize: '13px',
    color: '#9ca3af',
  },
  oauthButtons: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  oauthBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 16px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    backgroundColor: '#fff',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'not-allowed',
    color: '#374151',
    opacity: 0.6,
  },
  footer: {
    textAlign: 'center',
    marginTop: '20px',
    fontSize: '14px',
    color: '#6b7280',
  },
  switchBtn: {
    background: 'none',
    border: 'none',
    color: '#111827',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '14px',
    textDecoration: 'underline',
  },
}
