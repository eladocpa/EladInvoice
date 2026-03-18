import React from 'react';

interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export default function Card({ children, style, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        padding: 24,
        boxShadow: 'var(--shadow)',
        cursor: onClick ? 'pointer' : undefined,
        transition: 'border-color 0.2s',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
