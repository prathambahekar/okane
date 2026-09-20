import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, RotateCcw, Bold, Italic, List, ListOrdered, CheckSquare, Code } from 'lucide-react';
import { useBackButtonModal, BackPriority } from '../../utils/backHandler';
import { showSoftKeyboard } from '../../utils/keyboard';

export interface NoteEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  initialNote?: string;
  onSave: (note: string) => void;
  placeholder?: string;
  quickTags?: string[];
}

/**
 * Escapes HTML entities to prevent malformed tags
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Converts inline markdown tokens to HTML tags
 */
function formatInlineHtml(text: string): string {
  if (!text) return '';
  return escapeHtml(text)
    // Bold: **text** or __text__
    .replace(/(\*\*|__)(.+?)\1/g, '<strong>$2</strong>')
    // Italic: *text* or _text_
    .replace(/(\*|_)(.+?)\1/g, '<em>$2</em>')
    // Strikethrough: ~~text~~
    .replace(/(~~)(.+?)\1/g, '<del>$2</del>')
    // Inline code: `code`
    .replace(/`([^`]+)`/g, '<code style="background:var(--surface3);padding:1px 5px;border-radius:4px;font-family:monospace;font-size:0.9em;border:1px solid var(--border);">$1</code>');
}

/**
 * Converts Markdown string into formatted HTML for the rich-text editor
 */
function markdownToHtml(md: string): string {
  if (!md || !md.trim()) return '';

  const lines = md.split('\n');
  const htmlLines: string[] = [];
  let inUl = false;
  let inOl = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // Checklist task item: - [ ] or - [x]
    const taskMatch = trimmed.match(/^-\s*\[([ xX])\]\s*(.*)$/);
    if (taskMatch) {
      if (inUl) { htmlLines.push('</ul>'); inUl = false; }
      if (inOl) { htmlLines.push('</ol>'); inOl = false; }
      const isChecked = taskMatch[1].toLowerCase() === 'x';
      const text = formatInlineHtml(taskMatch[2]);
      htmlLines.push(
        `<div class="note-task-row" style="display:flex;align-items:center;gap:7px;margin:3px 0;">` +
        `<input type="checkbox" ${isChecked ? 'checked' : ''} style="width:15px;height:15px;accent-color:var(--accent);cursor:pointer;" /> ` +
        `<span style="${isChecked ? 'text-decoration:line-through;opacity:0.7;' : ''}">${text}</span>` +
        `</div>`
      );
      continue;
    }

    // Bullet list: - or *
    const bulletMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      if (inOl) { htmlLines.push('</ol>'); inOl = false; }
      if (!inUl) { htmlLines.push('<ul style="margin:4px 0 4px 20px;padding:0;">'); inUl = true; }
      htmlLines.push(`<li>${formatInlineHtml(bulletMatch[1])}</li>`);
      continue;
    }

    // Numbered list: 1. or 1)
    const numMatch = trimmed.match(/^(\d+)[.)]\s*(.*)$/);
    if (numMatch) {
      if (inUl) { htmlLines.push('</ul>'); inUl = false; }
      if (!inOl) { htmlLines.push('<ol style="margin:4px 0 4px 20px;padding:0;">'); inOl = true; }
      htmlLines.push(`<li>${formatInlineHtml(numMatch[2])}</li>`);
      continue;
    }

    // Close any open lists if current line is regular
    if (inUl) { htmlLines.push('</ul>'); inUl = false; }
    if (inOl) { htmlLines.push('</ol>'); inOl = false; }

    if (!trimmed) {
      htmlLines.push('<div><br></div>');
      continue;
    }

    // Headers
    if (trimmed.startsWith('# ')) {
      htmlLines.push(`<div style="font-size:1.2em;font-weight:700;margin:4px 0;">${formatInlineHtml(trimmed.slice(2))}</div>`);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      htmlLines.push(`<div style="font-size:1.1em;font-weight:650;margin:3px 0;">${formatInlineHtml(trimmed.slice(3))}</div>`);
      continue;
    }
    if (trimmed.startsWith('### ')) {
      htmlLines.push(`<div style="font-size:1.05em;font-weight:600;margin:2px 0;">${formatInlineHtml(trimmed.slice(4))}</div>`);
      continue;
    }

    // Regular line
    htmlLines.push(`<div>${formatInlineHtml(raw)}</div>`);
  }

  if (inUl) htmlLines.push('</ul>');
  if (inOl) htmlLines.push('</ol>');

  return htmlLines.join('');
}

let sharedParser: DOMParser | null = null;

/**
 * Converts DOM HTML from the rich-text editor back into pure Markdown string
 */
function htmlToMarkdown(html: string): string {
  if (!html || !html.trim()) return '';
  if (!sharedParser && typeof DOMParser !== 'undefined') {
    sharedParser = new DOMParser();
  }
  const parser = sharedParser || new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild || doc.body;

  function traverse(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    // Check for task item row
    const checkbox = el.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    if (checkbox && el.classList.contains('note-task-row')) {
      const isChecked = checkbox.checked;
      const textSpan = el.querySelector('span');
      const text = textSpan ? (textSpan.textContent || '').trim() : '';
      return `- [${isChecked ? 'x' : ' '}] ${text}\n`;
    }

    const childNodes = Array.from(el.childNodes);
    const childrenStr = childNodes.map(traverse).join('');

    const isBold = tag === 'strong' || tag === 'b' || el.style.fontWeight === 'bold' || parseInt(el.style.fontWeight, 10) >= 600;
    const isItalic = tag === 'em' || tag === 'i' || el.style.fontStyle === 'italic';
    const isStrike = tag === 'del' || tag === 's' || tag === 'strike' || el.style.textDecoration?.includes('line-through');
    const isCode = tag === 'code';

    if (isBold && childrenStr.trim()) {
      return `**${childrenStr.trim()}**`;
    }
    if (isItalic && childrenStr.trim()) {
      return `*${childrenStr.trim()}*`;
    }
    if (isStrike && childrenStr.trim()) {
      return `~~${childrenStr.trim()}~~`;
    }
    if (isCode && childrenStr.trim()) {
      return `\`${childrenStr.trim()}\``;
    }

    switch (tag) {
      case 'pre':
        return `\`\`\`\n${childrenStr}\n\`\`\`\n`;
      case 'h1':
        return `# ${childrenStr.trim()}\n\n`;
      case 'h2':
        return `## ${childrenStr.trim()}\n\n`;
      case 'h3':
        return `### ${childrenStr.trim()}\n\n`;
      case 'li': {
        const parent = el.parentElement;
        if (parent && parent.tagName.toLowerCase() === 'ol') {
          const idx = Array.from(parent.children).indexOf(el) + 1;
          return `${idx}. ${childrenStr.trim()}\n`;
        }
        return `- ${childrenStr.trim()}\n`;
      }
      case 'ul':
      case 'ol':
        return `${childrenStr}\n`;
      case 'div':
      case 'p':
        if (!childrenStr.trim()) return '\n';
        return `${childrenStr}\n`;
      case 'br':
        return '\n';
      default:
        return childrenStr;
    }
  }

  const result = traverse(root);
  return result.replace(/\n{3,}/g, '\n\n').trim();
}

