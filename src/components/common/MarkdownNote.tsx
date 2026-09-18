import React from 'react';

interface MarkdownNoteProps {
  content: string;
  className?: string;
  style?: React.CSSProperties;
  inline?: boolean;
}

/**
 * Parses inline markdown tokens:
 * - **bold** or __bold__
 * - *italic* or _italic_
 * - ~~strikethrough~~
 * - `code`
 * - [label](url)
 * - Raw URLs (https://...)
 */
function parseInlineMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];

  const inlineRegex = /(\*\*|__)(.*?)\1|(\*|_)(.*?)\3|(~~)(.*?)\5|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s]+)/g;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIndex = 0;

  while ((match = inlineRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(text.substring(lastIndex, match.index));
    }

    const [fullMatch] = match;

    if (match[2] !== undefined) {
      // Bold
      elements.push(
        <strong key={`b-${keyIndex++}`} style={{ fontWeight: 700, color: 'var(--text)' }}>
          {parseInlineMarkdown(match[2])}
        </strong>
      );
    } else if (match[4] !== undefined) {
      // Italic
      elements.push(
        <em key={`i-${keyIndex++}`} style={{ fontStyle: 'italic', color: 'var(--text-2)' }}>
          {parseInlineMarkdown(match[4])}
        </em>
      );
    } else if (match[6] !== undefined) {
      // Strikethrough
      elements.push(
        <del key={`s-${keyIndex++}`} style={{ textDecoration: 'line-through', opacity: 0.65 }}>
          {parseInlineMarkdown(match[6])}
        </del>
      );
    } else if (match[7] !== undefined) {
      // Inline code
      elements.push(
        <code
          key={`c-${keyIndex++}`}
          style={{
            background: 'var(--surface3)',
            padding: '1.5px 6px',
            borderRadius: 'var(--radius-xs, 5px)',
            fontSize: '0.88em',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            fontWeight: 500,
          }}
        >
          {match[7]}
        </code>
      );
    } else if (match[8] !== undefined && match[9] !== undefined) {
      // Markdown link
      elements.push(
        <a
          key={`l-${keyIndex++}`}
          href={match[9]}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          style={{
            color: 'var(--accent)',
            textDecoration: 'underline',
            textUnderlineOffset: '2.5px',
            fontWeight: 600,
          }}
        >
          {match[8]}
        </a>
      );
    } else if (match[10] !== undefined) {
      // Raw URL
      elements.push(
        <a
          key={`u-${keyIndex++}`}
          href={match[10]}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          style={{
            color: 'var(--accent)',
            textDecoration: 'underline',
            textUnderlineOffset: '2.5px',
            wordBreak: 'break-all',
            fontWeight: 600,
          }}
        >
          {match[10]}
        </a>
      );
    } else {
      elements.push(fullMatch);
    }

    lastIndex = match.index + fullMatch.length;
  }

  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }

  return elements;
}

/**
 * High-performance, clean markdown note component:
 * - Formatted multi-line text & lists with comfortable line heights
 * - Checklist items, bullet points, numbered lists
 * - Headers, code snippets, blockquotes
 * - Consistent styling matching card surface background
 */
