import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/useAuth';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'auditor', department: '' });
  const [loading, setLoading] = useState(false);
  const logoSrc = `${process.env.PUBLIC_URL || ''}/method360-logo.png`;

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form);
      toast.success('Account created!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
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
        <p>Create your account</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Full Name</label>
            <input name="name" required value={form.name} onChange={handleChange} placeholder="John Smith" />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input name="email" type="email" required value={form.email} onChange={handleChange} placeholder="you@company.com" />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input name="password" type="password" required minLength={6} value={form.password} onChange={handleChange} placeholder="Min 6 characters" />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label>Role</label>
              <select name="role" value={form.role} onChange={handleChange}>
                <option value="auditor">Auditor</option>
                <option value="supervisor">Supervisor</option>
                <option value="manager">Manager</option>
              </select>
            </div>
            <div className="form-group">
              <label>Department</label>
              <input name="department" value={form.department} onChange={handleChange} placeholder="e.g. Quality" />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>
        <p style={{ marginTop: 20, textAlign: 'center', fontSize: 14 }}>
          Already have an account? <Link to="/login" className="auth-link">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
