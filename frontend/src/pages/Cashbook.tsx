import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'מזומן', CHECK: 'שיק', BANK_TRANSFER: 'העברה בנקאית',
  CREDIT_CARD: 'כרטיס אשראי', OTHER: 'אחר',
};

interface CashbookEntry {
  id: string;
  entryType: string;
  entryDate: string;
  amount: number;
  vatAmount: number;
  customerOrSupplierName: string | null;
  description: string | null;
  paymentMethod: string | null;
  runningBalance: number;
  document?: { documentType: string; documentNumber: number } | null;
}

function formatAmount(agorot: number): string {
  return '₪' + (agorot / 100).toLocaleString('he-IL', { minimumFractionDigits: 2 });
}

export default function Cashbook() {
  const [entries, setEntries] = useState<CashbookEntry[]>([]);
  const [summary, setSummary] = useState({ totalIncome: 0, totalExpense: 0, totalVat: 0, balance: 0 });
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchData = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    params.set('limit', '100');

    api.get(`/cashbook?${params}`)
      .then(({ data }) => {
        setEntries(data.entries);
        setSummary(data.summary);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>ספר תקבולים ותשלומים</h1>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <Card>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>סה"כ הכנסות</p>
          <p className="tabular-nums" style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>
            {formatAmount(summary.totalIncome)}
          </p>
        </Card>
        <Card>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>סה"כ הוצאות</p>
          <p className="tabular-nums" style={{ fontSize: 24, fontWeight: 700, color: 'var(--error)' }}>
            {formatAmount(summary.totalExpense)}
          </p>
        </Card>
        <Card>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>מע"מ שנגבה</p>
          <p className="tabular-nums" style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-primary)' }}>
            {formatAmount(summary.totalVat)}
          </p>
        </Card>
        <Card>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>יתרה</p>
          <p className="tabular-nums" style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-secondary)' }}>
            {formatAmount(summary.balance)}
          </p>
        </Card>
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: 20, padding: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
          <Input label="מתאריך" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input label="עד תאריך" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <Button onClick={fetchData} style={{ marginBottom: 16 }}>סנן</Button>
        </div>
      </Card>

      {/* Table */}
      <Card>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>טוען...</div>
        ) : entries.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            אין רשומות בספר התקבולים
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={thStyle}>תאריך</th>
                  <th style={thStyle}>מסמך</th>
                  <th style={thStyle}>שם</th>
                  <th style={thStyle}>תיאור</th>
                  <th style={thStyle}>אמצעי</th>
                  <th style={thStyle}>הכנסה</th>
                  <th style={thStyle}>הוצאה</th>
                  <th style={thStyle}>יתרה</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={tdStyle}>{new Date(entry.entryDate).toLocaleDateString('he-IL')}</td>
                    <td style={tdStyle}>{entry.document ? entry.document.documentNumber : '-'}</td>
                    <td style={tdStyle}>{entry.customerOrSupplierName || '-'}</td>
                    <td style={tdStyle}>{entry.description || '-'}</td>
                    <td style={tdStyle}>{entry.paymentMethod ? PAYMENT_LABELS[entry.paymentMethod] || entry.paymentMethod : '-'}</td>
                    <td style={{ ...tdStyle, color: 'var(--success)' }} className="tabular-nums">
                      {entry.entryType === 'INCOME' ? formatAmount(entry.amount) : '-'}
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--error)' }} className="tabular-nums">
                      {entry.entryType === 'EXPENSE' ? formatAmount(Math.abs(entry.amount)) : '-'}
                    </td>
                    <td style={tdStyle} className="tabular-nums">{formatAmount(entry.runningBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

const thStyle: React.CSSProperties = { textAlign: 'right', padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 };
const tdStyle: React.CSSProperties = { padding: '12px', fontSize: 14 };
