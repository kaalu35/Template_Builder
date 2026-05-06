// src/components/shared/ErrorAlert.tsx

interface Props {
  message: string;
  onRetry?: () => void; // optional retry button
}

export default function ErrorAlert({ message, onRetry }: Props) {
  return (
    <div style={styles.wrapper}>
      <span style={styles.icon}>⚠</span>
      <div style={styles.content}>
        <p style={styles.message}>{message}</p>
        {onRetry && (
          <button onClick={onRetry} style={styles.retryBtn}>
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    padding: '14px 16px',
    margin: '24px 0',
  },
  icon: {
    fontSize: '18px',
    color: '#ef4444',
    flexShrink: 0,
    marginTop: '1px',
  },
  content: {
    flex: 1,
  },
  message: {
    fontSize: '14px',
    color: '#b91c1c',
    lineHeight: 1.5,
  },
  retryBtn: {
    marginTop: '8px',
    background: 'none',
    border: '1px solid #fca5a5',
    borderRadius: '5px',
    color: '#b91c1c',
    fontSize: '13px',
    padding: '4px 12px',
    cursor: 'pointer',
  },
};
