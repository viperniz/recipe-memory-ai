import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || 'https://recipe-memory-api.onrender.com';

export default function JoinPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, googleLogin } = useAuth();

  const code = searchParams.get('code') || '';
  const [inviteEmail, setInviteEmail] = useState('');
  const [codeValid, setCodeValid] = useState(null); // null=loading, true=valid, false=invalid
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Validate the invite code on mount
  useEffect(() => {
    if (!code) {
      setCodeValid(false);
      setError('No invite code provided. Please use the link from your invite email.');
      return;
    }

    fetch(`${API_BASE}/api/auth/validate-invite?code=${encodeURIComponent(code)}`)
      .then(res => res.json())
      .then(data => {
        if (data.valid && data.email) {
          setInviteEmail(data.email);
          setCodeValid(true);
        } else {
          setCodeValid(false);
          setError('This invite link is invalid or has already been used.');
        }
      })
      .catch(() => {
        setCodeValid(false);
        setError('Could not validate invite code. Please try again.');
      });
  }, [code]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    const password = e.target.password.value;
    try {
      await login(inviteEmail, password);
      navigate('/app');
    } catch (err) {
      setError(err.message || 'Login failed. Please check your password.');
    } finally {
      setIsLoading(false);
    }
  };

  if (codeValid === null) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
        <p style={{ color: '#a1a1aa', fontSize: '16px' }}>Validating your invite...</p>
      </div>
    );
  }

  if (codeValid === false) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
        <div style={{ textAlign: 'center', padding: '40px', maxWidth: '440px' }}>
          <h2 style={{ color: '#fff', marginBottom: '16px' }}>Invalid Invite Link</h2>
          <p style={{ color: '#a1a1aa', marginBottom: '24px' }}>{error}</p>
          <a href="/" style={{ color: '#6366f1', textDecoration: 'none' }}>Back to home</a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
      <div style={{ width: '100%', maxWidth: '420px', padding: '40px 32px', background: '#111', borderRadius: '12px', border: '1px solid #222' }}>
        <div style={{ marginBottom: '28px', textAlign: 'center' }}>
          <span style={{ fontSize: '12px', letterSpacing: '0.1em', color: '#6366f1', textTransform: 'uppercase', fontWeight: 600 }}>Beta Access</span>
          <h1 style={{ color: '#fff', fontSize: '24px', margin: '8px 0 8px', fontWeight: 700 }}>Welcome to Cortexle</h1>
          <p style={{ color: '#a1a1aa', fontSize: '14px', margin: 0 }}>
            Logging in as <strong style={{ color: '#e4e4e7' }}>{inviteEmail}</strong>
          </p>
        </div>

        {error && (
          <div style={{ background: '#2a1515', border: '1px solid #5a2020', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: '#f87171', fontSize: '14px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', color: '#a1a1aa', fontSize: '13px', marginBottom: '6px' }}>Email</label>
            <input
              type="email"
              value={inviteEmail}
              readOnly
              style={{ width: '100%', padding: '10px 12px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', color: '#a1a1aa', fontSize: '14px', boxSizing: 'border-box', cursor: 'not-allowed' }}
            />
          </div>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', color: '#a1a1aa', fontSize: '13px', marginBottom: '6px' }}>Password</label>
            <input
              name="password"
              type="password"
              placeholder="Enter your password"
              required
              style={{ width: '100%', padding: '10px 12px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', color: '#fff', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            style={{ width: '100%', padding: '12px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.7 : 1 }}
          >
            {isLoading ? 'Logging in...' : 'Access Beta'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '20px', color: '#71717a', fontSize: '13px' }}>
          New to Cortexle?{' '}
          <a href={`/register?code=${code}`} style={{ color: '#6366f1', textDecoration: 'none' }}>Create an account</a>
        </p>
      </div>
    </div>
  );
}