export function NoteEditorModal({
  isOpen,
  onClose,
  title = 'Note',
  initialNote = '',
  onSave,
  placeholder = 'Add optional notes or remarks...',
  quickTags,
}: NoteEditorModalProps) {
  useBackButtonModal(isOpen, onClose, { priority: BackPriority.DIALOG });

  if (!isOpen) return null;

  return createPortal(
    <NoteEditorContent
      key={isOpen ? `open-${initialNote || ''}` : 'closed'}
      onClose={onClose}
      title={title}
      initialNote={initialNote || ''}
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
  quickTags?: string[];
}

function NoteEditorContent({
  onClose,
  title,
  initialNote = '',
  onSave,
  placeholder,
}: ContentProps) {
  // editorMode: 'text' = Normal user rich-text mode; 'markdown' = Power user raw markdown mode
  const [editorMode, setEditorMode] = useState<'text' | 'markdown'>('text');
  const [tempNote, setTempNote] = useState(initialNote || '');
  const [isFocused, setIsFocused] = useState(false);

  const richEditorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync content into the rich editor on mount
  useEffect(() => {
    if (editorMode === 'text' && richEditorRef.current) {
      richEditorRef.current.innerHTML = markdownToHtml(tempNote);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-focus soft keyboard on initial open
  useEffect(() => {
    const timer = setTimeout(() => {
      if (editorMode === 'text' && richEditorRef.current) {
        showSoftKeyboard(richEditorRef.current, { placeCursorAtEnd: true, scroll: true });
      } else if (editorMode === 'markdown' && textareaRef.current) {
        showSoftKeyboard(textareaRef.current, { placeCursorAtEnd: true, scroll: true });
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [editorMode]);

  const syncDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Synchronize HTML from rich-editor to background Markdown state
  const syncFromRichEditor = useCallback(() => {
    if (syncDebounceTimerRef.current) {
      clearTimeout(syncDebounceTimerRef.current);
      syncDebounceTimerRef.current = null;
    }
    if (!richEditorRef.current) return;
    const md = htmlToMarkdown(richEditorRef.current.innerHTML);
    setTempNote(md);
  }, []);

  const syncFromRichEditorDebounced = useCallback(() => {
    if (syncDebounceTimerRef.current) {
      clearTimeout(syncDebounceTimerRef.current);
    }
    syncDebounceTimerRef.current = setTimeout(() => {
      if (richEditorRef.current) {
        const md = htmlToMarkdown(richEditorRef.current.innerHTML);
        setTempNote(md);
      }
    }, 350);
  }, []);

  useEffect(() => {
    return () => {
      if (syncDebounceTimerRef.current) {
        clearTimeout(syncDebounceTimerRef.current);
      }
    };
  }, []);

  // Handle switching between Text mode and Markdown mode
  const handleToggleMode = () => {
    if (editorMode === 'text') {
      // Switching to Markdown: grab current markdown from rich editor
      if (richEditorRef.current) {
        const md = htmlToMarkdown(richEditorRef.current.innerHTML);
        setTempNote(md);
      }
      setEditorMode('markdown');
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 30);
    } else {
      // Switching to Text: format markdown into HTML and load into rich editor
      setEditorMode('text');
      setTimeout(() => {
        if (richEditorRef.current) {
          richEditorRef.current.innerHTML = markdownToHtml(tempNote);
          richEditorRef.current.focus();
        }
      }, 30);
    }
  };

  // Helper for inserting formatting into raw textarea (Markdown mode)
  const insertTextareaFormatting = (prefix: string, suffix: string = '', defaultPlaceholder: string = '') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const selected = tempNote.substring(start, end) || defaultPlaceholder;
    const replacement = `${prefix}${selected}${suffix}`;
    const updated = tempNote.substring(0, start) + replacement + tempNote.substring(end);
    setTempNote(updated);

    setTimeout(() => {
      el.focus();
      const cursorStart = start + prefix.length;
      const cursorEnd = cursorStart + selected.length;
      el.setSelectionRange(cursorStart, cursorEnd);
    }, 20);
  };

  // Unified formatting actions for both Text mode and Markdown mode
  const handleBold = () => {
    if (editorMode === 'markdown') {
      insertTextareaFormatting('**', '**', 'bold text');
      return;
    }
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      document.execCommand('insertHTML', false, '<strong>bold text</strong>');
    } else {
      document.execCommand('bold', false);
    }
    syncFromRichEditor();
  };

  const handleItalic = () => {
    if (editorMode === 'markdown') {
      insertTextareaFormatting('*', '*', 'italic text');
      return;
    }
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      document.execCommand('insertHTML', false, '<em>italic text</em>');
    } else {
      document.execCommand('italic', false);
    }
    syncFromRichEditor();
  };

  const handleBulletList = () => {
    if (editorMode === 'markdown') {
      insertTextareaFormatting('- ', '', 'List item');
      return;
    }
    document.execCommand('insertUnorderedList', false);
    syncFromRichEditor();
  };

  const handleOrderedList = () => {
    if (editorMode === 'markdown') {
      insertTextareaFormatting('1. ', '', 'Numbered item');
      return;
    }
    document.execCommand('insertOrderedList', false);
    syncFromRichEditor();
  };

  const handleChecklist = () => {
    if (editorMode === 'markdown') {
      insertTextareaFormatting('- [ ] ', '', 'Task');
      return;
    }
    const taskHtml = `<div class="note-task-row" style="display:flex;align-items:center;gap:7px;margin:3px 0;"><input type="checkbox" style="width:15px;height:15px;accent-color:var(--accent);cursor:pointer;" /> <span>Task item</span></div>`;
    document.execCommand('insertHTML', false, taskHtml);
    syncFromRichEditor();
  };

  const handleCode = () => {
    if (editorMode === 'markdown') {
      insertTextareaFormatting('`', '`', 'code');
      return;
    }
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      document.execCommand('insertHTML', false, '<code style="background:var(--surface3);padding:1px 5px;border-radius:4px;font-family:monospace;font-size:0.9em;border:1px solid var(--border);">code</code>');
    } else {
      const selectedText = sel.toString();
      document.execCommand('insertHTML', false, `<code style="background:var(--surface3);padding:1px 5px;border-radius:4px;font-family:monospace;font-size:0.9em;border:1px solid var(--border);">${escapeHtml(selectedText)}</code>`);
    }
    syncFromRichEditor();
  };

  // Checkbox toggle handler inside rich editor
  const handleRichEditorClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target && target.tagName.toLowerCase() === 'input' && (target as HTMLInputElement).type === 'checkbox') {
      const checkbox = target as HTMLInputElement;
      const span = checkbox.parentElement?.querySelector('span');
      if (span) {
        if (checkbox.checked) {
          span.style.textDecoration = 'line-through';
          span.style.opacity = '0.7';
        } else {
          span.style.textDecoration = 'none';
          span.style.opacity = '1';
        }
      }
      syncFromRichEditor();
    }
  };

  const handleClear = () => {
    setTempNote('');
    if (editorMode === 'text') {
      if (richEditorRef.current) {
        richEditorRef.current.innerHTML = '';
        richEditorRef.current.focus();
      }
    } else {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };

  const handleSave = () => {
    let finalNote = tempNote;
    if (editorMode === 'text' && richEditorRef.current) {
      finalNote = htmlToMarkdown(richEditorRef.current.innerHTML);
    }
    const cleaned = (finalNote || '').replace(/\s+$/, '').replace(/^\s+/, '');
    onSave(cleaned);
    onClose();
  };

  return (
    <div
      className="note-drawer-overlay"
      style={{
        zIndex: 100085,
      }}
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
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)', margin: '12px auto 4px', flexShrink: 0 }} />

        {/* Modal Header: Clean title + Close button (Write & Preview merged) */}
        <div
          style={{
            padding: '12px 20px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.2px' }}>
            {title}
          </div>

          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-full)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: 'var(--text-2)',
            }}
            aria-label="Close note dialog"
          >
            <X size={15} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '0 20px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Note Input Container */}
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ position: 'relative' }}>
                {editorMode === 'text' ? (
                  /* Formatted Rich-Text Editor (for normal users) */
                  <div
                    ref={richEditorRef}
                    contentEditable
                    suppressContentEditableWarning
                    data-placeholder={placeholder}
                    className="note-rich-editor"
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => {
                      setIsFocused(false);
                      syncFromRichEditor();
                    }}
                    onInput={syncFromRichEditorDebounced}
                    onClick={handleRichEditorClick}
                    onKeyDown={e => {
                      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
                        e.preventDefault();
                        handleBold();
                      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
                        e.preventDefault();
                        handleItalic();
                      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                        e.preventDefault();
                        handleSave();
                      }
                    }}
                    style={{
                      border: isFocused ? '1px solid var(--border2)' : '1px solid var(--border)',
                      boxShadow: isFocused ? '0 0 0 1px var(--border2)' : 'none',
                    }}
                  />
                ) : (
                  /* Raw Markdown Editor (for users who know markdown) */
                  <textarea
                    ref={textareaRef}
                    rows={4}
                    placeholder={placeholder}
                    value={tempNote}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onChange={e => setTempNote(e.target.value)}
                    onKeyDown={e => {
                      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
                        e.preventDefault();
                        handleBold();
                      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
                        e.preventDefault();
                        handleItalic();
                      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                        e.preventDefault();
                        handleSave();
                      }
                    }}
                    style={{
                      width: '100%',
                      minHeight: 105,
                      maxHeight: 220,
                      background: 'var(--surface2)',
                      border: isFocused ? '1px solid var(--border2)' : '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 14px 28px',
                      fontSize: 'var(--fs-sm)',
                      color: 'var(--text)',
                      outline: 'none',
                      resize: 'none',
                      lineHeight: 1.55,
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                      whiteSpace: 'pre-wrap',
                      boxShadow: isFocused ? '0 0 0 1px var(--border2)' : 'none',
                      transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                    }}
                  />
                )}

                {/* Clickable Mode Switcher (Text <-> Markdown) at bottom-right */}
                <button
                  type="button"
                  onClick={handleToggleMode}
                  className={`note-mode-toggle-btn ${editorMode === 'markdown' ? 'active-md' : ''}`}
                  title={editorMode === 'text' ? 'Switch to raw Markdown mode' : 'Switch to formatted Text mode'}
                  aria-label="Toggle editor mode"
                  onMouseDown={e => e.preventDefault()}
                >
                  {editorMode === 'text' ? (
                    <span>Text</span>
                  ) : (
                    <>
                      <Code size={11} strokeWidth={2.4} />
                      <span>Markdown</span>
                    </>
                  )}
                </button>
              </div>

              {/* Formatting Helper Toolbar Card */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: 8,
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '6px 8px',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    overflowX: 'auto',
                    scrollbarWidth: 'none',
                    padding: '2px 0',
                    width: '100%',
                  }}
                >
                  <button
                    type="button"
                    onClick={handleBold}
                    title="Bold"
                    aria-label="Bold text"
                    style={{
                      minWidth: 38,
                      height: 36,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 9,
                      padding: '0 10px',
                      fontSize: 'var(--fs-sm)',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      fontWeight: 750,
                      boxShadow: 'var(--shadow-sm)',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseDown={e => e.preventDefault()}
                  >
                    <Bold size={14} strokeWidth={3} />
                  </button>
                  <button
                    type="button"
                    onClick={handleItalic}
                    title="Italic"
                    aria-label="Italic text"
                    style={{
                      minWidth: 38,
                      height: 36,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 9,
                      padding: '0 10px',
                      fontSize: 'var(--fs-sm)',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      fontStyle: 'italic',
                      boxShadow: 'var(--shadow-sm)',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseDown={e => e.preventDefault()}
                  >
                    <Italic size={14} strokeWidth={2.4} />
                  </button>
                  <button
                    type="button"
                    onClick={handleBulletList}
                    title="Bullet list"
                    aria-label="Bullet list"
                    style={{
                      minWidth: 38,
                      height: 36,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 9,
                      padding: '0 10px',
                      fontSize: 'var(--fs-sm)',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      boxShadow: 'var(--shadow-sm)',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseDown={e => e.preventDefault()}
                  >
                    <List size={14} strokeWidth={2.4} />
                  </button>
                  <button
                    type="button"
                    onClick={handleOrderedList}
                    title="Numbered list"
                    aria-label="Numbered list"
                    style={{
                      minWidth: 38,
                      height: 36,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 9,
                      padding: '0 10px',
                      fontSize: 'var(--fs-sm)',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      boxShadow: 'var(--shadow-sm)',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseDown={e => e.preventDefault()}
                  >
                    <ListOrdered size={14} strokeWidth={2.4} />
                  </button>
                  <button
                    type="button"
                    onClick={handleChecklist}
                    title="Checklist item"
                    aria-label="Checklist item"
                    style={{
                      minWidth: 38,
                      height: 36,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 9,
                      padding: '0 10px',
                      fontSize: 'var(--fs-sm)',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      boxShadow: 'var(--shadow-sm)',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseDown={e => e.preventDefault()}
                  >
                    <CheckSquare size={14} strokeWidth={2.4} />
                  </button>
                  <button
                    type="button"
                    onClick={handleCode}
                    title="Inline code"
                    aria-label="Inline code"
                    style={{
                      minWidth: 38,
                      height: 36,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 9,
                      padding: '0 10px',
                      fontSize: 'var(--fs-sm)',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      boxShadow: 'var(--shadow-sm)',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseDown={e => e.preventDefault()}
                  >
                    <Code size={14} strokeWidth={2.4} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer - Clear & Save Note buttons */}
        <div
          style={{
            padding: '4px 20px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <button
            type="button"
            className="btn btn-drawer-cancel"
            onClick={handleClear}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 'var(--radius-full)',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              fontWeight: 700,
              fontSize: 'var(--fs-sm)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            <RotateCcw size={15} style={{ color: 'var(--text-2)' }} />
            <span>Clear</span>
          </button>
          <button
            type="button"
            className="btn btn-drawer-save-mono"
            onClick={handleSave}
            style={{
              flex: 1.25,
              height: 44,
              borderRadius: 'var(--radius-full)',
              background: 'var(--text)',
              color: 'var(--bg)',
              border: 'none',
              fontWeight: 700,
              fontSize: 'var(--fs-sm)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            <Check size={16} strokeWidth={2.4} style={{ color: 'var(--bg)' }} />
            <span>Save Note</span>
          </button>
        </div>
      </div>
    </div>
  );
}
