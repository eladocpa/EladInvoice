import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
} from 'chart.js';
import api, { DashboardStats } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import Card from '../components/ui/Card';
import StatusBadge from '../components/ui/StatusBadge';
import Button from '../components/ui/Button';
import { HiOutlineDocumentText, HiOutlineCash, HiOutlineClock, HiOutlineUsers } from 'react-icons/hi';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler);

const DOC_TYPE_LABELS: Record<string, string> = {
  INVOICE: 'חשבונית',
  RECEIPT: 'קבלה',
  RECEIPT_INVOICE: 'חש. מס קבלה',
  CREDIT_NOTE: 'חש. זיכוי',
  DELIVERY_NOTE: 'ת. משלוח',
};

function formatAmount(agorot: number): string {
  return '₪' + (agorot / 100).toLocaleString('he-IL', { minimumFractionDigits: 2 });
}

export default function Dashboard() {
  const { business } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/dashboard')
      .then(({ data }) => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" style={{ height: 120, borderRadius: 'var(--radius)' }} />
          ))}
        </div>
      </div>
    );
  }

  const kpis = [
    { label: 'הכנסות החודש', value: formatAmount(stats?.monthlyIncome || 0), icon: HiOutlineCash, color: 'var(--success)' },
    { label: 'מסמכים שהופקו', value: String(stats?.monthlyDocuments || 0), icon: HiOutlineDocumentText, color: 'var(--accent-primary)' },
    { label: 'ממתינים לתשלום', value: String(stats?.pendingPayment || 0), icon: HiOutlineClock, color: 'var(--warning)' },
    { label: 'לקוחות פעילים', value: String(stats?.activeCustomers || 0), icon: HiOutlineUsers, color: 'var(--accent-secondary)' },
  ];

  // Chart data
  const chartLabels = Object.keys(stats?.monthlyChart || {}).sort();
  const chartValues = chartLabels.map((k) => (stats?.monthlyChart[k] || 0) / 100);

  const monthNames = chartLabels.map((k) => {
    const [y, m] = k.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1);
    return date.toLocaleDateString('he-IL', { month: 'short' });
  });

  const chartData = {
    labels: monthNames,
    datasets: [{
      label: 'הכנסות',
      data: chartValues,
      fill: true,
      borderColor: '#6C63FF',
      backgroundColor: 'rgba(108, 99, 255, 0.1)',
      tension: 0.4,
      pointRadius: 4,
      pointBackgroundColor: '#6C63FF',
    }],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { parsed: { y: number | null } }) => `₪${(ctx.parsed.y ?? 0).toLocaleString('he-IL')}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#9B9BAA' },
      },
      x: {
        grid: { display: false },
        ticks: { color: '#9B9BAA' },
      },
    },
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>שלום, {business?.name}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="sm" onClick={() => navigate('/documents/new?type=INVOICE')}>
            + חשבונית
          </Button>
          <Button size="sm" variant="secondary" onClick={() => navigate('/documents/new?type=RECEIPT')}>
            + קבלה
          </Button>
          {business?.businessType === 'OSEK_MURSHE' && (
            <Button size="sm" variant="secondary" onClick={() => navigate('/documents/new?type=RECEIPT_INVOICE')}>
              + חש. מס קבלה
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{kpi.label}</p>
                  <p className="tabular-nums" style={{ fontSize: 28, fontWeight: 700, color: kpi.color }}>
                    {kpi.value}
                  </p>
                </div>
                <Icon size={24} style={{ color: kpi.color, opacity: 0.6 }} />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Chart */}
      <Card style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>הכנסות — 12 חודשים אחרונים</h2>
        {chartLabels.length > 0 ? (
          <Line data={chartData} options={chartOptions} />
        ) : (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>
            אין נתונים עדיין. התחל להפיק מסמכים!
          </p>
        )}
      </Card>

      {/* Recent documents */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>מסמכים אחרונים</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/documents')}>
            הצג הכל
          </Button>
        </div>
        {stats?.recentDocuments && stats.recentDocuments.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={thStyle}>סוג</th>
                <th style={thStyle}>מספר</th>
                <th style={thStyle}>לקוח</th>
                <th style={thStyle}>סכום</th>
                <th style={thStyle}>סטטוס</th>
                <th style={thStyle}>תאריך</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentDocuments.map((doc) => (
                <tr
                  key={doc.id}
                  onClick={() => navigate(`/documents/${doc.id}`)}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                >
                  <td style={tdStyle}>{DOC_TYPE_LABELS[doc.documentType] || doc.documentType}</td>
                  <td style={tdStyle} className="tabular-nums">{doc.documentNumber}</td>
                  <td style={tdStyle}>{doc.customer?.name || '-'}</td>
                  <td style={tdStyle} className="tabular-nums">{formatAmount(doc.total)}</td>
                  <td style={tdStyle}><StatusBadge status={doc.status} /></td>
                  <td style={tdStyle}>{new Date(doc.issueDate).toLocaleDateString('he-IL')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>
            אין מסמכים עדיין
          </p>
        )}
      </Card>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'right',
  padding: '10px 12px',
  fontSize: 12,
  color: 'var(--text-muted)',
  fontWeight: 500,
};

const tdStyle: React.CSSProperties = {
  padding: '12px',
  fontSize: 14,
};
