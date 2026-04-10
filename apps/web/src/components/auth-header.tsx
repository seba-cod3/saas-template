import { useRef, useState } from 'react'
import { canAccessBackoffice } from '@repo/shared/auth'
import { authClient } from '../lib/auth-client'
import { AuthModal } from './auth-modal'

export function AuthHeader() {
  const { data: session, isPending } = authClient.useSession()
  const [modal, setModal] = useState<'login' | 'register' | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  function getInitials(name: string) {
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  async function handleLogout() {
    await authClient.signOut()
    setDropdownOpen(false)
    window.location.href = '/'
  }

  return (
    <header style={styles.header}>
      <a href="/" style={styles.logo}>SaaS Template</a>

      <div style={styles.right}>
        {isPending ? (
          <span style={styles.loadingDot} />
        ) : session ? (
          <div style={styles.avatarContainer} ref={dropdownRef}>
            <button
              style={styles.avatar}
              onClick={() => setDropdownOpen(!dropdownOpen)}
              aria-label="User menu"
            >
              {getInitials(session.user.name)}
            </button>

            {dropdownOpen && (
              <>
                <div
                  style={styles.backdrop}
                  onClick={() => setDropdownOpen(false)}
                />
                <div style={styles.dropdown}>
                  <div style={styles.dropdownHeader}>
                    <strong>{session.user.name}</strong>
                    <span style={styles.dropdownEmail}>{session.user.email}</span>
                  </div>
                  <div style={styles.dropdownDivider} />
                  <button
                    style={{ ...styles.dropdownItem, opacity: 0.5, cursor: 'not-allowed' }}
                    disabled
                  >
                    Profile
                  </button>
                  <a
                    href="/dashboard"
                    style={{ ...styles.dropdownItem, textDecoration: 'none' }}
                    onClick={() => setDropdownOpen(false)}
                  >
                    Dashboard
                  </a>
                  {canAccessBackoffice(session.user.role) && (
                    <a
                      href="/admin"
                      style={{
                        ...styles.dropdownItem,
                        color: '#7c3aed',
                        fontWeight: 600,
                        textDecoration: 'none',
                      }}
                      onClick={() => setDropdownOpen(false)}
                    >
                      Admin
                    </a>
                  )}
                  <button style={styles.dropdownItem} onClick={handleLogout}>
                    Log out
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={styles.buttons}>
            <button style={styles.loginBtn} onClick={() => setModal('login')}>
              Log in
            </button>
            <button style={styles.registerBtn} onClick={() => setModal('register')}>
              Register
            </button>
          </div>
        )}
      </div>

      {modal && (
        <AuthModal
          mode={modal}
          onClose={() => setModal(null)}
          onSwitchMode={(mode) => setModal(mode)}
        />
      )}
    </header>
  )
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 24px',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#fff',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  logo: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#111827',
    textDecoration: 'none',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  loadingDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#d1d5db',
  },
  buttons: {
    display: 'flex',
    gap: '8px',
  },
  loginBtn: {
    padding: '8px 16px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    backgroundColor: '#fff',
    color: '#374151',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
  },
  registerBtn: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: '6px',
    backgroundColor: '#111827',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#111827',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 199,
  },
  dropdown: {
    position: 'absolute',
    right: 0,
    top: 'calc(100% + 8px)',
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
    minWidth: '200px',
    zIndex: 200,
    overflow: 'hidden',
  },
  dropdownHeader: {
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  dropdownEmail: {
    fontSize: '13px',
    color: '#6b7280',
  },
  dropdownDivider: {
    height: '1px',
    backgroundColor: '#e5e7eb',
  },
  dropdownItem: {
    display: 'block',
    width: '100%',
    padding: '10px 16px',
    border: 'none',
    backgroundColor: 'transparent',
    textAlign: 'left' as const,
    cursor: 'pointer',
    fontSize: '14px',
    color: '#374151',
  },
}
