import React from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { he } from 'date-fns/locale/he';

registerLocale('he', he);

interface DateInputProps {
  label?: string;
  value: string; // ISO format yyyy-mm-dd
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  min?: string; // ISO format yyyy-mm-dd
}

function parseISO(isoDate: string): Date | null {
  if (!isoDate) return null;
  const d = new Date(isoDate + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

function toISO(date: Date | null): string {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function DateInput({ label, value, onChange, error, min }: DateInputProps) {
  const hasAsterisk = label?.endsWith(' *');
  const labelText = hasAsterisk ? label!.slice(0, -2) : label;

  const selected = parseISO(value);
  const minDate = min ? parseISO(min) : undefined;

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
      <DatePicker
        selected={selected}
        onChange={(date: Date | null) => onChange(toISO(date))}
        dateFormat="dd/MM/yyyy"
        locale="he"
        minDate={minDate || undefined}
        placeholderText="dd/mm/yyyy"
        showMonthDropdown
        showYearDropdown
        dropdownMode="select"
        todayButton="היום"
        isClearable={false}
        customInput={
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
              cursor: 'pointer',
              direction: 'ltr',
              textAlign: 'right',
            }}
          />
        }
      />
      {error && (
        <p style={{ fontSize: 12, color: 'var(--error)', marginTop: 4 }}>{error}</p>
      )}
    </div>
  );
}
