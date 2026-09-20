import { Search, Sparkles } from 'lucide-react';
import Box from '@mui/material/Box';

interface Props {
  onClick: () => void;
  hasAIAssistant?: boolean;
  onAIClick?: () => void;
  hideSearchButton?: boolean;
}

export default function FloatingSearchButton({ onClick, hasAIAssistant = false, onAIClick, hideSearchButton = false }: Props) {
  if (hideSearchButton && !hasAIAssistant) return null;

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
      {!hideSearchButton && (
        <button
          type="button"
          id="floating-search-btn"
          className="floating-action-btn"
          onClick={onClick}
          style={{
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent)',
            color: 'var(--accent-contrast)',
            border: '1px solid var(--accent-border-soft)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            pointerEvents: 'auto',
            transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.08)';
            e.currentTarget.style.boxShadow = '0 12px 28px -2px rgba(0, 0, 0, 0.55), 0 4px 12px rgba(0, 0, 0, 0.35)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = '0 8px 24px -4px rgba(0, 0, 0, 0.45), 0 2px 8px rgba(0, 0, 0, 0.3)';
          }}
          onMouseDown={e => {
            e.currentTarget.style.transform = 'scale(0.95)';
          }}
          title="Quick Search (Ctrl + K)"
          aria-label="Quick Search"
        >
          <Search size={21} />
        </button>
      )}

      {/* Floating Voice AI Assistant Trigger */}
      {hasAIAssistant && onAIClick && (
        <button
          type="button"
          className="floating-action-btn"
          onClick={onAIClick}
          style={{
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent)',
            color: 'var(--accent-contrast)',
            border: '1px solid var(--accent-border-soft)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            pointerEvents: 'auto',
            transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease, background-color 0.2s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.08) rotate(8deg)';
            e.currentTarget.style.boxShadow = '0 12px 28px -2px rgba(0, 0, 0, 0.55), 0 4px 12px rgba(0, 0, 0, 0.35)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = '0 8px 24px -2px rgba(0, 0, 0, 0.45), 0 2px 8px rgba(0, 0, 0, 0.3)';
          }}
          onMouseDown={e => {
            e.currentTarget.style.transform = 'scale(0.95)';
          }}
          title="Ask Max Assistant"
          aria-label="Ask Max Assistant"
        >
          <Sparkles size={22} />
        </button>
      )}
    </Box>
  );
}


