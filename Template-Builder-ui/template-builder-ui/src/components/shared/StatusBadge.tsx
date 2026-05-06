// src/components/shared/StatusBadge.tsx

import type { TemplateStatus } from '../../types/api';

interface Props {
  status: TemplateStatus | string;
}

// Color map: each status gets its own background + text color
const STATUS_STYLES: Record<string, React.CSSProperties> = {
  draft: {
    backgroundColor: '#fef9c3',
    color: '#854d0e',
    border: '1px solid #fde047',
  },
  published: {
    backgroundColor: '#dcfce7',
    color: '#166534',
    border: '1px solid #86efac',
  },
  archived: {
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: '1px solid #cbd5e1',
  },
};

export default function StatusBadge({ status }: Props) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.archived;

  return (
    <span
      style={{
        ...style,
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: 500,
        textTransform: 'capitalize',
      }}
    >
      {status}
    </span>
  );
}
