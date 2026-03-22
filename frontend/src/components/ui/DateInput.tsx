import React, { useRef, useState } from 'react';

interface DateInputProps {
  label?: string;
  value: string; // ISO format yyyy-mm-dd
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  min?: string; // ISO format yyyy-mm-dd
}

/**
 * Date input with calendar picker.
 * Displays date in dd/mm/yyyy format.
 * Internal value is ISO yyyy-mm-dd.
 */
export default function DateInput({ label, value, onChange, error, required, min }: DateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualValue, setManualValue] = useState('');

  // Format ISO date to dd/mm/yyyy for display
  const formatDisplay = (isoDate: string): string => {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-');
    if (!y || !m || !d) return isoDate;
    return `${d}/${m}/${y}`;
  };

  // Parse dd/mm/yyyy to ISO yyyy-mm-dd
  const parseManual = (input: string): string | null => {
    const match = input.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (!match) return null;
    const [, d, m, y] = match;
    const day = d.padStart(2, '0');
    const month = m.padStart(2, '0');
    const date = new Date(`${y}-${month}-${day}`);
    if (isNaN(date.getTime())) return null;
    return `${y}-${month}-${day}`;
  };

  const hasAsterisk = label?.endsWith(' *');
  const labelText = hasAsterisk ? label!.slice(0, -2) : label;

  const handleManualSubmit = () => {
    const parsed = parseManual(manualValue);
    if (parsed) {
      onChange(parsed);
      setManualMode(false);
      setManualValue('');
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

      {manualMode ? (
        /* Manual text input mode */
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            autoFocus
            type="text"
            placeholder="dd/mm/yyyy"
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleManualSubmit();
              if (e.key === 'Escape') { setManualMode(false); setManualValue(''); }
            }}
            onBlur={() => {
              if (manualValue) handleManualSubmit();
              else setManualMode(false);
            }}
            style={{
              flex: 1,
              padding: '10px 14px',
              background: 'var(--bg-primary)',
              border: `1px solid ${error ? 'var(--error)' : 'var(--accent-primary)'}`,
              borderRadius: 'var(--radius-xs)',
              color: 'var(--text-primary)',
              fontSize: 14,
              outline: 'none',
              direction: 'ltr',
              textAlign: 'center',
            }}
          />
        </div>
      ) : (
        /* Display mode with native date picker */
        <div style={{ display: 'flex', gap: 6 }}>
          <div
            style={{
              flex: 1,
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {/* Native date input — fully functional */}
            <input
              ref={inputRef}
              type="date"
              value={value}
              required={required}
              min={min}
              onChange={(e) => onChange(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'var(--bg-primary)',
                border: `1px solid ${error ? 'var(--error)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-xs)',
                color: 'transparent',
                fontSize: 14,
                cursor: 'pointer',
                outline: 'none',
              }}
            />
            {/* Overlay showing dd/mm/yyyy */}
            <div
              onClick={() => {
                if (inputRef.current) {
                  try { inputRef.current.showPicker(); } catch { inputRef.current.focus(); }
                }
              }}
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 14px',
                pointerEvents: 'none',
                fontSize: 14,
                color: value ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              {value ? formatDisplay(value) : 'dd/mm/yyyy'}
            </div>
          </div>
          {/* Manual entry button */}
          <button
            type="button"
            onClick={() => {
              setManualMode(true);
              setManualValue(value ? formatDisplay(value) : '');
            }}
            title="הזנה ידנית"
            style={{
              padding: '8px 10px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-xs)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            &#9998;
          </button>
        </div>
      )}

      {error && (
        <p style={{ fontSize: 12, color: 'var(--error)', marginTop: 4 }}>{error}</p>
      )}
    </div>
  );
}
