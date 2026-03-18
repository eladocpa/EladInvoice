import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
      toast.success('התחברת בהצלחה');
    } catch {
      toast.error('מייל או סיסמה שגויים');
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
        maxWidth: 420,
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius)',
        padding: 40,
        border: '1px solid var(--border)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-primary)', marginBottom: 8 }}>
            EladInvoice
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            מערכת חשבוניות וקבלות
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <Input
            label="כתובת מייל"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            style={{ direction: 'ltr', textAlign: 'right' }}
          />
          <Input
            label="סיסמה"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            style={{ direction: 'ltr', textAlign: 'right' }}
          />
          <Button type="submit" loading={loading} style={{ width: '100%', marginTop: 8 }}>
            התחבר
          </Button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-secondary)' }}>
          אין לך חשבון? <Link to="/register" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>הרשם עכשיו</Link>
        </p>
      </div>
    </div>
  );
}
