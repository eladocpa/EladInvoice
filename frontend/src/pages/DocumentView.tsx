import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { DocumentData } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import Input from '../components/ui/Input';
import {
  HiOutlineMail,
  HiOutlineDownload,
  HiOutlinePrinter,
  HiOutlineCheck,
  HiOutlineDocumentRemove,
} from 'react-icons/hi';

const DOC_TYPE_LABELS: Record<string, string> = {
  INVOICE: 'חשבונית',
  RECEIPT: 'קבלה',
  RECEIPT_INVOICE: 'חשבונית מס קבלה',
  CREDIT_NOTE: 'חשבונית זיכוי',
  DELIVERY_NOTE: 'תעודת משלוח',
};

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'מזומן', CHECK: 'שיק', BANK_TRANSFER: 'העברה בנקאית',
  CREDIT_CARD: 'כרטיס אשראי', OTHER: 'אחר',
};

function formatAmount(agorot: number): string {
  return '₪' + (agorot / 100).toLocaleString('he-IL', { minimumFractionDigits: 2 });
}

export default function DocumentView() {
  const { id } = useParams<{ id: string }>();
  const { business } = useAuth();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailModal, setEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [whatsappModal, setWhatsappModal] = useState(false);

  const isOsekPatur = business?.businessType === 'OSEK_PATUR';

  useEffect(() => {
    api.get(`/documents/${id}`)
      .then(({ data }) => {
        setDoc(data);
        setEmailTo(data.customer?.email || '');
        setWhatsappPhone(data.customer?.phone || '');
      })
      .catch(() => toast.error('מסמך לא נמצא'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleFinalize = async () => {
    try {
      const { data } = await api.post(`/documents/${id}/finalize`);
      setDoc(data);
      toast.success('המסמך הופק בהצלחה!');
    } catch {
      toast.error('שגיאה בהפקת המסמך');
    }
  };

  const handleMarkPaid = async () => {
    try {
      const { data } = await api.post(`/documents/${id}/mark-paid`, {});
      setDoc({ ...doc!, ...data });
      toast.success('המסמך סומן כשולם');
    } catch {
      toast.error('שגיאה בעדכון');
    }
  };

  const handleSendEmail = async () => {
    if (!emailTo) { toast.error('יש להזין כתובת מייל'); return; }
    try {
      await api.post(`/documents/${id}/send-email`, { recipientEmail: emailTo });
      toast.success('נשלח בהצלחה!');
      setEmailModal(false);
    } catch {
      toast.error('שגיאה בשליחה');
    }
  };

  const handleSendWhatsApp = async () => {
    if (!whatsappPhone) { toast.error('יש להזין מספר טלפון'); return; }
    try {
      const { data } = await api.post(`/documents/${id}/send-whatsapp`, { phone: whatsappPhone });
      if (data.type === 'link') {
        window.open(data.url, '_blank');
      } else {
        toast.success('נשלח בהצלחה!');
      }
      setWhatsappModal(false);
    } catch {
      toast.error('שגיאה בשליחה');
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const { data } = await api.get(`/documents/${id}/pdf`);
      window.open(data.pdfUrl, '_blank');
    } catch {
      toast.error('שגיאה בהורדת PDF');
    }
  };

  if (loading) return <div className="skeleton" style={{ height: 400, borderRadius: 'var(--radius)' }} />;
  if (!doc) return <p>מסמך לא נמצא</p>;

  const docTypeName = business?.businessType === 'OSEK_MURSHE' && doc.documentType === 'INVOICE'
    ? 'חשבונית מס'
    : DOC_TYPE_LABELS[doc.documentType];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/documents')} style={{ marginBottom: 8 }}>
            ← חזרה למסמכים
          </Button>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>
            {docTypeName} מספר {doc.documentNumber || '(טיוטה)'}
          </h1>
        </div>
        <StatusBadge status={doc.status} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        <div>
          {/* Document details */}
          <Card style={{ marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                <h3 style={{ fontSize: 14, color: 'var(--accent-primary)', marginBottom: 12 }}>פרטי מוציא</h3>
                <p style={{ fontWeight: 600 }}>{business?.name}</p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>ח.פ.: {business?.taxId}</p>
                {business?.vatNumber && <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>עוסק מורשה: {business.vatNumber}</p>}
              </div>
              {doc.customer && (
                <div>
                  <h3 style={{ fontSize: 14, color: 'var(--accent-primary)', marginBottom: 12 }}>פרטי נמען</h3>
                  <p style={{ fontWeight: 600 }}>{doc.customer.name}</p>
                  {doc.customer.taxId && <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>ח.פ.: {doc.customer.taxId}</p>}
                  {doc.customer.phone && <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>טל: {doc.customer.phone}</p>}
                </div>
              )}
            </div>
          </Card>

          {/* Items */}
          <Card style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, color: 'var(--accent-primary)', marginBottom: 12 }}>פריטים</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>תיאור</th>
                  <th style={thStyle}>כמות</th>
                  <th style={thStyle}>מחיר</th>
                  <th style={thStyle}>הנחה</th>
                  <th style={thStyle}>סה"כ</th>
                </tr>
              </thead>
              <tbody>
                {doc.items.map((item, i) => (
                  <tr key={item.id || i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={tdStyle}>{i + 1}</td>
                    <td style={tdStyle}>{item.description}</td>
                    <td style={tdStyle} className="tabular-nums">{item.quantity / 100}</td>
                    <td style={tdStyle} className="tabular-nums">{formatAmount(item.unitPrice)}</td>
                    <td style={tdStyle}>{item.discountPercent > 0 ? `${item.discountPercent / 100}%` : '-'}</td>
                    <td style={tdStyle} className="tabular-nums">{formatAmount(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ maxWidth: 300, marginRight: 'auto', marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ color: 'var(--text-secondary)' }}>סכום ביניים:</span>
                <span className="tabular-nums">{formatAmount(doc.subtotal)}</span>
              </div>
              {!isOsekPatur && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>מע"מ ({doc.vatRate}%):</span>
                  <span className="tabular-nums">{formatAmount(doc.vatAmount)}</span>
                </div>
              )}
              <div style={{
                display: 'flex', justifyContent: 'space-between', padding: '12px 0',
                fontSize: 20, fontWeight: 700, color: 'var(--accent-primary)',
                borderTop: '2px solid var(--accent-primary)',
              }}>
                <span>סה"כ:</span>
                <span className="tabular-nums">{formatAmount(doc.total)}</span>
              </div>
            </div>
          </Card>

          {doc.paymentMethod && (
            <Card style={{ marginBottom: 20 }}>
              <p><strong>אמצעי תשלום:</strong> {PAYMENT_LABELS[doc.paymentMethod]}</p>
              {doc.paymentReference && <p><strong>אסמכתא:</strong> {doc.paymentReference}</p>}
            </Card>
          )}

          {doc.notes && (
            <Card style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, color: 'var(--accent-primary)', marginBottom: 8 }}>הערות</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{doc.notes}</p>
            </Card>
          )}

          {isOsekPatur && (
            <div style={{
              background: 'rgba(255, 181, 71, 0.1)',
              border: '1px solid rgba(255, 181, 71, 0.3)',
              borderRadius: 'var(--radius-sm)',
              padding: 12,
              fontSize: 13,
              color: 'var(--warning)',
            }}>
              אינני רשום כעוסק מורשה, העסקה פטורה ממע"מ
            </div>
          )}
        </div>

        {/* Actions sidebar */}
        <div>
          <Card style={{ position: 'sticky', top: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>פעולות</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {doc.status === 'DRAFT' && (
                <Button onClick={handleFinalize} style={{ width: '100%' }}>
                  <HiOutlineCheck size={16} /> הפק מסמך
                </Button>
              )}
              {doc.status === 'SENT' && (
                <Button onClick={handleMarkPaid} variant="secondary" style={{ width: '100%' }}>
                  <HiOutlineCheck size={16} /> סמן כשולם
                </Button>
              )}
              {doc.status !== 'DRAFT' && (
                <>
                  <Button variant="secondary" onClick={() => setEmailModal(true)} style={{ width: '100%' }}>
                    <HiOutlineMail size={16} /> שלח במייל
                  </Button>
                  <Button variant="secondary" onClick={() => setWhatsappModal(true)} style={{ width: '100%' }}>
                    שלח בוואטסאפ
                  </Button>
                  <Button variant="secondary" onClick={handleDownloadPdf} style={{ width: '100%' }}>
                    <HiOutlineDownload size={16} /> הורד PDF
                  </Button>
                  <Button variant="secondary" onClick={() => window.print()} style={{ width: '100%' }}>
                    <HiOutlinePrinter size={16} /> הדפס
                  </Button>
                  {doc.status !== 'CANCELLED' && doc.status !== 'CREDIT_NOTED' && doc.documentType !== 'CREDIT_NOTE' && (
                    <Button
                      variant="danger"
                      onClick={() => navigate(`/documents/new?type=CREDIT_NOTE&originalId=${doc.id}`)}
                      style={{ width: '100%' }}
                    >
                      <HiOutlineDocumentRemove size={16} /> הפק חשבונית זיכוי
                    </Button>
                  )}
                </>
              )}
            </div>

            <div style={{ marginTop: 20, fontSize: 12, color: 'var(--text-muted)' }}>
              <p>תאריך: {new Date(doc.issueDate).toLocaleDateString('he-IL')}</p>
              {doc.dueDate && <p>לתשלום עד: {new Date(doc.dueDate).toLocaleDateString('he-IL')}</p>}
              <p>נוצר: {new Date(doc.createdAt).toLocaleString('he-IL')}</p>
            </div>
          </Card>
        </div>
      </div>

      {/* Email modal */}
      {emailModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setEmailModal(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-card)', padding: 32, borderRadius: 'var(--radius)', width: 400, border: '1px solid var(--border)' }}>
            <h3 style={{ marginBottom: 16 }}>שלח במייל</h3>
            <Input label="כתובת מייל" type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} style={{ direction: 'ltr' }} />
            <div style={{ display: 'flex', gap: 12 }}>
              <Button variant="secondary" onClick={() => setEmailModal(false)}>ביטול</Button>
              <Button onClick={handleSendEmail}>שלח</Button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp modal */}
      {whatsappModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setWhatsappModal(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-card)', padding: 32, borderRadius: 'var(--radius)', width: 400, border: '1px solid var(--border)' }}>
            <h3 style={{ marginBottom: 16 }}>שלח בוואטסאפ</h3>
            <Input label="מספר טלפון" value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value)} placeholder="050-1234567" />
            <div style={{ display: 'flex', gap: 12 }}>
              <Button variant="secondary" onClick={() => setWhatsappModal(false)}>ביטול</Button>
              <Button onClick={handleSendWhatsApp}>שלח</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = { textAlign: 'right', padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 };
const tdStyle: React.CSSProperties = { padding: '12px', fontSize: 14 };
