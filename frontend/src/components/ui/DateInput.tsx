import React, { useRef } from 'react';

interface DateInputProps {
  label?: string;
  value: string; // ISO format yyyy-mm-dd
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
}

/**
 * Date input with calendar picker.
 * Displays date in dd/mm/yyyy format.
 * Internal value is ISO yyyy-mm-dd.
 */
export default function DateInput({ label, value, onChange, error, required }: DateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Format ISO date to dd/mm/yyyy for display
  const formatDisplay = (isoDate: string): string => {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-');
    if (!y || !m || !d) return isoDate;
    return `${d}/${m}/${y}`;
  };

  const hasAsterisk = label?.endsWith(' *');
  const labelText = hasAsterisk ? label!.slice(0, -2) : label;

  const openPicker = () => {
    if (inputRef.current) {
      inputRef.current.showPicker?.();
      inputRef.current.focus();
    }
  };

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
        </label>
      )}
      <div style={{ position: 'relative' }}>
        {/* Visible display showing dd/mm/yyyy */}
        <div
          onClick={openPicker}
          style={{
            width: '100%',
            padding: '10px 14px',
            background: 'var(--bg-primary)',
            border: `1px solid ${error ? 'var(--error)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-xs)',
            color: value ? 'var(--text-primary)' : 'var(--text-muted)',
            fontSize: 14,
            cursor: 'pointer',
            direction: 'ltr',
            textAlign: 'right',
            minHeight: 42,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 16, color: 'var(--text-muted)' }}>&#x1F4C5;</span>
          <span>{value ? formatDisplay(value) : 'dd/mm/yyyy'}</span>
        </div>
        {/* Hidden native date input for calendar picker */}
        <input
          ref={inputRef}
          type="date"
          value={value}
          required={required}
          onChange={(e) => onChange(e.target.value)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            opacity: 0,
            cursor: 'pointer',
          }}
        />
      </div>
      {error && (
        <p style={{ fontSize: 12, color: 'var(--error)', marginTop: 4 }}>{error}</p>
      )}
    </div>
  );
}
