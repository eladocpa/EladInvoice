import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    businessName: '',
    businessType: 'OSEK_MURSHE' as 'OSEK_PATUR' | 'OSEK_MURSHE',
    taxId: '',
    vatNumber: '',
    phone: '',
  });

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form);
      navigate('/');
      toast.success('ברוכים הבאים!');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error.response?.data?.error || 'שגיאה בהרשמה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
      padding: 20,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 480,
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius)',
        padding: 40,
        border: '1px solid var(--border)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-primary)', marginBottom: 8 }}>
            הרשמה
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            שלב {step} מתוך 2
          </p>
          {/* Progress bar */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'center' }}>
            {[1, 2].map((s) => (
              <div key={s} style={{
                width: 80, height: 4, borderRadius: 2,
                background: s <= step ? 'var(--accent-primary)' : 'var(--border)',
              }} />
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {step === 1 && (
            <>
              <Input
                label="שם מלא"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                required
              />
              <Input
                label="כתובת מייל"
                type="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                required
                style={{ direction: 'ltr', textAlign: 'right' }}
              />
              <Input
                label="סיסמה"
                type="password"
                value={form.password}
                onChange={(e) => updateField('password', e.target.value)}
                required
                placeholder="לפחות 8 תווים"
                style={{ direction: 'ltr', textAlign: 'right' }}
              />
              <Input
                label="טלפון"
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="050-1234567"
              />
              <Button
                type="button"
                onClick={() => {
                  if (!form.name || !form.email || !form.password) {
                    toast.error('יש למלא את כל השדות');
                    return;
                  }
                  if (form.password.length < 8) {
                    toast.error('סיסמה חייבת להכיל לפחות 8 תווים');
                    return;
                  }
                  setStep(2);
                }}
                style={{ width: '100%' }}
              >
                המשך
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <Input
                label="שם העסק"
                value={form.businessName}
                onChange={(e) => updateField('businessName', e.target.value)}
                required
              />
              <Select
                label="סוג עוסק"
                value={form.businessType}
                onChange={(e) => updateField('businessType', e.target.value)}
                options={[
                  { value: 'OSEK_MURSHE', label: 'עוסק מורשה' },
                  { value: 'OSEK_PATUR', label: 'עוסק פטור' },
                ]}
              />
              <Input
                label="ח.פ. / ת.ז."
                value={form.taxId}
                onChange={(e) => updateField('taxId', e.target.value)}
                required
                tooltip="מספר חברה פרטית או תעודת זהות"
              />
              {form.businessType === 'OSEK_MURSHE' && (
                <Input
                  label="מספר עוסק מורשה"
                  value={form.vatNumber}
                  onChange={(e) => updateField('vatNumber', e.target.value)}
                  tooltip="המספר שקיבלת ממע&quot;מ"
                />
              )}
              <div style={{ display: 'flex', gap: 12 }}>
                <Button type="button" variant="secondary" onClick={() => setStep(1)} style={{ flex: 1 }}>
                  חזור
                </Button>
                <Button type="submit" loading={loading} style={{ flex: 2 }}>
                  הרשם
                </Button>
              </div>
            </>
          )}
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-secondary)' }}>
          כבר יש לך חשבון? <Link to="/login" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>התחבר</Link>
        </p>
      </div>
    </div>
  );
}