export function MarkdownNote({ content, className = '', style = {}, inline = false }: MarkdownNoteProps) {
  if (!content || !content.trim()) return null;

  if (inline) {
    return (
      <span
        className={`markdown-note-inline ${className}`}
        style={{
          display: 'inline',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          ...style,
        }}
      >
        {parseInlineMarkdown(content)}
      </span>
    );
  }

  const rawLines = content.split('\n');

  return (
    <div
      className={`markdown-note-container ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: '4px 14px',
        alignItems: 'center',
        lineHeight: 1.5,
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        color: 'var(--text)',
        maxWidth: '100%',
        ...style,
      }}
    >
      {rawLines.map((rawLine, idx) => {
        const trimmed = rawLine.trim();

        // Empty line (preserves line-spacing between paragraphs)
        if (!trimmed) {
          return <div key={`nl-${idx}`} style={{ width: '100%', height: '4px', flexShrink: 0 }} />;
        }

        // Header 1: # Title
        if (trimmed.startsWith('# ')) {
          return (
            <div
              key={`h1-${idx}`}
              style={{
                width: '100%',
                flexShrink: 0,
                fontSize: '1.12em',
                fontWeight: 750,
                color: 'var(--text)',
                marginTop: idx > 0 ? 4 : 0,
                marginBottom: 2,
                letterSpacing: '-0.01em',
              }}
            >
              {parseInlineMarkdown(trimmed.substring(2))}
            </div>
          );
        }

        // Header 2: ## Title
        if (trimmed.startsWith('## ')) {
          return (
            <div
              key={`h2-${idx}`}
              style={{
                width: '100%',
                flexShrink: 0,
                fontSize: '1.04em',
                fontWeight: 700,
                color: 'var(--text)',
                marginTop: idx > 0 ? 3 : 0,
                marginBottom: 2,
              }}
            >
              {parseInlineMarkdown(trimmed.substring(3))}
            </div>
          );
        }

        // Header 3: ### Title
        if (trimmed.startsWith('### ')) {
          return (
            <div
              key={`h3-${idx}`}
              style={{
                width: '100%',
                flexShrink: 0,
                fontSize: '0.96em',
                fontWeight: 700,
                color: 'var(--text)',
                marginTop: idx > 0 ? 2 : 0,
                marginBottom: 1,
              }}
            >
              {parseInlineMarkdown(trimmed.substring(4))}
            </div>
          );
        }

        // Task checklist: - [ ] or - [x] or [ ] or [x]
        const checkMatch = trimmed.match(/^-\s*\[([ xX])\]\s*(.*)$/) || trimmed.match(/^\[([ xX])\]\s*(.*)$/);
        if (checkMatch) {
          const isChecked = checkMatch[1].toLowerCase() === 'x';
          return (
            <div
              key={`chk-${idx}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '2px 0',
                maxWidth: '100%',
              }}
            >
              <div
                style={{
                  width: 15,
                  height: 15,
                  borderRadius: 4,
                  border: isChecked ? 'none' : '1.5px solid var(--border2)',
                  background: isChecked ? 'var(--credit, #10b981)' : 'var(--surface2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {isChecked && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path
                      d="M1 4L3.8 7L9 1"
                      stroke="#ffffff"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              <span
                style={{
                  textDecoration: isChecked ? 'line-through' : 'none',
                  opacity: isChecked ? 0.6 : 1,
                  color: isChecked ? 'var(--text-3)' : 'var(--text)',
                  fontSize: '13px',
                  fontWeight: 500,
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                  maxWidth: '100%',
                }}
              >
                {parseInlineMarkdown(checkMatch[2])}
              </span>
            </div>
          );
        }

        // Bullet item: - item or * item or • item
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
          const bulletText = trimmed.replace(/^[-*•]\s+/, '');
          return (
            <div
              key={`li-${idx}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '2px 0',
                maxWidth: '100%',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: 'var(--text-3)',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  color: 'var(--text)',
                  fontSize: '13px',
                  fontWeight: 500,
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                  maxWidth: '100%',
                }}
              >
                {parseInlineMarkdown(bulletText)}
              </span>
            </div>
          );
        }

        // Numbered item: 1. item or 1) item
        const numMatch = trimmed.match(/^(\d+)[.)]\s*(.*)$/);
        if (numMatch) {
          return (
            <div
              key={`num-${idx}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '2px 0',
                maxWidth: '100%',
              }}
            >
              <span
                style={{
                  fontWeight: 650,
                  color: 'var(--text-3)',
                  flexShrink: 0,
                  fontSize: '0.85em',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {numMatch[1]}.
              </span>
              <span
                style={{
                  color: 'var(--text)',
                  fontSize: '13px',
                  fontWeight: 500,
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                  maxWidth: '100%',
                }}
              >
                {parseInlineMarkdown(numMatch[2])}
              </span>
            </div>
          );
        }

        // Blockquote: > quote
        if (trimmed.startsWith('> ')) {
          return (
            <div
              key={`bq-${idx}`}
              style={{
                width: '100%',
                flexShrink: 0,
                borderLeft: '2.5px solid var(--accent)',
                paddingLeft: 10,
                margin: '3px 0',
                color: 'var(--text-2)',
                fontStyle: 'italic',
                fontSize: '13px',
              }}
            >
              {parseInlineMarkdown(trimmed.substring(2))}
            </div>
          );
        }

        // Standard text line
        return (
          <div
            key={`ln-${idx}`}
            style={{
              width: '100%',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'flex-start',
              padding: '1px 0',
            }}
          >
            <span
              style={{
                color: 'var(--text)',
                fontSize: '13px',
                fontWeight: 500,
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
                maxWidth: '100%',
              }}
            >
              {parseInlineMarkdown(rawLine)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
