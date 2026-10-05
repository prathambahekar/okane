import React, { useMemo, useCallback, useRef } from 'react';
import { Equal } from 'lucide-react';
import { evaluateMathExpression } from '../../utils/mathEvaluator';
import { fmtMoney } from '../../utils';
import { useStore } from '../../store';

export interface MathAmountInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string | number;
  onChange: (value: string) => void;
  onEvaluated?: (value: number) => void;
  currency?: string;
  isHero?: boolean;
  containerClassName?: string;
  autoFocus?: boolean;
}

export const MathAmountInput = React.forwardRef<HTMLInputElement, MathAmountInputProps>(function MathAmountInput(
  {
    value,
    onChange,
    onEvaluated,
    currency: propCurrency,
    isHero = false,
    placeholder = '0.00',
    className = '',
    containerClassName = '',
    disabled,
    autoFocus,
    style,
    ...restProps
  },
  ref
) {
  const { db } = useStore();
  const currency = propCurrency || db.settings?.currency || 'INR';

  const internalInputRef = useRef<HTMLInputElement>(null);
  const combinedRef = (ref || internalInputRef) as React.RefObject<HTMLInputElement | null>;

  const rawString = String(value ?? '');
  const evalResult = useMemo(() => evaluateMathExpression(rawString), [rawString]);
  const isMathActive = evalResult.hasOperator;

  const commitEvaluation = useCallback(() => {
    if (evalResult.hasOperator && evalResult.isValid && evalResult.result !== null) {
      const formatted = String(evalResult.result);
      onChange(formatted);
      onEvaluated?.(evalResult.result);
    }
  }, [evalResult, onChange, onEvaluated]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow digits, decimal, and basic arithmetic operators, convert comma to dot, block text letters
    const cleaned = raw
      .replace(/,/g, '.')
      .replace(/[xX×]/g, '*')
      .replace(/÷/g, '/')
      .replace(/[^0-9.+\-*/%()]/g, '');
    onChange(cleaned);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === '=' || e.key === 'Enter') {
      if (evalResult.hasOperator && evalResult.isValid && evalResult.result !== null) {
        e.preventDefault();
        commitEvaluation();
      }
    }
    restProps.onKeyDown?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (evalResult.hasOperator && evalResult.isValid && evalResult.result !== null) {
      commitEvaluation();
    }
    restProps.onBlur?.(e);
  };

  // Center alignment initially / in normal mode; shift to left-aligned when inline math is active
  const textAlign = isHero ? (isMathActive ? 'left' : 'center') : 'left';
  const width = isHero ? (isMathActive ? '100%' : `${Math.max(1, (rawString || placeholder || '0').length) * 19 + 12}px`) : '100%';

  return (
    <div
      className={`math-amount-container ${isHero ? 'math-amount-hero' : ''} ${isMathActive ? 'math-active' : 'math-idle'} ${containerClassName}`}
      style={{
        position: 'relative',
        width: isHero ? (isMathActive ? '100%' : 'auto') : '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isHero ? (isMathActive ? 'flex-start' : 'center') : 'flex-start',
        transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <input
        ref={combinedRef}
        type="text"
        inputMode="decimal"
        pattern="[0-9]*[.,]?[0-9]*"
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
        value={rawString}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        className={`math-amount-input ${className}`}
        style={{
          textAlign,
          width,
          maxWidth: isHero ? (isMathActive ? 'calc(100% - 90px)' : '280px') : '100%',
          transition: 'text-align 0.15s ease, width 0.15s ease',
          ...style,
        }}
        {...restProps}
      />

      {/* Subtle live math evaluation badge if expression is active */}
      {isMathActive && evalResult.isValid && evalResult.result !== null && (
        <button
          type="button"
          className="math-eval-pill"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            commitEvaluation();
          }}
          title="Click to apply calculated result"
          style={{
            position: 'absolute',
            right: 0,
            background: 'var(--credit-bg)',
            color: 'var(--credit)',
            border: '1px solid var(--credit-border)',
            borderRadius: 'var(--radius-full)',
            padding: isHero ? '4px 10px' : '2px 8px',
            fontSize: isHero ? 'var(--fs-sm)' : 'var(--fs-xs)',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            cursor: 'pointer',
            zIndex: 3,
            boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
        >
          <Equal size={isHero ? 13 : 11} strokeWidth={3} />
          <span>{fmtMoney(evalResult.result, currency)}</span>
        </button>
      )}
    </div>
  );
});
