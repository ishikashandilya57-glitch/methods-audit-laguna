import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/useAuth';
import '../components/common/Layout.css';

const FACTORY_LOGIN = {
  email: 'ie_dbr@laguna-clothing.com',
  password: 'Ie@12345',
};

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form] = useState(FACTORY_LOGIN);
  const [loading, setLoading] = useState(false);
  const logoSrc = `${process.env.PUBLIC_URL || ''}/method360-logo.png`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <img src={logoSrc} alt="Method360" className="auth-brand-image" />
        </div>
        <p>Use the factory methods audit login below.</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input name="email" type="email" required value={form.email} readOnly />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input name="password" type="text" required value={form.password} readOnly />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p style={{ marginTop: 20, textAlign: 'center', fontSize: 14, marginBottom: 0 }}>
          Only the IE department login is enabled for this app.
        </p>
      </div>
    </div>
  );
}
