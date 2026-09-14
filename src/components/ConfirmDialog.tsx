import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { X, AlertTriangle, Trash2, HelpCircle } from 'lucide-react';

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
  const isDeleteAction = confirmLabel.toLowerCase().includes('delete') || confirmLabel.toLowerCase().includes('remove');

  return createPortal(
    <div className="modal-backdrop-motion" style={{ alignItems: 'center', justifyContent: 'center', padding: 16, ...(zIndex ? { zIndex } : {}) }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="modal-backdrop-overlay"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.2 }}
        className="modal confirm-modal modal-dialog-panel"
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--surface)' }}
      >
        <div className="modal-header" style={{ padding: '18px 20px 10px', borderBottom: 'none', background: 'transparent' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: danger ? 'var(--debit-bg)' : 'var(--accent-soft)',
                color: danger ? 'var(--debit)' : 'var(--accent)',
                border: danger ? '1px solid var(--debit-border)' : '1px solid var(--border2)',
                flexShrink: 0,
              }}
            >
              {danger ? (isDeleteAction ? <Trash2 size={18} /> : <AlertTriangle size={18} />) : <HelpCircle size={18} />}
            </div>
            <span className="modal-title" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
              {title}
            </span>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 9999, display: 'grid', placeItems: 'center', cursor: 'pointer' }}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="confirm-body" style={{ padding: '14px 20px 14px', background: 'transparent' }}>
          <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>
            {message}
          </p>
        </div>

        <div className="confirm-actions" style={{ padding: '10px 20px 18px', background: 'transparent', borderTop: 'none', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{ height: 40, padding: '0 20px', borderRadius: 9999, fontWeight: 650, fontSize: 13, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => { onConfirm(); onClose(); }}
            style={{
              height: 40,
              padding: '0 22px',
              borderRadius: 9999,
              fontWeight: 700,
              fontSize: 13,
              border: danger ? '1px solid var(--debit-border)' : '1px solid var(--text)',
              background: danger ? 'var(--debit-bg)' : 'var(--text)',
              color: danger ? 'var(--debit)' : 'var(--bg)',
              boxShadow: danger
                ? '0 2px 8px rgba(239, 68, 68, 0.2)'
                : '0 2px 8px rgba(0, 0, 0, 0.2)',
              cursor: 'pointer',
              transition: 'transform 0.15s ease, opacity 0.15s ease',
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
