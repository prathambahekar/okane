import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FileText, X, Check, Trash2 } from 'lucide-react';
import { useBackButtonModal, BackPriority } from '../../utils/backHandler';

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
  useBackButtonModal(isOpen, onClose, { priority: BackPriority.DIALOG });

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
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Removed auto-focus effect on open so keyboard does not auto-open on mobile

  const handleTagClick = (tag: string) => {
    if (!tempNote.trim()) {
      setTempNote(tag);
    } else if (tempNote.includes(tag)) {
      // Toggle off if only this tag or remove from note
      const cleaned = tempNote
        .replace(new RegExp(`(^|,\\s*)${tag}(,\\s*|$)`, 'g'), ', ')
        .replace(/^,\s*|,\s*$/g, '')
        .trim();
      setTempNote(cleaned);
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

  const isTagActive = (tag: string) => {
    return tempNote.toLowerCase().includes(tag.toLowerCase());
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
        style={{
          background: 'var(--surface)',
          color: 'var(--text)',
        }}
      >
        {/* Mobile handle indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 2 }}>
          <div style={{ width: 38, height: 4.5, borderRadius: 999, backgroundColor: 'var(--border2, var(--text-3))', opacity: 0.5 }} />
        </div>

        {/* Modal Header */}
        <div
          style={{
            padding: '12px 18px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
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
              <FileText size={16} strokeWidth={2.2} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
                {title}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>
                Optional remarks or payment details
              </div>
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
        <div style={{ padding: '0 18px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Note Input with dynamic theme focus border */}
          <div style={{ position: 'relative' }}>
            <textarea
              ref={textareaRef}
              rows={3}
              placeholder={placeholder}
              value={tempNote}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onChange={e => setTempNote(e.target.value)}
              onKeyDown={e => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleSave();
                }
              }}
              style={{
                width: '100%',
                background: 'var(--surface2)',
                border: isFocused ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                borderRadius: 12,
                padding: '12px 14px',
                fontSize: 13.5,
                color: 'var(--text)',
                outline: 'none',
                resize: 'none',
                lineHeight: 1.5,
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                boxShadow: isFocused ? '0 0 0 3px var(--accent-soft)' : 'none',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
              }}
            />
          </div>

          {/* Quick Tags Section */}
          {quickTags && quickTags.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 7, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Quick suggestions
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {quickTags.map(tag => {
                  const active = isTagActive(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleTagClick(tag)}
                      style={{
                        background: active ? 'var(--accent-soft)' : 'var(--surface2)',
                        border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                        color: active ? 'var(--accent)' : 'var(--text-2)',
                        fontSize: 11.5,
                        fontWeight: active ? 650 : 500,
                        padding: '4px 10px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      {active && <Check size={11} strokeWidth={2.5} />}
                      <span>{tag}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 18px 18px',
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
              color: tempNote ? 'var(--danger, #ef4444)' : 'var(--text-3)',
              borderRadius: 9,
              padding: '8px 14px',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: tempNote ? 'pointer' : 'default',
              transition: 'all 0.15s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4.5,
              opacity: tempNote ? 1 : 0.7,
            }}
          >
            <Trash2 size={13} strokeWidth={2} />
            <span>Clear</span>
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={handleSave}
              style={{
                background: 'var(--accent)',
                color: 'var(--accent-contrast, #ffffff)',
                border: 'none',
                borderRadius: 9,
                padding: '8px 16px',
                fontSize: 12.5,
                fontWeight: 650,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}
            >
              <Check size={14} strokeWidth={2.5} />
              <span>Save Note</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
