import React from 'react';

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  DRAFT: { label: 'טיוטה', bg: 'rgba(155, 155, 170, 0.15)', color: '#9B9BAA' },
  SENT: { label: 'נשלח', bg: 'rgba(108, 99, 255, 0.15)', color: '#6C63FF' },
  PAID: { label: 'שולם', bg: 'rgba(0, 212, 170, 0.15)', color: '#00D4AA' },
  CANCELLED: { label: 'בוטל', bg: 'rgba(255, 87, 87, 0.15)', color: '#FF5757' },
  CREDIT_NOTED: { label: 'זוכה', bg: 'rgba(255, 181, 71, 0.15)', color: '#FFB547' },
};

export default function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT;

  return (
    <span style={{
      display: 'inline-block',
      padding: '4px 12px',
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 600,
      background: config.bg,
      color: config.color,
    }}>
      {config.label}
    </span>
  );
}
