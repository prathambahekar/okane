import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Equal, Calculator, Hash } from 'lucide-react';
import { evaluateMathExpression } from '../../utils/mathEvaluator';
import { fmtMoney } from '../../utils';
import { useStore } from '../../store';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export type AmountInputMode = 'num-only' | 'math';

export interface MathAmountInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string | number;
  onChange: (value: string) => void;
  onEvaluated?: (value: number) => void;
  currency?: string;
  isHero?: boolean;
  containerClassName?: string;
  autoFocus?: boolean;
  mode?: AmountInputMode;
  onModeChange?: (mode: AmountInputMode) => void;
  showModeKey?: boolean;
  showQuickKeys?: boolean;
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
    mode: propMode,
    onModeChange,
    showModeKey = true,
    showQuickKeys = true,
    ...restProps
  },
  ref
) {
  const { db } = useStore();
  const currency = propCurrency || db.settings?.currency || 'INR';

  // Retrieve initial mode: user preference or default to 'num-only' (number keypad)
  const getInitialMode = (): AmountInputMode => {
    if (propMode) return propMode;
    if (db.settings?.amountInputMode) return db.settings.amountInputMode;
    try {
      const saved = localStorage.getItem('okane_amount_input_mode');
      if (saved === 'num-only' || saved === 'math') return saved;
    } catch {
      // ignore
    }
    return 'num-only';
  };

  const [mode, setModeState] = useState<AmountInputMode>(getInitialMode);
  const [isFocused, setIsFocused] = useState(false);

  // Sync mode with propMode or db settings if changed
  useEffect(() => {
    if (propMode) {
      setModeState(propMode);
    } else if (db.settings?.amountInputMode) {
      setModeState(db.settings.amountInputMode);
    }
  }, [propMode, db.settings?.amountInputMode]);

  const internalInputRef = useRef<HTMLInputElement>(null);
  const combinedRef = (ref || internalInputRef) as React.RefObject<HTMLInputElement | null>;

  const rawString = String(value ?? '');
  const evalResult = useMemo(() => evaluateMathExpression(rawString), [rawString]);
  const isMathActive = evalResult.hasOperator;

  // Haptic feedback for tactile satisfaction on key presses
  const triggerHaptic = useCallback(() => {
    try {
      if (Capacitor.isPluginAvailable('Haptics')) {
        Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
      } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(10);
      }
    } catch {
      // ignore
    }
  }, []);

  const commitEvaluation = useCallback(() => {
    if (evalResult.hasOperator && evalResult.isValid && evalResult.result !== null) {
      const formatted = String(evalResult.result);
      onChange(formatted);
      onEvaluated?.(evalResult.result);
    }
  }, [evalResult, onChange, onEvaluated]);

  // Switch between Num-only and Math modes
  const handleSetMode = useCallback((newMode: AmountInputMode) => {
    triggerHaptic();
    if (newMode === 'num-only' && evalResult.hasOperator && evalResult.isValid && evalResult.result !== null) {
      // Evaluate any existing math formula into clean number when switching to num-only
      commitEvaluation();
    }
    setModeState(newMode);
    try {
      localStorage.setItem('okane_amount_input_mode', newMode);
    } catch {
      // ignore
    }
    onModeChange?.(newMode);

    // Keep input focused
    if (combinedRef.current) {
      combinedRef.current.focus();
    }
  }, [commitEvaluation, evalResult, onModeChange, triggerHaptic, combinedRef]);

  // Clean and filter user input based on current mode
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    if (mode === 'num-only') {
      // Strict numbers and single decimal point only (replace comma with dot)
      let cleaned = raw.replace(/,/g, '.').replace(/[^0-9.]/g, '');
      const dotIndex = cleaned.indexOf('.');
      if (dotIndex !== -1) {
        cleaned = cleaned.slice(0, dotIndex + 1) + cleaned.slice(dotIndex + 1).replace(/\./g, '');
      }
      onChange(cleaned);
    } else {
      // Math mode: numbers, dot, math operators and parens
      const cleaned = raw
        .replace(/,/g, '.')
        .replace(/[xX×]/g, '*')
        .replace(/÷/g, '/')
        .replace(/[^0-9.+\-*/%()]/g, '');
      onChange(cleaned);
    }
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

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    restProps.onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Slight delay to allow quick key clicks on mobile without losing state
    setTimeout(() => {
      if (document.activeElement !== combinedRef.current) {
        setIsFocused(false);
      }
    }, 150);

    if (evalResult.hasOperator && evalResult.isValid && evalResult.result !== null) {
      commitEvaluation();
    }
    restProps.onBlur?.(e);
  };

  // Quick Action Keys Handlers
  const handleInsertOperator = (op: '+' | '-' | '*' | '/') => {
    triggerHaptic();
    let current = rawString.trim();
    if (!current) {
      if (op === '-') current = '-';
      else return;
    } else if (/[+\-*/]$/.test(current)) {
      current = current.slice(0, -1) + op;
    } else {
      current = current + (op === '+' ? ' + ' : op === '-' ? ' - ' : ` ${op} `);
    }
    // Automatically switch to math mode so operators can be evaluated
    if (mode === 'num-only') {
      setModeState('math');
    }
    onChange(current);
    if (combinedRef.current) {
      combinedRef.current.focus();
    }
  };

  const handleIncrement = (amountToAdd: number) => {
    triggerHaptic();
    const currentNum = evalResult.result !== null && !isNaN(evalResult.result)
      ? evalResult.result
      : parseFloat(rawString) || 0;
    const nextVal = Math.round((currentNum + amountToAdd) * 100) / 100;
    onChange(String(nextVal));
    onEvaluated?.(nextVal);
    if (combinedRef.current) {
      combinedRef.current.focus();
    }
  };

  const handleClear = () => {
    triggerHaptic();
    onChange('');
    if (combinedRef.current) {
      combinedRef.current.focus();
    }
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
        flexDirection: 'column',
        alignItems: isHero ? (isMathActive ? 'flex-start' : 'center') : 'flex-start',
        justifyContent: 'center',
        transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div
        className="math-amount-input-wrap"
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isHero ? (isMathActive ? 'flex-start' : 'center') : 'flex-start',
          width: '100%',
        }}
      >
        <input
          ref={combinedRef}
          type="text"
          inputMode={mode === 'num-only' ? 'decimal' : 'text'}
          pattern={mode === 'num-only' ? '[0-9]*[.,]?[0-9]*' : undefined}
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          value={rawString}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
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

        {/* Live math evaluation badge if math expression is active */}
        {isMathActive && evalResult.isValid && evalResult.result !== null && (
          <button
            type="button"
            className="math-eval-pill"
            onMouseDown={e => e.preventDefault()}
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

        {/* Compact Mode Pill for non-hero inputs */}
        {!isHero && showModeKey && (
          <button
            type="button"
            className={`math-mode-key-badge ${mode === 'num-only' ? 'is-num-only' : ''}`}
            onMouseDown={e => e.preventDefault()}
            onClick={() => handleSetMode(mode === 'num-only' ? 'math' : 'num-only')}
            title={mode === 'num-only' ? "Using Number-only keypad. Click for Math" : "Using Math keyboard. Click for Number-only"}
            style={{ marginLeft: 6, flexShrink: 0 }}
          >
            {mode === 'num-only' ? (
              <>
                <Hash size={11} strokeWidth={2.4} />
                <span>123</span>
              </>
            ) : (
              <>
                <Calculator size={11} strokeWidth={2.4} />
                <span>±×</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Hero Mode / Focused Accessory Toolbar with Num-Only Key, Mode Switcher & Quick Increments */}
      {isHero && showQuickKeys && (isFocused || isMathActive) && (
        <div className="math-amount-toolbar">
          {/* Mode Switcher Group with explicit '123 Num Only' Key */}
          {showModeKey && (
            <div className="math-toolbar-modes">
              <button
                type="button"
                className={`math-toolbar-mode-btn ${mode === 'num-only' ? 'active' : ''}`}
                onMouseDown={e => e.preventDefault()}
                onClick={() => handleSetMode('num-only')}
                title="Number keypad only (0-9 and decimal)"
              >
                <Hash size={12} strokeWidth={2.4} />
                <span>123 Num Only</span>
              </button>
              <button
                type="button"
                className={`math-toolbar-mode-btn ${mode === 'math' ? 'active' : ''}`}
                onMouseDown={e => e.preventDefault()}
                onClick={() => handleSetMode('math')}
                title="Inline arithmetic calculator"
              >
                <Calculator size={12} strokeWidth={2.4} />
                <span>Math</span>
              </button>
            </div>
          )}

          {/* Quick Helper Keys: Operators & Value Boosters */}
          <div className="math-toolbar-keys">
            <button
              type="button"
              className="math-key-btn op-key"
              onMouseDown={e => e.preventDefault()}
              onClick={() => handleInsertOperator('+')}
              title="Add (+)"
            >
              +
            </button>
            <button
              type="button"
              className="math-key-btn op-key"
              onMouseDown={e => e.preventDefault()}
              onClick={() => handleInsertOperator('-')}
              title="Subtract (-)"
            >
              −
            </button>
            <button
              type="button"
              className="math-key-btn inc-key"
              onMouseDown={e => e.preventDefault()}
              onClick={() => handleIncrement(50)}
              title="Add 50"
            >
              +50
            </button>
            <button
              type="button"
              className="math-key-btn inc-key"
              onMouseDown={e => e.preventDefault()}
              onClick={() => handleIncrement(100)}
              title="Add 100"
            >
              +100
            </button>
            <button
              type="button"
              className="math-key-btn inc-key"
              onMouseDown={e => e.preventDefault()}
              onClick={() => handleIncrement(500)}
              title="Add 500"
            >
              +500
            </button>
            {rawString && (
              <button
                type="button"
                className="math-key-btn clear-key"
                onMouseDown={e => e.preventDefault()}
                onClick={handleClear}
                title="Clear amount"
              >
                C
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
