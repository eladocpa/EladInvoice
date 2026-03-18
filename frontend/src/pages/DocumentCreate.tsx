import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { Customer } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
}

const DOC_TYPES_OSEK_PATUR = [
  { value: 'INVOICE', label: 'חשבונית עסקה' },
  { value: 'RECEIPT', label: 'קבלה' },
];

const DOC_TYPES_OSEK_MURSHE = [
  { value: 'INVOICE', label: 'חשבונית מס' },
  { value: 'RECEIPT', label: 'קבלה' },
  { value: 'RECEIPT_INVOICE', label: 'חשבונית מס קבלה' },
  { value: 'DELIVERY_NOTE', label: 'תעודת משלוח' },
  { value: 'CREDIT_NOTE', label: 'חשבונית זיכוי' },
];

function roundHalfUp(v: number): number {
  return Math.floor(v + 0.5);
}

export default function DocumentCreate() {
  const { business } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isOsekPatur = business?.businessType === 'OSEK_PATUR';
  const vatRate = isOsekPatur ? 0 : 17;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    documentType: searchParams.get('type') || 'INVOICE',
    customerId: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    currency: 'ILS',
    notes: '',
    paymentMethod: '',
    paymentReference: '',
    asDraft: false,
    originalDocumentId: '',
  });

  const [items, setItems] = useState<LineItem[]>([
    { description: '', quantity: 100, unitPrice: 0, discountPercent: 0 },
  ]);

  useEffect(() => {
    api.get('/customers').then(({ data }) => setCustomers(data)).catch(() => {});
  }, []);

  const addItem = () => {
    setItems([...items, { description: '', quantity: 100, unitPrice: 0, discountPercent: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof LineItem, value: string | number) => {
    setItems(items.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  // Calculate totals
  const calcLineTotal = (item: LineItem) => {
    const subtotal = roundHalfUp((item.quantity * item.unitPrice) / 100);
    if (item.discountPercent > 0) {
      return subtotal - roundHalfUp(subtotal * item.discountPercent / 10000);
    }
    return subtotal;
  };

  const subtotal = items.reduce((sum, item) => sum + calcLineTotal(item), 0);
  const vatAmount = isOsekPatur ? 0 : roundHalfUp(subtotal * vatRate / 100);
  const total = subtotal + vatAmount;

  const handleSubmit = async (asDraft: boolean) => {
    if (items.some(i => !i.description || i.unitPrice <= 0)) {
      toast.error('יש למלא תיאור ומחיר לכל פריט');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/documents', {
        ...form,
        asDraft,
        customerId: form.customerId || null,
        dueDate: form.dueDate || null,
        paymentMethod: form.paymentMethod || null,
        originalDocumentId: form.originalDocumentId || null,
        items: items.map((item, i) => ({
          ...item,
          vatIncluded: false,
          sortOrder: i,
        })),
      });

      toast.success(asDraft ? 'טיוטה נשמרה' : 'מסמך הופק בהצלחה!');
      navigate(`/documents/${data.id}`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error.response?.data?.error || 'שגיאה ביצירת מסמך');
    } finally {
      setLoading(false);
    }
  };

  const docTypes = isOsekPatur ? DOC_TYPES_OSEK_PATUR : DOC_TYPES_OSEK_MURSHE;

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>מסמך חדש</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Form side */}
        <div>
          <Card style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--accent-primary)' }}>
              פרטי מסמך
            </h2>
            <Select
              label="סוג מסמך"
              value={form.documentType}
              onChange={(e) => setForm({ ...form, documentType: e.target.value })}
              options={docTypes}
            />
            <Select
              label="לקוח"
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value })}
              options={[
                { value: '', label: 'בחר לקוח (אופציונלי)' },
                ...customers.map(c => ({ value: c.id, label: c.name })),
              ]}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input
                label="תאריך"
                type="date"
                value={form.issueDate}
                onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
              />
              <Input
                label="תאריך לתשלום"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Select
                label="מטבע"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                options={[
                  { value: 'ILS', label: '₪ שקל' },
                  { value: 'USD', label: '$ דולר' },
                  { value: 'EUR', label: '€ אירו' },
                ]}
              />
              <Select
                label="אמצעי תשלום"
                value={form.paymentMethod}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                options={[
                  { value: '', label: 'לא צוין' },
                  { value: 'CASH', label: 'מזומן' },
                  { value: 'CHECK', label: 'שיק' },
                  { value: 'BANK_TRANSFER', label: 'העברה בנקאית' },
                  { value: 'CREDIT_CARD', label: 'כרטיס אשראי' },
                  { value: 'OTHER', label: 'אחר' },
                ]}
              />
            </div>
            {form.paymentMethod === 'CHECK' && (
              <Input
                label="מספר שיק / אסמכתא"
                value={form.paymentReference}
                onChange={(e) => setForm({ ...form, paymentReference: e.target.value })}
              />
            )}
            {form.documentType === 'CREDIT_NOTE' && (
              <Input
                label="מזהה מסמך מקורי"
                value={form.originalDocumentId}
                onChange={(e) => setForm({ ...form, originalDocumentId: e.target.value })}
                tooltip="הזן את מזהה החשבונית המקורית שברצונך לזכות"
              />
            )}
          </Card>

          {/* Items */}
          <Card style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--accent-primary)' }}>
              פריטים
            </h2>
            {items.map((item, index) => (
              <div key={index} style={{
                padding: 16,
                background: 'var(--bg-primary)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 12,
                border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>פריט {index + 1}</span>
                  {items.length > 1 && (
                    <button
                      onClick={() => removeItem(index)}
                      style={{ background: 'none', border: 'none', color: 'var(--error)', fontSize: 13, cursor: 'pointer' }}
                    >
                      הסר
                    </button>
                  )}
                </div>
                <Input
                  label="תיאור"
                  value={item.description}
                  onChange={(e) => updateItem(index, 'description', e.target.value)}
                  placeholder="תיאור השירות או המוצר"
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <Input
                    label="כמות"
                    type="number"
                    value={item.quantity / 100}
                    onChange={(e) => updateItem(index, 'quantity', Math.round(parseFloat(e.target.value || '0') * 100))}
                    style={{ direction: 'ltr' }}
                  />
                  <Input
                    label="מחיר (₪)"
                    type="number"
                    value={item.unitPrice / 100}
                    onChange={(e) => updateItem(index, 'unitPrice', Math.round(parseFloat(e.target.value || '0') * 100))}
                    style={{ direction: 'ltr' }}
                  />
                  <Input
                    label="הנחה %"
                    type="number"
                    value={item.discountPercent / 100}
                    onChange={(e) => updateItem(index, 'discountPercent', Math.round(parseFloat(e.target.value || '0') * 100))}
                    style={{ direction: 'ltr' }}
                  />
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'left' }} className="tabular-nums">
                  סה"כ שורה: ₪{(calcLineTotal(item) / 100).toFixed(2)}
                </p>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={addItem}>
              + הוסף פריט
            </Button>
          </Card>

          {/* Notes */}
          <Card style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>הערות</h2>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="הערות למסמך (אופציונלי)"
              rows={3}
              style={{
                width: '100%',
                padding: 12,
                background: 'var(--bg-primary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xs)',
                color: 'var(--text-primary)',
                fontSize: 14,
                resize: 'vertical',
                direction: 'rtl',
                fontFamily: 'var(--font)',
              }}
            />
          </Card>
        </div>

        {/* Preview side */}
        <div>
          <Card style={{ position: 'sticky', top: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, color: 'var(--accent-primary)' }}>
              סיכום
            </h2>

            <div style={{ marginBottom: 20 }}>
              {items.filter(i => i.description).map((item, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom: '1px solid var(--border)',
                  fontSize: 14,
                }}>
                  <span>{item.description}</span>
                  <span className="tabular-nums">₪{(calcLineTotal(item) / 100).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '2px solid var(--border)', paddingTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
                <span style={{ color: 'var(--text-secondary)' }}>סכום ביניים:</span>
                <span className="tabular-nums">₪{(subtotal / 100).toFixed(2)}</span>
              </div>
              {!isOsekPatur && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>מע"מ ({vatRate}%):</span>
                  <span className="tabular-nums">₪{(vatAmount / 100).toFixed(2)}</span>
                </div>
              )}
              <div style={{
                display: 'flex', justifyContent: 'space-between', padding: '12px 0',
                fontSize: 22, fontWeight: 700, color: 'var(--accent-primary)',
                borderTop: '2px solid var(--accent-primary)', marginTop: 8,
              }}>
                <span>סה"כ:</span>
                <span className="tabular-nums">₪{(total / 100).toFixed(2)}</span>
              </div>
            </div>

            {isOsekPatur && (
              <div style={{
                background: 'rgba(255, 181, 71, 0.1)',
                border: '1px solid rgba(255, 181, 71, 0.3)',
                borderRadius: 'var(--radius-xs)',
                padding: 12,
                fontSize: 12,
                color: 'var(--warning)',
                marginTop: 12,
              }}>
                אינני רשום כעוסק מורשה, העסקה פטורה ממע"מ
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <Button variant="secondary" onClick={() => handleSubmit(true)} loading={loading} style={{ flex: 1 }}>
                שמור כטיוטה
              </Button>
              <Button onClick={() => handleSubmit(false)} loading={loading} style={{ flex: 2 }}>
                הפק מסמך
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
