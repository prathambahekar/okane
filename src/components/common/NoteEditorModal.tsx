import { useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, X } from 'lucide-react';

export interface NoteEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  initialNote: string;
  onSave: (note: string) => void;
  placeholder?: string;
  quickTags?: string[];
}

export function NoteEditorModal({
  isOpen,
  onClose,
  title = 'Note',
  initialNote,
  onSave,
  placeholder = 'Add optional notes or remarks...',
  quickTags = ['Roommate', 'Family', 'Office colleague', 'Splitwise friend', 'UPI ID'],
}: NoteEditorModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <NoteEditorContent
      key={initialNote}
      onClose={onClose}
      title={title}
      initialNote={initialNote}
      onSave={onSave}
      placeholder={placeholder}
      quickTags={quickTags}
    />,
    document.body
  );
}

interface ContentProps {
  onClose: () => void;
  title: string;
  initialNote: string;
  onSave: (note: string) => void;
  placeholder: string;
  quickTags: string[];
}

function NoteEditorContent({
  onClose,
  title,
  initialNote,
  onSave,
  placeholder,
  quickTags,
}: ContentProps) {
  const [tempNote, setTempNote] = useState(initialNote);

  const handleTagClick = (tag: string) => {
    if (!tempNote.trim()) {
      setTempNote(tag);
    } else if (tempNote.includes(tag)) {
      // Do nothing if tag is already included
    } else {
      setTempNote(prev => `${prev.trim()}, ${tag}`);
    }
  };

  const handleClear = () => {
    setTempNote('');
    onSave('');
    onClose();
  };

  const handleSave = () => {
    onSave(tempNote.trim());
    onClose();
  };

  return (
    <div
      className="note-drawer-overlay"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="note-drawer-panel"
        onClick={e => e.stopPropagation()}
      >
        {/* Mobile handle indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 2 }}>
          <div style={{ width: 38, height: 4.5, borderRadius: 999, backgroundColor: 'var(--text-3)', opacity: 0.35 }} />
        </div>

        {/* Modal Header */}
        <div
          style={{
            padding: '12px 20px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <FileText size={16} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
              {title}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: 'var(--text-2)',
              cursor: 'pointer',
              width: 30,
              height: 30,
              borderRadius: 8,
              display: 'grid',
              placeItems: 'center',
              padding: 0,
              transition: 'all 0.15s ease',
            }}
            aria-label="Close note dialog"
          >
            <X size={15} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Note Input with accent border */}
          <div style={{ position: 'relative' }}>
            <textarea
              rows={3}
              placeholder={placeholder}
              value={tempNote}
              onChange={e => setTempNote(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--surface2)',
                border: '1.5px solid var(--accent)',
                borderRadius: 12,
                padding: '12px 14px',
                fontSize: 13.5,
                color: 'var(--text)',
                outline: 'none',
                resize: 'none',
                lineHeight: 1.5,
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                boxShadow: '0 0 0 1px var(--accent-border-soft, rgba(236,72,153,0.15))',
              }}
              autoFocus
            />
          </div>

          {/* Quick Tags Section */}
          {quickTags && quickTags.length > 0 && (
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 8, fontWeight: 500 }}>
                Quick tags:
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {quickTags.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleTagClick(tag)}
                    style={{
                      background: tempNote.includes(tag) ? 'var(--accent-soft)' : 'var(--surface2)',
                      border: tempNote.includes(tag) ? '1px solid var(--accent)' : '1px solid var(--border)',
                      color: tempNote.includes(tag) ? 'var(--accent)' : 'var(--text-2)',
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 20px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={handleClear}
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: 'var(--text-2)',
              borderRadius: 10,
              padding: '9px 18px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Clear
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                color: 'var(--text-2)',
                borderRadius: 10,
                padding: '9px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              style={{
                background: 'var(--accent)',
                color: 'var(--accent-contrast, #ffffff)',
                border: 'none',
                borderRadius: 10,
                padding: '9px 18px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s ease',
              }}
            >
              ✓ Save Note
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
