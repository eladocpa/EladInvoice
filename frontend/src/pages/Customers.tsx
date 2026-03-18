import React, { useEffect, useState } from 'react';
import api, { Customer } from '../lib/api';
import toast from 'react-hot-toast';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineSearch } from 'react-icons/hi';

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', taxId: '', address: '', city: '', phone: '', email: '' });

  const fetchCustomers = (q?: string) => {
    const params = q ? `?search=${encodeURIComponent(q)}` : '';
    api.get(`/customers${params}`)
      .then(({ data }) => setCustomers(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCustomers(); }, []);

  const handleSearch = () => { fetchCustomers(search); };

  const resetForm = () => {
    setForm({ name: '', taxId: '', address: '', city: '', phone: '', email: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!form.name) { toast.error('שם לקוח חובה'); return; }
    try {
      if (editingId) {
        await api.put(`/customers/${editingId}`, form);
        toast.success('לקוח עודכן');
      } else {
        await api.post('/customers', form);
        toast.success('לקוח נוצר');
      }
      resetForm();
      fetchCustomers();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error.response?.data?.error || 'שגיאה');
    }
  };

  const handleEdit = (c: Customer) => {
    setForm({
      name: c.name,
      taxId: c.taxId || '',
      address: c.address || '',
      city: c.city || '',
      phone: c.phone || '',
      email: c.email || '',
    });
    setEditingId(c.id);
    setShowForm(true);
  };

  const handleDelete = async (c: Customer) => {
    if (!confirm(`למחוק את ${c.name}?`)) return;
    try {
      await api.delete(`/customers/${c.id}`);
      toast.success('לקוח נמחק');
      fetchCustomers();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error.response?.data?.error || 'שגיאה במחיקה');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>לקוחות</h1>
        <Button onClick={() => { resetForm(); setShowForm(true); }}>
          <HiOutlinePlus size={18} /> לקוח חדש
        </Button>
      </div>

      {/* Search */}
      <Card style={{ marginBottom: 20, padding: 16 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Input
              placeholder="חפש לפי שם, טלפון, מייל..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <Button variant="secondary" onClick={handleSearch} style={{ alignSelf: 'start', marginTop: 0 }}>
            <HiOutlineSearch size={18} />
          </Button>
        </div>
      </Card>

      {/* Form modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => resetForm()}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: 'var(--bg-card)', padding: 32, borderRadius: 'var(--radius)',
            width: 500, maxHeight: '90vh', overflow: 'auto', border: '1px solid var(--border)',
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>
              {editingId ? 'עריכת לקוח' : 'לקוח חדש'}
            </h2>
            <Input label="שם לקוח *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="ח.פ. / ת.ז." value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} tooltip="מספר זיהוי עסקי של הלקוח" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label="כתובת" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              <Input label="עיר" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label="טלפון" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Input label="מייל" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ direction: 'ltr', textAlign: 'right' }} />
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <Button variant="secondary" onClick={resetForm}>ביטול</Button>
              <Button onClick={handleSubmit}>{editingId ? 'עדכן' : 'צור לקוח'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Customers table */}
      <Card>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>טוען...</div>
        ) : customers.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 16, marginBottom: 16 }}>אין לקוחות עדיין</p>
            <Button onClick={() => setShowForm(true)}>הוסף לקוח ראשון</Button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={thStyle}>שם</th>
                <th style={thStyle}>ח.פ.</th>
                <th style={thStyle}>טלפון</th>
                <th style={thStyle}>מייל</th>
                <th style={thStyle}>עיר</th>
                <th style={thStyle}>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={tdStyle}><strong>{c.name}</strong></td>
                  <td style={tdStyle}>{c.taxId || '-'}</td>
                  <td style={tdStyle}>{c.phone || '-'}</td>
                  <td style={tdStyle}>{c.email || '-'}</td>
                  <td style={tdStyle}>{c.city || '-'}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => handleEdit(c)} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer' }}>
                        <HiOutlinePencil size={16} />
                      </button>
                      <button onClick={() => handleDelete(c)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}>
                        <HiOutlineTrash size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

const thStyle: React.CSSProperties = { textAlign: 'right', padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 };
const tdStyle: React.CSSProperties = { padding: '12px', fontSize: 14 };
