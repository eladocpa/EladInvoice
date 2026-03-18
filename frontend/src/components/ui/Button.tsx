import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const VARIANTS: Record<string, React.CSSProperties> = {
  primary: {
    background: 'linear-gradient(135deg, var(--accent-primary), #8B7FFF)',
    color: 'white',
    border: 'none',
  },
  secondary: {
    background: 'transparent',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
  },
  danger: {
    background: 'rgba(255, 87, 87, 0.15)',
    color: 'var(--error)',
    border: '1px solid rgba(255, 87, 87, 0.3)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: 'none',
  },
};

const SIZES: Record<string, React.CSSProperties> = {
  sm: { padding: '6px 14px', fontSize: 12 },
  md: { padding: '10px 20px', fontSize: 14 },
  lg: { padding: '12px 28px', fontSize: 16 },
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  disabled,
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      style={{
        ...VARIANTS[variant],
        ...SIZES[size],
        borderRadius: 'var(--radius-sm)',
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: disabled || loading ? 0.6 : 1,
        transition: 'all 0.2s',
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...props}
    >
      {loading ? '...' : children}
    </button>
  );
}
