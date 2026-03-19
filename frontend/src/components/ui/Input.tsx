import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  tooltip?: string;
}

export default function Input({ label, error, tooltip, style, ...props }: InputProps) {
  // Split label to render asterisk in red
  const hasAsterisk = label?.endsWith(' *');
  const labelText = hasAsterisk ? label!.slice(0, -2) : label;

  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <label style={{
          display: 'block',
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--text-secondary)',
          marginBottom: 6,
        }}>
          {labelText}
          {hasAsterisk && <span style={{ color: 'var(--error)', marginRight: 2 }}> *</span>}
          {tooltip && (
            <span
              title={tooltip}
              style={{
                marginRight: 6,
                cursor: 'help',
                color: 'var(--text-muted)',
                fontSize: 12,
              }}
            >
              ⓘ
            </span>
          )}
        </label>
      )}
      <input
        style={{
          width: '100%',
          padding: '10px 14px',
          background: 'var(--bg-primary)',
          border: `1px solid ${error ? 'var(--error)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-xs)',
          color: 'var(--text-primary)',
          fontSize: 14,
          outline: 'none',
          transition: 'border-color 0.2s',
          direction: 'rtl',
          ...style,
        }}
        {...props}
      />
      {error && (
        <p style={{ fontSize: 12, color: 'var(--error)', marginTop: 4 }}>{error}</p>
      )}
    </div>
  );
}
