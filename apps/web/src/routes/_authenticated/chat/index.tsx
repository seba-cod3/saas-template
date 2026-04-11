import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/chat/')({
  component: ChatIndex,
})

function ChatIndex() {
  return (
    <div style={styles.empty}>
      <p style={styles.hint}>Select a conversation or start a new one.</p>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  empty: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  hint: {
    fontSize: '15px',
    color: '#9ca3af',
  },
}
