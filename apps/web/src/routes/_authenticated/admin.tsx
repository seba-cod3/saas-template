import { createFileRoute, Link, Outlet, redirect } from '@tanstack/react-router'
import { canAccessBackoffice } from '@repo/shared/auth'

export const Route = createFileRoute('/_authenticated/admin')({
  beforeLoad: ({ context }) => {
    if (!canAccessBackoffice(context.session.user.role)) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: AdminLayout,
})

function AdminLayout() {
  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.sidebarTitle}>Backoffice</div>
        <nav style={styles.nav}>
          <Link
            to="/admin"
            activeOptions={{ exact: true }}
            style={styles.navLink}
            activeProps={{ style: { ...styles.navLink, ...styles.navLinkActive } }}
          >
            Users
          </Link>
          <Link
            to="/admin/health"
            style={styles.navLink}
            activeProps={{ style: { ...styles.navLink, ...styles.navLinkActive } }}
          >
            Health
          </Link>
        </nav>
      </aside>
      <main style={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    display: 'grid',
    gridTemplateColumns: '220px 1fr',
    minHeight: 'calc(100vh - 65px)',
  },
  sidebar: {
    borderRight: '1px solid #e5e7eb',
    padding: '24px 16px',
    backgroundColor: '#fafafa',
  },
  sidebarTitle: {
    fontSize: '12px',
    textTransform: 'uppercase',
    color: '#9ca3af',
    letterSpacing: '0.05em',
    marginBottom: '16px',
    fontWeight: 600,
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  navLink: {
    display: 'block',
    padding: '8px 12px',
    borderRadius: '6px',
    color: '#374151',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 500,
  },
  navLinkActive: {
    backgroundColor: '#111827',
    color: '#fff',
  },
  main: {
    padding: '32px',
    overflowX: 'auto',
  },
}
