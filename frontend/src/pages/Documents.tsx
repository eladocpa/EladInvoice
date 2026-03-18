import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { DocumentData } from '../lib/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import Select from '../components/ui/Select';
import { HiOutlinePlus, HiOutlineSearch } from 'react-icons/hi';

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

export default function Documents() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ type: '', status: '' });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    if (filter.type) params.set('type', filter.type);
    if (filter.status) params.set('status', filter.status);

    api.get(`/documents?${params}`)
      .then(({ data }) => {
        setDocuments(data.documents);
        setTotalPages(data.totalPages);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, filter]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>מסמכים</h1>
        <Button onClick={() => navigate('/documents/new')}>
          <HiOutlinePlus size={18} />
          מסמך חדש
        </Button>
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: 20, padding: 16 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'end' }}>
          <div style={{ minWidth: 160 }}>
            <Select
              label="סוג מסמך"
              value={filter.type}
              onChange={(e) => { setFilter(f => ({ ...f, type: e.target.value })); setPage(1); }}
              options={[
                { value: '', label: 'הכל' },
                { value: 'INVOICE', label: 'חשבונית' },
                { value: 'RECEIPT', label: 'קבלה' },
                { value: 'RECEIPT_INVOICE', label: 'חש. מס קבלה' },
                { value: 'CREDIT_NOTE', label: 'חש. זיכוי' },
                { value: 'DELIVERY_NOTE', label: 'ת. משלוח' },
              ]}
            />
          </div>
          <div style={{ minWidth: 160 }}>
            <Select
              label="סטטוס"
              value={filter.status}
              onChange={(e) => { setFilter(f => ({ ...f, status: e.target.value })); setPage(1); }}
              options={[
                { value: '', label: 'הכל' },
                { value: 'DRAFT', label: 'טיוטה' },
                { value: 'SENT', label: 'נשלח' },
                { value: 'PAID', label: 'שולם' },
                { value: 'CANCELLED', label: 'בוטל' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Documents table */}
      <Card>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>טוען...</div>
        ) : documents.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <HiOutlineSearch size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
            <p style={{ color: 'var(--text-muted)', fontSize: 16 }}>אין מסמכים</p>
            <Button style={{ marginTop: 16 }} onClick={() => navigate('/documents/new')}>
              הפק מסמך ראשון
            </Button>
          </div>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={thStyle}>סוג</th>
                  <th style={thStyle}>מספר</th>
                  <th style={thStyle}>לקוח</th>
                  <th style={thStyle}>תאריך</th>
                  <th style={thStyle}>סכום</th>
                  <th style={thStyle}>סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr
                    key={doc.id}
                    onClick={() => navigate(`/documents/${doc.id}`)}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={tdStyle}>{DOC_TYPE_LABELS[doc.documentType]}</td>
                    <td style={tdStyle} className="tabular-nums">{doc.documentNumber || '-'}</td>
                    <td style={tdStyle}>{doc.customer?.name || '-'}</td>
                    <td style={tdStyle}>{new Date(doc.issueDate).toLocaleDateString('he-IL')}</td>
                    <td style={tdStyle} className="tabular-nums">{formatAmount(doc.total)}</td>
                    <td style={tdStyle}><StatusBadge status={doc.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '16px 0' }}>
                <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  הקודם
                </Button>
                <span style={{ padding: '6px 12px', color: 'var(--text-secondary)', fontSize: 13 }}>
                  עמוד {page} מתוך {totalPages}
                </span>
                <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  הבא
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'right', padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500,
};
const tdStyle: React.CSSProperties = { padding: '12px', fontSize: 14 };
