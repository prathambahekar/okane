import { Search } from 'lucide-react';

interface Props {
  onClick: () => void;
  hasAIAssistant?: boolean;
}

export default function FloatingSearchButton({ onClick, hasAIAssistant = false }: Props) {
  return (
    <button
      type="button"
      id="floating-search-btn"
      onClick={onClick}
      style={{
        position: 'fixed',
        bottom: hasAIAssistant ? 'calc(env(safe-area-inset-bottom, 0px) + 138px)' : 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
        right: '16px',
        width: '46px',
        height: '46px',
        borderRadius: '50%',
        backgroundColor: 'var(--surface2)',
        color: 'var(--text)',
        border: '1px solid var(--border)',
        boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        zIndex: 998,
        transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.backgroundColor = 'var(--surface3)';
        e.currentTarget.style.borderColor = 'var(--accent)';
        e.currentTarget.style.color = 'var(--accent)';
        e.currentTarget.style.transform = 'scale(1.08)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.backgroundColor = 'var(--surface2)';
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.color = 'var(--text)';
        e.currentTarget.style.transform = 'none';
      }}
      onMouseDown={e => {
        e.currentTarget.style.transform = 'scale(0.95)';
      }}
      title="Quick Search (Ctrl + K)"
      aria-label="Quick Search"
    >
      <Search size={19} />
    </button>
  );
}
