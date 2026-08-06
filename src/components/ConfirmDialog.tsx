import { createPortal } from 'react-dom';
import { X, AlertTriangle, Trash2, HelpCircle } from 'lucide-react';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmDialog({ title, message, confirmLabel = 'Delete', danger = true, onConfirm, onClose }: Props) {
  const isDeleteAction = confirmLabel.toLowerCase().includes('delete') || confirmLabel.toLowerCase().includes('remove');

  return createPortal(
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal confirm-modal" onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)' }}>
        <div className="modal-header" style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)', background: 'transparent' }}>
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
            className="btn-icon"
            onClick={onClose}
            style={{ borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="confirm-body" style={{ padding: '18px 20px 14px', background: 'transparent' }}>
          <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>
            {message}
          </p>
        </div>

        <div className="confirm-actions" style={{ padding: '14px 20px 18px', background: 'transparent', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: 8, fontWeight: 600, fontSize: 13 }}
          >
            Cancel
          </button>
          <button
            className="btn btn-sm"
            onClick={() => { onConfirm(); onClose(); }}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 13,
              border: 'none',
              background: danger ? 'var(--debit-gradient)' : 'var(--accent-gradient)',
              color: '#ffffff',
              boxShadow: danger
                ? '0 4px 14px rgba(239, 68, 68, 0.35)'
                : '0 4px 14px rgba(30, 136, 229, 0.35)',
              cursor: 'pointer',
              transition: 'transform 0.15s ease, opacity 0.15s ease',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
