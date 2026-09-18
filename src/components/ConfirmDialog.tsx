import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { X, AlertTriangle, Trash2, HelpCircle } from 'lucide-react';
import { useBackButtonModal, BackPriority } from '../utils/backHandler';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  zIndex?: number;
}

export default function ConfirmDialog({ title, message, confirmLabel = 'Delete', danger = true, onConfirm, onClose, zIndex }: Props) {
  useBackButtonModal(true, onClose, { priority: BackPriority.DIALOG });

  const [isMobileScreen, setIsMobileScreen] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 640);
  useEffect(() => {
    const handleResize = () => setIsMobileScreen(window.innerWidth <= 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isDeleteAction = confirmLabel.toLowerCase().includes('delete') || confirmLabel.toLowerCase().includes('remove');

  return createPortal(
    <div
      className="modal-backdrop-motion"
      style={{
        alignItems: isMobileScreen ? 'flex-end' : 'center',
        justifyContent: 'center',
        padding: isMobileScreen ? 0 : 'var(--space-4)',
        ...(zIndex ? { zIndex } : {}),
      }}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="modal-backdrop-overlay"
        onClick={onClose}
      />
      <motion.div
        initial={isMobileScreen ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 12 }}
        animate={isMobileScreen ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
        exit={isMobileScreen ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: isMobileScreen ? 0.3 : 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="modal confirm-modal modal-dialog-panel"
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          zIndex: 100060,
          background: 'var(--surface)',
          borderRadius: isMobileScreen ? '22px 22px 0 0' : 'var(--radius-xl)',
          borderBottomLeftRadius: isMobileScreen ? 0 : undefined,
          borderBottomRightRadius: isMobileScreen ? 0 : undefined,
          borderBottom: isMobileScreen ? 'none' : '1px solid var(--border)',
          boxShadow: 'var(--shadow-floating)',
          maxWidth: isMobileScreen ? '100%' : 420,
          width: '100%',
          margin: isMobileScreen ? 0 : 'auto',
          boxSizing: 'border-box',
        }}
      >
        {/* Drag handle for mobile drawer */}
        {isMobileScreen && (
          <div
            className="modal-drag-handle"
            style={{
              width: 38,
              height: 4.5,
              borderRadius: 99,
              background: 'var(--border2)',
              margin: '10px auto 4px',
              flexShrink: 0,
            }}
          />
        )}

        <div className="modal-header" style={{ padding: 'var(--space-4) var(--space-5) var(--space-2)', borderBottom: 'none', background: 'transparent' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: danger ? 'var(--debit-bg)' : 'var(--accent-soft)',
                color: danger ? 'var(--debit)' : 'var(--accent)',
                border: danger ? '1px solid var(--debit-border)' : '1px solid var(--border)',
                flexShrink: 0,
              }}
            >
              {danger ? (isDeleteAction ? <Trash2 size={18} /> : <AlertTriangle size={18} />) : <HelpCircle size={18} />}
            </div>
            <span className="modal-title" style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--text)' }}>
              {title}
            </span>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 'var(--radius-full)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="confirm-body" style={{ padding: 'var(--space-2) var(--space-5) var(--space-4)', background: 'transparent' }}>
          <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-2)', lineHeight: 1.5, margin: 0 }}>
            {message}
          </p>
        </div>

        <div
          className="confirm-actions"
          style={{
            padding: isMobileScreen
              ? 'var(--space-2) var(--space-5) calc(var(--space-5) + env(safe-area-inset-bottom, 0px))'
              : 'var(--space-2) var(--space-5) var(--space-5)',
            background: 'transparent',
            borderTop: 'none',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--space-2)',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{
              width: '100%',
              height: 42,
              padding: '0 var(--space-2)',
              borderRadius: 'var(--radius-full)',
              fontWeight: 'var(--fw-semibold)',
              fontSize: 'var(--fs-sm)',
              border: '1px solid var(--border)',
              background: 'var(--surface2)',
              color: 'var(--text)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              whiteSpace: 'nowrap',
              boxSizing: 'border-box',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => { onConfirm(); onClose(); }}
            style={{
              width: '100%',
              height: 42,
              padding: '0 var(--space-2)',
              borderRadius: 'var(--radius-full)',
              fontWeight: 'var(--fw-bold)',
              fontSize: 'var(--fs-sm)',
              border: danger ? '1px solid var(--debit-border)' : '1px solid var(--text)',
              background: danger ? 'var(--debit-bg)' : 'var(--text)',
              color: danger ? 'var(--debit)' : 'var(--bg)',
              boxShadow: 'var(--shadow)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              whiteSpace: 'nowrap',
              transition: 'transform 0.15s ease, opacity 0.15s ease',
              boxSizing: 'border-box',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
