import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

type TabKey = 'business' | 'password' | 'brand' | 'chavonit';

export default function Settings() {
  const { business, refreshUser } = useAuth();
  const isOsekMurshe = business?.businessType === 'OSEK_MURSHE';
  const [tab, setTab] = useState<TabKey>('business');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: '', address: '', city: '', phone: '', email: '',
    bankName: '', bankBranch: '', bankAccount: '',
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '', newPassword: '', confirmPassword: '',
  });

  const [brandForm, setBrandForm] = useState({
    primaryColor: '#6C63FF',
    secondaryColor: '#00D4AA',
  });

  const [chavonitForm, setChavonitForm] = useState({
    clientId: '',
    clientSecret: '',
  });
  const [chavonitThreshold, setChavonitThreshold] = useState(10000);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    if (business) {
      setForm({
        name: business.name || '',
        address: business.address || '',
        city: business.city || '',
        phone: business.phone || '',
        email: business.email || '',
        bankName: business.bankName || '',
        bankBranch: business.bankBranch || '',
        bankAccount: business.bankAccount || '',
      });
      setBrandForm({
        primaryColor: business.primaryColor || '#6C63FF',
        secondaryColor: business.secondaryColor || '#00D4AA',
      });
      setChavonitForm({
        clientId: business.chavonitClientId || '',
        clientSecret: business.chavonitClientSecret || '',
      });
    }
  }, [business]);

  useEffect(() => {
    if (isOsekMurshe) {
      api.get('/documents/allocation-info')
        .then(({ data }) => setChavonitThreshold(data.threshold))
        .catch(() => {});
    }
  }, [isOsekMurshe]);

  const handleUpdateBusiness = async () => {
    setLoading(true);
    try {
      await api.put('/businesses/current', form);
      await refreshUser();
      toast.success('פרטי העסק עודכנו');
    } catch {
      toast.error('שגיאה בעדכון');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('הסיסמאות לא תואמות');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error('סיסמה חדשה חייבת להכיל לפחות 8 תווים');
      return;
    }
    setLoading(true);
    try {
      await api.post('/settings/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      toast.success('סיסמה עודכנה בהצלחה');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error.response?.data?.error || 'שגיאה בעדכון סיסמה');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBrand = async () => {
    setLoading(true);
    try {
      await api.put('/businesses/current', brandForm);
      await refreshUser();
      toast.success('צבעי המותג עודכנו');
    } catch {
      toast.error('שגיאה בעדכון');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      toast.error('הקובץ גדול מדי (מקסימום 500KB)');
      return;
    }
    const formData = new FormData();
    formData.append('logo', file);
    try {
      await api.post('/businesses/current/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await refreshUser();
      toast.success('הלוגו הועלה בהצלחה');
    } catch {
      toast.error('שגיאה בהעלאת הלוגו');
    }
  };

  const handleSaveChavonit = async () => {
    setLoading(true);
    try {
      await api.put('/businesses/current', {
        chavonitClientId: chavonitForm.clientId || null,
        chavonitClientSecret: chavonitForm.clientSecret || null,
      });
      await refreshUser();
      toast.success('פרטי חשבונית ישראל עודכנו');
    } catch {
      toast.error('שגיאה בעדכון');
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!chavonitForm.clientId || !chavonitForm.clientSecret) {
      toast.error('יש למלא Client ID ו-Client Secret');
      return;
    }
    setTestingConnection(true);
    setTestResult(null);
    try {
      const { data } = await api.post('/documents/test-allocation', {
        clientId: chavonitForm.clientId,
        clientSecret: chavonitForm.clientSecret,
      });
      setTestResult(data);
    } catch {
      setTestResult({ success: false, message: 'שגיאה בבדיקת החיבור' });
    } finally {
      setTestingConnection(false);
    }
  };

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'business', label: 'פרטי עסק' },
    { key: 'brand', label: 'מיתוג' },
    ...(isOsekMurshe ? [{ key: 'chavonit' as TabKey, label: 'חשבונית ישראל' }] : []),
    { key: 'password', label: 'סיסמה' },
  ];

  const hasChavonitCredentials = !!(business?.chavonitClientId && business?.chavonitClientSecret);

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>הגדרות</h1>

      {/* Warning banner for missing chavonit credentials */}
      {isOsekMurshe && !hasChavonitCredentials && (
        <div style={{
          background: 'rgba(255, 181, 71, 0.15)',
          border: '1px solid rgba(255, 181, 71, 0.4)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 16px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span style={{ fontSize: 20 }}>&#9888;</span>
          <div>
            <p style={{ fontSize: 14, color: 'var(--warning)', fontWeight: 600 }}>
              לא הגדרת חיבור לחשבונית ישראל
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              חובה חוקית לחשבוניות מעל {chavonitThreshold.toLocaleString('he-IL')} ₪ (לפני מע"מ).{' '}
              <button
                onClick={() => setTab('chavonit')}
                style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', textDecoration: 'underline', fontSize: 13 }}
              >
                הגדר עכשיו
              </button>
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 20px',
              background: tab === t.key ? 'var(--accent-primary)' : 'transparent',
              color: tab === t.key ? 'white' : 'var(--text-secondary)',
              border: tab === t.key ? 'none' : '1px solid var(--border)',
              borderRadius: 'var(--radius-xs)',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'business' && (
        <Card>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>פרטי עסק</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="שם העסק" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="מייל" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ direction: 'ltr', textAlign: 'right' }} />
            <Input label="טלפון" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label="עיר" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <Input label="כתובת" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />

          <h3 style={{ fontSize: 15, fontWeight: 600, marginTop: 24, marginBottom: 12 }}>פרטי בנק</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Input label="שם בנק" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
            <Input label="סניף" value={form.bankBranch} onChange={(e) => setForm({ ...form, bankBranch: e.target.value })} />
            <Input label="מספר חשבון" value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} />
          </div>

          <div style={{ marginTop: 8, padding: '12px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-xs)', fontSize: 13, color: 'var(--text-muted)' }}>
            <p>סוג עוסק: <strong>{business?.businessType === 'OSEK_PATUR' ? 'עוסק פטור' : 'עוסק מורשה'}</strong></p>
            <p>ח.פ./ת.ז.: <strong>{business?.taxId}</strong></p>
            {business?.vatNumber && <p>מס' עוסק מורשה: <strong>{business.vatNumber}</strong></p>}
          </div>

          <Button onClick={handleUpdateBusiness} loading={loading} style={{ marginTop: 20 }}>
            שמור שינויים
          </Button>
        </Card>
      )}

      {tab === 'chavonit' && isOsekMurshe && (
        <Card>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>חשבונית ישראל — חיבור לרשות המסים</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
            לפי חוק ההתייעלות הכלכלית, עוסק מורשה חייב לקבל מספר הקצאה מרשות המסים לחשבוניות מעל הסף הנוכחי.
          </p>

          {/* Threshold display */}
          <div style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '14px 18px',
            marginBottom: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>סף נוכחי לחיבור</p>
              <p className="tabular-nums" style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-primary)' }}>
                ₪{chavonitThreshold.toLocaleString('he-IL')}
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>לפני מע"מ</p>
            </div>
            <div style={{ textAlign: 'left', fontSize: 12, color: 'var(--text-muted)' }}>
              <p>01.01.2026 — ₪10,000</p>
              <p>01.06.2026 — ₪5,000</p>
            </div>
          </div>

          {/* Credentials */}
          <div style={{ maxWidth: 500 }}>
            <Input
              label="Client ID"
              value={chavonitForm.clientId}
              onChange={(e) => setChavonitForm({ ...chavonitForm, clientId: e.target.value })}
              tooltip="מספר הזיהוי שניתן ע&quot;י רשות המסים"
              style={{ direction: 'ltr', textAlign: 'right' }}
            />
            <Input
              label="Client Secret"
              type="password"
              value={chavonitForm.clientSecret}
              onChange={(e) => setChavonitForm({ ...chavonitForm, clientSecret: e.target.value })}
              tooltip="הסיסמה הסודית מרשות המסים"
              style={{ direction: 'ltr', textAlign: 'right' }}
            />
          </div>

          {/* Test result */}
          {testResult && (
            <div style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-xs)',
              marginBottom: 16,
              background: testResult.success ? 'rgba(0, 212, 170, 0.1)' : 'rgba(255, 87, 87, 0.1)',
              border: `1px solid ${testResult.success ? 'rgba(0, 212, 170, 0.3)' : 'rgba(255, 87, 87, 0.3)'}`,
              color: testResult.success ? 'var(--success)' : 'var(--error)',
              fontSize: 14,
            }}>
              {testResult.success ? '✅' : '❌'} {testResult.message}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <Button variant="secondary" onClick={handleTestConnection} loading={testingConnection}>
              בדוק חיבור
            </Button>
            <Button onClick={handleSaveChavonit} loading={loading}>
              שמור פרטים
            </Button>
          </div>

          <div style={{
            marginTop: 24,
            padding: 14,
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-xs)',
            fontSize: 12,
            color: 'var(--text-muted)',
            lineHeight: 1.8,
          }}>
            <p><strong>מתי נדרש מספר הקצאה?</strong></p>
            <p>1. העסק הוא עוסק מורשה</p>
            <p>2. סכום החשבונית לפני מע"מ עולה על הסף</p>
            <p>3. החשבונית כוללת מע"מ</p>
            <p>4. מקבל החשבונית הוא עוסק מורשה (בעל ח.פ.)</p>
            <p style={{ marginTop: 8 }}>אם אחד מהתנאים לא מתקיים — המסמך יופק ללא מספר הקצאה.</p>
          </div>
        </Card>
      )}

      {tab === 'brand' && (
        <Card>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>מיתוג ולוגו</h2>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
              לוגו (PNG/JPG/SVG, עד 500KB)
            </label>
            {business?.logoUrl && (
              <img src={business.logoUrl} alt="Logo" style={{ maxWidth: 120, maxHeight: 60, marginBottom: 12, display: 'block' }} />
            )}
            <input type="file" accept=".png,.jpg,.jpeg,.svg" onChange={handleLogoUpload} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
                צבע ראשי
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={brandForm.primaryColor} onChange={(e) => setBrandForm({ ...brandForm, primaryColor: e.target.value })} />
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{brandForm.primaryColor}</span>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
                צבע משני
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={brandForm.secondaryColor} onChange={(e) => setBrandForm({ ...brandForm, secondaryColor: e.target.value })} />
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{brandForm.secondaryColor}</span>
              </div>
            </div>
          </div>

          <div style={{ padding: 20, background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', marginBottom: 20, border: '1px solid var(--border)' }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>תצוגה מקדימה:</p>
            <div style={{ background: brandForm.primaryColor, color: 'white', padding: '12px 20px', borderRadius: 'var(--radius-xs)', display: 'inline-block', marginLeft: 8 }}>
              כפתור ראשי
            </div>
            <div style={{ background: brandForm.secondaryColor, color: 'white', padding: '12px 20px', borderRadius: 'var(--radius-xs)', display: 'inline-block' }}>
              כפתור משני
            </div>
          </div>

          <Button onClick={handleUpdateBrand} loading={loading}>שמור צבעים</Button>
        </Card>
      )}

      {tab === 'password' && (
        <Card>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>שינוי סיסמה</h2>
          <div style={{ maxWidth: 400 }}>
            <Input
              label="סיסמה נוכחית"
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              style={{ direction: 'ltr', textAlign: 'right' }}
            />
            <Input
              label="סיסמה חדשה"
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              style={{ direction: 'ltr', textAlign: 'right' }}
            />
            <Input
              label="אימות סיסמה חדשה"
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              style={{ direction: 'ltr', textAlign: 'right' }}
            />
            <Button onClick={handleChangePassword} loading={loading}>עדכן סיסמה</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
