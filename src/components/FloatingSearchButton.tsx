import { Search, Sparkles } from 'lucide-react';
import Box from '@mui/material/Box';

interface Props {
  onClick: () => void;
  hasAIAssistant?: boolean;
  onAIClick?: () => void;
}

export default function FloatingSearchButton({ onClick, hasAIAssistant = false, onAIClick }: Props) {
  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: { xs: 'calc(76px + env(safe-area-inset-bottom, 0px))', sm: '24px' },
        right: { xs: '16px', sm: '24px' },
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        zIndex: 998,
        pointerEvents: 'none',
      }}
    >
      <div id="floating-extra-actions-slot" style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }} />

      {/* Floating Search Button */}
      <button
        type="button"
        id="floating-search-btn"
        onClick={onClick}
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: 'var(--surface2)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.4), 0 2px 6px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          pointerEvents: 'auto',
          transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease',
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
        <Search size={20} />
      </button>

      {/* Floating Voice AI Assistant Trigger */}
      {hasAIAssistant && onAIClick && (
        <button
          type="button"
          onClick={onAIClick}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent)',
            color: 'var(--accent-contrast, #ffffff)',
            border: 'none',
            boxShadow: '0 6px 20px var(--accent-soft), 0 2px 6px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            pointerEvents: 'auto',
            transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.08) rotate(10deg)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'none';
          }}
          onMouseDown={e => {
            e.currentTarget.style.transform = 'scale(0.95)';
          }}
          title="Ask Max Assistant"
          aria-label="Ask Max Assistant"
        >
          <Sparkles size={21} />
        </button>
      )}
    </Box>
  );
}


