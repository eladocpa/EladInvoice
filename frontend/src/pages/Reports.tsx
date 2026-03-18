import React, { useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import api from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import Input from '../components/ui/Input';
import { HiOutlineDownload } from 'react-icons/hi';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function formatAmount(agorot: number): string {
  return '₪' + (agorot / 100).toLocaleString('he-IL', { minimumFractionDigits: 2 });
}

interface ReportData {
  period: { from: string; to: string };
  totalGross: number;
  totalVat: number;
  totalNet: number;
  documentCount: number;
  byCustomer: Array<{ name: string; total: number; count: number }>;
  byPaymentMethod: Record<string, { total: number; count: number }>;
  byMonth: Record<string, number>;
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'מזומן', CHECK: 'שיק', BANK_TRANSFER: 'העברה בנקאית',
  CREDIT_CARD: 'כרטיס אשראי', OTHER: 'אחר',
};

export default function Reports() {
  const { business } = useAuth();
  const isOsekPatur = business?.businessType === 'OSEK_PATUR';
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [period, setPeriod] = useState('monthly');
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState(String(currentMonth));
  const [quarter, setQuarter] = useState('1');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period, year });
      if (period === 'monthly') params.set('month', month);
      if (period === 'quarterly') params.set('quarter', quarter);
      if (period === 'custom') {
        params.set('startDate', startDate);
        params.set('endDate', endDate);
      }

      const { data } = await api.get(`/reports/income?${params}`);
      setReport(data);
    } catch {
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = () => {
    const from = report?.period?.from || `${year}-01-01`;
    const to = report?.period?.to || `${year}-12-31`;
    window.open(`/api/reports/income/excel?startDate=${from}&endDate=${to}`, '_blank');
  };

  // Chart
  const chartLabels = Object.keys(report?.byMonth || {}).sort().map(k => {
    const [, m] = k.split('-');
    const months = ['', 'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
    return months[parseInt(m)] || m;
  });
  const chartValues = Object.keys(report?.byMonth || {}).sort().map(k => (report?.byMonth[k] || 0) / 100);

  const chartData = {
    labels: chartLabels,
    datasets: [{
      label: 'הכנסות',
      data: chartValues,
      backgroundColor: 'rgba(108, 99, 255, 0.6)',
      borderColor: '#6C63FF',
      borderWidth: 1,
      borderRadius: 6,
    }],
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>דוחות הכנסות</h1>

      {/* Period selector */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'end' }}>
          <Select
            label="תקופה"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            options={[
              { value: 'monthly', label: 'חודשי' },
              { value: 'quarterly', label: 'רבעוני' },
              { value: 'yearly', label: 'שנתי' },
              { value: 'custom', label: 'טווח חופשי' },
            ]}
          />
          <Select
            label="שנה"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            options={Array.from({ length: 5 }, (_, i) => {
              const y = currentYear - i;
              return { value: String(y), label: String(y) };
            })}
          />
          {period === 'monthly' && (
            <Select
              label="חודש"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              options={Array.from({ length: 12 }, (_, i) => ({
                value: String(i + 1),
                label: ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'][i],
              }))}
            />
          )}
          {period === 'quarterly' && (
            <Select
              label="רבעון"
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
              options={[
                { value: '1', label: 'Q1 (ינואר-מרץ)' },
                { value: '2', label: 'Q2 (אפריל-יוני)' },
                { value: '3', label: 'Q3 (יולי-ספטמבר)' },
                { value: '4', label: 'Q4 (אוקטובר-דצמבר)' },
              ]}
            />
          )}
          {period === 'custom' && (
            <>
              <Input label="מתאריך" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <Input label="עד תאריך" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </>
          )}
          <Button onClick={generateReport} loading={loading} style={{ marginBottom: 16 }}>
            הפק דוח
          </Button>
        </div>
      </Card>

      {report && (
        <>
          {/* Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            <Card>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>הכנסות ברוטו</p>
              <p className="tabular-nums" style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>
                {formatAmount(report.totalGross)}
              </p>
            </Card>
            {!isOsekPatur && (
              <Card>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>מע"מ שנגבה</p>
                <p className="tabular-nums" style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-primary)' }}>
                  {formatAmount(report.totalVat)}
                </p>
              </Card>
            )}
            <Card>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>הכנסות נטו</p>
              <p className="tabular-nums" style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-secondary)' }}>
                {formatAmount(report.totalNet)}
              </p>
            </Card>
            <Card>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>מספר מסמכים</p>
              <p style={{ fontSize: 24, fontWeight: 700 }}>{report.documentCount}</p>
            </Card>
          </div>

          {/* Chart */}
          {chartLabels.length > 0 && (
            <Card style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>הכנסות לפי חודש</h2>
              <Bar data={chartData} options={{
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                  y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9B9BAA' } },
                  x: { grid: { display: false }, ticks: { color: '#9B9BAA' } },
                },
              }} />
            </Card>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
            {/* By customer */}
            <Card>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>לפי לקוח</h3>
              {report.byCustomer.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={thStyle}>לקוח</th>
                      <th style={thStyle}>מסמכים</th>
                      <th style={thStyle}>סכום</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byCustomer.map((c, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={tdStyle}>{c.name}</td>
                        <td style={tdStyle}>{c.count}</td>
                        <td style={tdStyle} className="tabular-nums">{formatAmount(c.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p style={{ color: 'var(--text-muted)' }}>אין נתונים</p>}
            </Card>

            {/* By payment method */}
            <Card>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>לפי אמצעי תשלום</h3>
              {Object.keys(report.byPaymentMethod).length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={thStyle}>אמצעי</th>
                      <th style={thStyle}>מסמכים</th>
                      <th style={thStyle}>סכום</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(report.byPaymentMethod).map(([method, data]) => (
                      <tr key={method} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={tdStyle}>{PAYMENT_LABELS[method] || method}</td>
                        <td style={tdStyle}>{data.count}</td>
                        <td style={tdStyle} className="tabular-nums">{formatAmount(data.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p style={{ color: 'var(--text-muted)' }}>אין נתונים</p>}
            </Card>
          </div>

          {/* Export */}
          <div style={{ display: 'flex', gap: 12 }}>
            <Button variant="secondary" onClick={exportExcel}>
              <HiOutlineDownload size={16} /> ייצוא לאקסל
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = { textAlign: 'right', padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 };
const tdStyle: React.CSSProperties = { padding: '10px 12px', fontSize: 14 };
