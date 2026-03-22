import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { Customer } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import DateInput from '../components/ui/DateInput';

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

const CURRENCY_OPTIONS = [
  { value: 'ILS', label: '₪ שקל' },
  { value: 'USD', label: '$ דולר' },
  { value: 'EUR', label: '€ אירו' },
  { value: 'BTC', label: '₿ ביטקוין' },
  { value: 'ETH', label: 'Ξ את\'ריום' },
  { value: 'USDT', label: '₮ USDT' },
  { value: 'USDC', label: '$ USDC' },
];

function roundHalfUp(v: number): number {
  return Math.floor(v + 0.5);
}

function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    ILS: '₪', USD: '$', EUR: '€',
    BTC: '₿', ETH: 'Ξ', USDT: '₮', USDC: '$',
  };
  return symbols[currency] || currency;
}

/** Red asterisk for mandatory fields */
function req(label: string): string {
  return label + ' *';
}

/** Format ISO date to dd/mm/yyyy */
function formatDateDisplay(isoDate: string): string {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

export default function DocumentCreate() {
  const { business } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isOsekPatur = business?.businessType === 'OSEK_PATUR';
  const vatRate = isOsekPatur ? 0 : 18;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Quick customer creation
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', taxId: '', phone: '', email: '' });
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  // Customer mode: 'select' | 'new'
  const [customerMode, setCustomerMode] = useState<'select' | 'new'>('select');

  // Exchange rate
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [fetchingRate, setFetchingRate] = useState(false);

  // Date sequence validation
  const [lastDocDate, setLastDocDate] = useState<string | null>(null);
  const [dateOverride, setDateOverride] = useState(false);

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
    noVat: false,
    withholdingTaxPercent: 0,
    payerBankName: '',
    payerBankBranch: '',
    payerBankAccount: '',
  });

  const [items, setItems] = useState<LineItem[]>([
    { description: '', quantity: 100, unitPrice: 0, discountPercent: 0 },
  ]);

  useEffect(() => {
    api.get('/customers').then(({ data }) => setCustomers(data)).catch(() => {});
    api.get('/documents/last-date').then(({ data }) => {
      if (data.lastDate) setLastDocDate(data.lastDate);
    }).catch(() => {});
  }, []);

  // Fetch exchange rate when currency changes
  const fetchExchangeRate = useCallback(async (currency: string) => {
    if (currency === 'ILS') {
      setExchangeRate(null);
      return;
    }
    setFetchingRate(true);
    try {
      const { data } = await api.get(`/documents/exchange-rate/${currency}`);
      setExchangeRate(data.rate);
    } catch {
      toast.error('לא ניתן לקבל שער חליפין');
      setExchangeRate(null);
    } finally {
      setFetchingRate(false);
    }
  }, []);

  useEffect(() => {
    fetchExchangeRate(form.currency);
  }, [form.currency, fetchExchangeRate]);

  const addItem = () => {
    setItems([...items, { description: '', quantity: 100, unitPrice: 0, discountPercent: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof LineItem, value: string | number) => {
    setItems(items.map((item, i) => i === index ? { ...item, [field]: value } : item));
    // Clear item-level errors when user edits
    setFieldErrors(prev => {
      const next = { ...prev };
      delete next[`items.${index}.${field}`];
      return next;
    });
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
  const useNoVat = form.noVat && !isOsekPatur;
  const effectiveVatRate = (isOsekPatur || useNoVat) ? 0 : vatRate;
  const vatAmount = effectiveVatRate === 0 ? 0 : roundHalfUp(subtotal * effectiveVatRate / 100);
  const total = subtotal + vatAmount;

  // Withholding tax
  const withholdingAmount = form.withholdingTaxPercent > 0
    ? Math.round(total * form.withholdingTaxPercent / 10000)
    : 0;
  const netAfterTax = total - withholdingAmount;

  // ILS equivalent for foreign currency
  const isForeignCurrency = form.currency !== 'ILS';
  const ilsSubtotal = exchangeRate ? Math.round(subtotal * exchangeRate) : null;
  const ilsVatAmount = exchangeRate ? Math.round(vatAmount * exchangeRate) : null;
  const ilsTotal = exchangeRate ? Math.round(total * exchangeRate) : null;

  const currSymbol = getCurrencySymbol(form.currency);

  // Quick create customer
  const handleCreateCustomer = async () => {
    if (!newCustomer.name || newCustomer.name.length < 2) {
      toast.error('שם לקוח חייב להכיל לפחות 2 תווים');
      return;
    }
    setCreatingCustomer(true);
    try {
      const { data } = await api.post('/customers', newCustomer);
      setCustomers(prev => [...prev, data]);
      setForm(prev => ({ ...prev, customerId: data.id }));
      setCustomerMode('select');
      setShowNewCustomer(false);
      setNewCustomer({ name: '', taxId: '', phone: '', email: '' });
      toast.success('לקוח נוצר בהצלחה');
    } catch {
      toast.error('שגיאה ביצירת לקוח');
    } finally {
      setCreatingCustomer(false);
    }
  };

  const docTypes = isOsekPatur ? DOC_TYPES_OSEK_PATUR : DOC_TYPES_OSEK_MURSHE;
  const isReceipt = ['RECEIPT', 'RECEIPT_INVOICE'].includes(form.documentType);
  const showPayerBank = isReceipt && ['BANK_TRANSFER', 'CHECK'].includes(form.paymentMethod);

  // Client-side validation
  const validate = (): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (!form.issueDate) errors.issueDate = 'שדה חובה';

    // Date sequence validation
    if (form.issueDate && lastDocDate && form.issueDate < lastDocDate && !dateOverride) {
      const [y, m, d] = lastDocDate.split('-');
      errors.issueDate = `תאריך מוקדם מהמסמך האחרון (${d}/${m}/${y}). יש לסמן אישור חריגה`;
    }

    // Items validation
    items.forEach((item, i) => {
      if (!item.description) errors[`items.${i}.description`] = 'יש למלא תיאור';
      if (item.unitPrice <= 0) errors[`items.${i}.unitPrice`] = 'יש להזין מחיר';
    });

    // Receipt-specific validation
    if (isReceipt && showPayerBank) {
      if (!form.payerBankName) errors.payerBankName = 'יש למלא שם בנק';
    }

    // Credit note must have original document
    if (form.documentType === 'CREDIT_NOTE' && !form.originalDocumentId) {
      errors.originalDocumentId = 'יש להזין מזהה מסמך מקורי';
    }

    return errors;
  };

  // Build readable error summary for toast
  const getErrorSummary = (errors: Record<string, string>): string => {
    const messages: string[] = [];
    for (const [key, msg] of Object.entries(errors)) {
      if (key.startsWith('items.')) {
        const idx = parseInt(key.split('.')[1]);
        const field = key.split('.')[2];
        const fieldName = field === 'description' ? 'תיאור' : 'מחיר';
        messages.push(`פריט ${idx + 1}: ${fieldName} - ${msg}`);
      } else if (key === 'issueDate') {
        messages.push(`תאריך: ${msg}`);
      } else if (key === 'payerBankName') {
        messages.push(`שם בנק משלם: ${msg}`);
      } else if (key === 'originalDocumentId') {
        messages.push(`מזהה מסמך מקורי: ${msg}`);
      } else {
        messages.push(msg);
      }
    }
    return messages.join('\n');
  };

  const handleSubmit = async (asDraft: boolean) => {
    // Clear previous errors
    setFieldErrors({});

    // Client-side validation
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error(getErrorSummary(errors), { duration: 5000, style: { whiteSpace: 'pre-line', textAlign: 'right' } });
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/documents', {
        ...form,
        asDraft,
        customerId: form.customerId || null,
        dueDate: isReceipt ? (form.dueDate || null) : null,
        paymentMethod: isReceipt ? (form.paymentMethod || null) : null,
        paymentReference: isReceipt ? (form.paymentReference || null) : null,
        originalDocumentId: form.originalDocumentId || null,
        withholdingTaxPercent: isReceipt && form.withholdingTaxPercent > 0 ? form.withholdingTaxPercent : null,
        payerBankName: isReceipt ? (form.payerBankName || null) : null,
        payerBankBranch: isReceipt ? (form.payerBankBranch || null) : null,
        payerBankAccount: isReceipt ? (form.payerBankAccount || null) : null,
        items: items.map((item, i) => ({
          ...item,
          vatIncluded: false,
          sortOrder: i,
        })),
      });

      if (data.allocationPending) {
        toast.error(data.allocationResult?.errorMessage || 'רשות המסים דחתה את הבקשה — יש לבחור פעולה');
        navigate(`/documents/${data.id}`);
      } else {
        toast.success(asDraft ? 'טיוטה נשמרה' : 'מסמך הופק בהצלחה!');
        navigate(`/documents/${data.id}`);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string; code?: string; details?: Array<{ field: string; message: string }> } } };
      if (error.response?.data?.code === 'ALLOCATION_NO_CREDENTIALS') {
        toast.error('יש להגדיר חיבור לחשבונית ישראל בהגדרות');
        navigate('/settings');
      } else if (error.response?.data?.details) {
        // Map backend validation errors to field errors
        const backendErrors: Record<string, string> = {};
        for (const detail of error.response.data.details) {
          backendErrors[detail.field] = detail.message;
        }
        setFieldErrors(backendErrors);
        toast.error(getErrorSummary(backendErrors), { duration: 5000, style: { whiteSpace: 'pre-line', textAlign: 'right' } });
      } else {
        toast.error(error.response?.data?.error || 'שגיאה ביצירת מסמך');
      }
    } finally {
      setLoading(false);
    }
  };

  // Helper to clear field error when editing
  const updateForm = (updates: Partial<typeof form>) => {
    setForm(prev => ({ ...prev, ...updates }));
    // Clear errors for the updated fields
    setFieldErrors(prev => {
      const next = { ...prev };
      for (const key of Object.keys(updates)) {
        delete next[key];
      }
      return next;
    });
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>מסמך חדש</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Form side */}
        <div>
          {/* Document details */}
          <Card style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--accent-primary)' }}>
              פרטי מסמך
            </h2>
            <Select
              label={req('סוג מסמך')}
              value={form.documentType}
              error={fieldErrors.documentType}
              onChange={(e) => {
                const newType = e.target.value;
                const newIsReceipt = ['RECEIPT', 'RECEIPT_INVOICE'].includes(newType);
                setForm({
                  ...form,
                  documentType: newType,
                  ...(!newIsReceipt ? {
                    paymentMethod: '',
                    paymentReference: '',
                    payerBankName: '',
                    payerBankBranch: '',
                    payerBankAccount: '',
                    withholdingTaxPercent: 0,
                    dueDate: '',
                  } : {}),
                });
                setFieldErrors(prev => { const n = { ...prev }; delete n.documentType; return n; });
              }}
              options={docTypes}
            />

            {/* Customer selection: select existing or create new */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>
                לקוח
              </label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button
                  onClick={() => { setCustomerMode('select'); setShowNewCustomer(false); }}
                  style={{
                    flex: 1, padding: '8px 12px', fontSize: 13, borderRadius: 'var(--radius-xs)',
                    border: `1px solid ${customerMode === 'select' ? 'var(--accent-primary)' : 'var(--border)'}`,
                    background: customerMode === 'select' ? 'var(--accent-primary)' : 'var(--bg-primary)',
                    color: customerMode === 'select' ? 'white' : 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  בחר לקוח
                </button>
                <button
                  onClick={() => { setCustomerMode('new'); setShowNewCustomer(true); }}
                  style={{
                    flex: 1, padding: '8px 12px', fontSize: 13, borderRadius: 'var(--radius-xs)',
                    border: `1px solid ${customerMode === 'new' ? 'var(--accent-primary)' : 'var(--border)'}`,
                    background: customerMode === 'new' ? 'var(--accent-primary)' : 'var(--bg-primary)',
                    color: customerMode === 'new' ? 'white' : 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  + לקוח חדש
                </button>
              </div>

              {customerMode === 'select' && (
                <Select
                  value={form.customerId}
                  onChange={(e) => updateForm({ customerId: e.target.value })}
                  options={[
                    { value: '', label: 'בחר לקוח (אופציונלי)' },
                    ...customers.map(c => ({ value: c.id, label: c.name })),
                  ]}
                />
              )}

              {customerMode === 'new' && showNewCustomer && (
                <div style={{
                  padding: 16, background: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                }}>
                  <Input
                    label={req('שם לקוח')}
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    placeholder="שם הלקוח"
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <Input
                      label="ח.פ. / ת.ז."
                      value={newCustomer.taxId}
                      onChange={(e) => setNewCustomer({ ...newCustomer, taxId: e.target.value })}
                    />
                    <Input
                      label="טלפון"
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    />
                  </div>
                  <Input
                    label="אימייל"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  />
                  <Button
                    size="sm"
                    onClick={handleCreateCustomer}
                    loading={creatingCustomer}
                    style={{ marginTop: 8 }}
                  >
                    צור לקוח ושייך למסמך
                  </Button>
                </div>
              )}
            </div>

            {/* Issue date only */}
            <DateInput
              label={req('תאריך')}
              value={form.issueDate}
              error={fieldErrors.issueDate}
              onChange={(val) => {
                updateForm({ issueDate: val });
                // Reset override when date changes
                setDateOverride(false);
              }}
              min={(!dateOverride && lastDocDate) ? lastDocDate : undefined}
            />

            {/* Date sequence warning + override */}
            {form.issueDate && lastDocDate && form.issueDate < lastDocDate && (
              <div style={{
                padding: 12,
                background: 'rgba(231, 76, 60, 0.08)',
                border: '1px solid rgba(231, 76, 60, 0.3)',
                borderRadius: 'var(--radius-xs)',
                marginBottom: 12,
                fontSize: 13,
              }}>
                <p style={{ color: 'var(--error)', marginBottom: 8 }}>
                  תאריך המסמך ({formatDateDisplay(form.issueDate)}) מוקדם מתאריך המסמך האחרון ({formatDateDisplay(lastDocDate)}).
                  הזנת תאריך מוקדם עלולה לפגוע ברצף התאריכים.
                </p>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)',
                }}>
                  <input
                    type="checkbox"
                    checked={dateOverride}
                    onChange={(e) => {
                      setDateOverride(e.target.checked);
                      // Clear date error when override is checked
                      if (e.target.checked) {
                        setFieldErrors(prev => { const n = { ...prev }; delete n.issueDate; return n; });
                      }
                    }}
                    style={{ width: 16, height: 16 }}
                  />
                  <span>בהתייעצות עם רואה חשבון — אישור חריגה מרצף התאריכים</span>
                </label>
              </div>
            )}

            {/* Currency */}
            <Select
              label="מטבע"
              value={form.currency}
              onChange={(e) => updateForm({ currency: e.target.value })}
              options={CURRENCY_OPTIONS}
            />

            {/* Exchange rate display */}
            {isForeignCurrency && (
              <div style={{
                padding: 10, background: 'rgba(108, 99, 255, 0.08)',
                borderRadius: 'var(--radius-xs)', fontSize: 13,
                marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                {fetchingRate ? (
                  <span>טוען שער חליפין...</span>
                ) : exchangeRate ? (
                  <>
                    <span>שער יציג: 1 {CURRENCY_OPTIONS.find(c => c.value === form.currency)?.label?.split(' ')[1]} = ₪{exchangeRate.toFixed(4)}</span>
                    <button
                      onClick={() => fetchExchangeRate(form.currency)}
                      style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: 12 }}
                    >
                      רענן שער
                    </button>
                  </>
                ) : (
                  <span style={{ color: 'var(--warning)' }}>לא ניתן לקבל שער חליפין</span>
                )}
              </div>
            )}

            {/* No VAT checkbox — only for osek murshe on invoices */}
            {!isOsekPatur && ['INVOICE', 'RECEIPT_INVOICE'].includes(form.documentType) && (
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 14, cursor: 'pointer', marginBottom: 12,
                padding: 10, background: 'var(--bg-primary)',
                borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)',
              }}>
                <input
                  type="checkbox"
                  checked={form.noVat}
                  onChange={(e) => updateForm({ noVat: e.target.checked })}
                  style={{ width: 18, height: 18 }}
                />
                <span>מסמך ללא מע"מ</span>
              </label>
            )}

            {form.documentType === 'CREDIT_NOTE' && (
              <Input
                label={req('מזהה מסמך מקורי')}
                value={form.originalDocumentId}
                error={fieldErrors.originalDocumentId}
                onChange={(e) => updateForm({ originalDocumentId: e.target.value })}
                tooltip="הזן את מזהה החשבונית המקורית שברצונך לזכות"
              />
            )}
          </Card>

          {/* Items — BEFORE payment details */}
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
                border: `1px solid ${(fieldErrors[`items.${index}.description`] || fieldErrors[`items.${index}.unitPrice`]) ? 'var(--error)' : 'var(--border)'}`,
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
                  label={req('תיאור')}
                  value={item.description}
                  error={fieldErrors[`items.${index}.description`]}
                  onChange={(e) => updateItem(index, 'description', e.target.value)}
                  placeholder="תיאור השירות או המוצר"
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <Input
                    label={req('כמות')}
                    type="number"
                    value={item.quantity / 100}
                    onChange={(e) => updateItem(index, 'quantity', Math.round(parseFloat(e.target.value || '0') * 100))}
                    style={{ direction: 'ltr' }}
                  />
                  <Input
                    label={req(`מחיר (${currSymbol})`)}
                    type="number"
                    value={item.unitPrice / 100}
                    error={fieldErrors[`items.${index}.unitPrice`]}
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
                  סה"כ שורה: {currSymbol}{(calcLineTotal(item) / 100).toFixed(2)}
                  {isForeignCurrency && exchangeRate && (
                    <span style={{ color: 'var(--text-muted)', marginRight: 8 }}>
                      {' '}(₪{(Math.round(calcLineTotal(item) * exchangeRate) / 100).toFixed(2)})
                    </span>
                  )}
                </p>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={addItem}>
              + הוסף פריט
            </Button>
          </Card>

          {/* Payment details — only for receipts, AFTER items */}
          {isReceipt && (
            <Card style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--accent-primary)' }}>
                פרטי תשלום
              </h2>

              {/* Due date under payment section */}
              <DateInput
                label="תאריך תשלום"
                value={form.dueDate}
                onChange={(val) => updateForm({ dueDate: val })}
              />

              <Select
                label="אמצעי תשלום"
                value={form.paymentMethod}
                onChange={(e) => updateForm({ paymentMethod: e.target.value })}
                options={[
                  { value: '', label: 'לא צוין' },
                  { value: 'CASH', label: 'מזומן' },
                  { value: 'CHECK', label: 'שיק' },
                  { value: 'BANK_TRANSFER', label: 'העברה בנקאית' },
                  { value: 'CREDIT_CARD', label: 'כרטיס אשראי' },
                  { value: 'OTHER', label: 'אחר' },
                ]}
              />

              {form.paymentMethod === 'CHECK' && (
                <Input
                  label="מספר שיק / אסמכתא"
                  value={form.paymentReference}
                  onChange={(e) => updateForm({ paymentReference: e.target.value })}
                />
              )}

              {/* Payer bank details — mandatory for bank transfer and check */}
              {showPayerBank && (
                <div style={{
                  padding: 12, background: 'var(--bg-primary)',
                  border: `1px solid ${fieldErrors.payerBankName ? 'var(--error)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)',
                  marginTop: 8,
                }}>
                  <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'var(--text-secondary)' }}>
                    פרטי חשבון בנק משלם *
                  </p>
                  <Input
                    label={req('שם בנק')}
                    value={form.payerBankName}
                    error={fieldErrors.payerBankName}
                    onChange={(e) => updateForm({ payerBankName: e.target.value })}
                    placeholder="לדוגמה: הפועלים"
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <Input
                      label="מספר סניף"
                      value={form.payerBankBranch}
                      onChange={(e) => updateForm({ payerBankBranch: e.target.value })}
                    />
                    <Input
                      label="מספר חשבון"
                      value={form.payerBankAccount}
                      onChange={(e) => updateForm({ payerBankAccount: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* Withholding tax */}
              <div style={{ marginTop: 12 }}>
                <Input
                  label="ניכוי מס במקור (%)"
                  type="number"
                  value={form.withholdingTaxPercent / 100}
                  onChange={(e) => updateForm({ withholdingTaxPercent: Math.round(parseFloat(e.target.value || '0') * 100) })}
                  style={{ direction: 'ltr' }}
                  placeholder="לדוגמה: 20"
                />
              </div>
            </Card>
          )}

          {/* Notes */}
          <Card style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>הערות</h2>
            <textarea
              value={form.notes}
              onChange={(e) => updateForm({ notes: e.target.value })}
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
                  <span className="tabular-nums">
                    {isForeignCurrency && exchangeRate
                      ? `₪${(Math.round(calcLineTotal(item) * exchangeRate) / 100).toFixed(2)}`
                      : `₪${(calcLineTotal(item) / 100).toFixed(2)}`
                    }
                  </span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '2px solid var(--border)', paddingTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
                <span style={{ color: 'var(--text-secondary)' }}>סכום ביניים:</span>
                <span className="tabular-nums">
                  ₪{isForeignCurrency && ilsSubtotal !== null
                    ? (ilsSubtotal / 100).toFixed(2)
                    : (subtotal / 100).toFixed(2)
                  }
                </span>
              </div>
              {effectiveVatRate > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>מע"מ ({effectiveVatRate}%):</span>
                  <span className="tabular-nums">
                    ₪{isForeignCurrency && ilsVatAmount !== null
                      ? (ilsVatAmount / 100).toFixed(2)
                      : (vatAmount / 100).toFixed(2)
                    }
                  </span>
                </div>
              )}
              <div style={{
                display: 'flex', justifyContent: 'space-between', padding: '12px 0',
                fontSize: 22, fontWeight: 700, color: 'var(--accent-primary)',
                borderTop: '2px solid var(--accent-primary)', marginTop: 8,
              }}>
                <span>סה"כ:</span>
                <span className="tabular-nums">
                  ₪{isForeignCurrency && ilsTotal !== null
                    ? (ilsTotal / 100).toFixed(2)
                    : (total / 100).toFixed(2)
                  }
                </span>
              </div>

              {/* Original currency note */}
              {isForeignCurrency && exchangeRate && (
                <div style={{
                  fontSize: 12, color: 'var(--text-muted)', padding: '4px 0',
                }}>
                  סכום מקורי: {currSymbol}{(total / 100).toFixed(2)} | שער: {exchangeRate.toFixed(4)}
                </div>
              )}

              {/* Withholding tax in summary */}
              {form.withholdingTaxPercent > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14, color: 'var(--error)' }}>
                    <span>ניכוי מס במקור ({(form.withholdingTaxPercent / 100).toFixed(1)}%):</span>
                    <span className="tabular-nums">
                      -₪{isForeignCurrency && exchangeRate
                        ? (Math.round(withholdingAmount * exchangeRate) / 100).toFixed(2)
                        : (withholdingAmount / 100).toFixed(2)
                      }
                    </span>
                  </div>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', padding: '8px 0',
                    fontSize: 16, fontWeight: 600,
                  }}>
                    <span>לתשלום בפועל:</span>
                    <span className="tabular-nums">
                      ₪{isForeignCurrency && exchangeRate
                        ? (Math.round(netAfterTax * exchangeRate) / 100).toFixed(2)
                        : (netAfterTax / 100).toFixed(2)
                      }
                    </span>
                  </div>
                </>
              )}
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

            {useNoVat && (
              <div style={{
                background: 'rgba(255, 181, 71, 0.1)',
                border: '1px solid rgba(255, 181, 71, 0.3)',
                borderRadius: 'var(--radius-xs)',
                padding: 12,
                fontSize: 12,
                color: 'var(--warning)',
                marginTop: 12,
              }}>
                מסמך ללא מע"מ
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
