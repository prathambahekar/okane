import React from 'react';

interface SwitchProps {
  checked?: boolean;
  onChange?: (event: React.ChangeEvent<HTMLInputElement> | { target: { checked: boolean } }) => void;
  disabled?: boolean;
  size?: 'small' | 'medium';
  color?: string;
  id?: string;
  name?: string;
  'aria-label'?: string;
  className?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked = false,
  onChange,
  disabled = false,
  size = 'medium',
  id,
  name,
  'aria-label': ariaLabel,
  className = '',
}) => {
  const isSmall = size === 'small';
  const width = isSmall ? 34 : 42;
  const height = isSmall ? 20 : 24;
  const thumbSize = isSmall ? 14 : 18;
  const travel = width - thumbSize - 6;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    onChange?.(e);
  };

  return (
    <label
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        userSelect: 'none',
        verticalAlign: 'middle',
      }}
      className={className}
    >
      <input
        type="checkbox"
        id={id}
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={handleChange}
        aria-label={ariaLabel}
        style={{
          position: 'absolute',
          opacity: 0,
          width: 0,
          height: 0,
          pointerEvents: 'none',
          margin: 0,
        }}
      />
      {/* Track */}
      <span
        style={{
          display: 'inline-block',
          width: `${width}px`,
          height: `${height}px`,
          backgroundColor: checked ? 'var(--accent)' : 'var(--border2)',
          borderRadius: '9999px',
          transition: 'background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative',
          boxShadow: checked ? '0 0 12px var(--accent-soft)' : 'none',
        }}
      >
        {/* Thumb */}
        <span
          style={{
            position: 'absolute',
            top: '3px',
            left: '3px',
            width: `${thumbSize}px`,
            height: `${thumbSize}px`,
            backgroundColor: '#ffffff',
            borderRadius: '50%',
            transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            transform: checked ? `translateX(${travel}px)` : 'translateX(0)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.28)',
          }}
        />
      </span>
    </label>
  );
};

export default Switch;
