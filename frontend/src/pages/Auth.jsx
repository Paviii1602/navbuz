import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../utils/api.js';

/* Shared input style — 16px prevents iOS auto-zoom */
const inp = {
  width: '100%', padding: '13px 16px', fontSize: 16,
  fontFamily: 'inherit',
  border: '1.5px solid var(--border)', borderRadius: 12,
  background: 'var(--bg)', color: 'var(--text)',
  outline: 'none', WebkitAppearance: 'none', appearance: 'none',
  boxSizing: 'border-box',
};

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const { login, showToast } = useApp();
  const navigate = useNavigate();

  const handleSubmit = async () => {
    setError('');
    const u = username.trim();
    const p = password.trim();
    if (!u || !p) { setError('Please enter both username and password'); return; }
    setLoading(true);
    try {
      // api.login expects { username, password } object
      const data = await api.login({ username: u, password: p });
      login(data.user);
      showToast(`Welcome, ${data.user.username}! 🚌`, 'success');
      navigate(data.user.role === 'driver' ? '/driver' : '/location-permission');
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #e6f0f5, #c3d3db)',
      padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 400, background: 'var(--bg2)',
        borderRadius: 20, padding: 28, boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 48, marginBottom: 6 }}>🚌</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--primary)', letterSpacing: -1 }}>NavBus</div>
          <div style={{ fontSize: 14, color: 'var(--text3)', marginTop: 4 }}>Sign in to track your bus</div>
        </div>

        {/* Username */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>USERNAME</div>
          <input style={inp} type="text" placeholder="Enter your username"
            value={username} autoCapitalize="none" autoCorrect="off" autoComplete="username"
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
        </div>

        {/* Password */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>PASSWORD</div>
          <input style={inp} type="password" placeholder="Enter your password"
            value={password} autoComplete="current-password"
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'var(--danger-l)', border: '1px solid var(--danger)',
            borderRadius: 10, padding: '10px 14px', fontSize: 13,
            color: 'var(--danger)', lineHeight: 1.5,
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Submit */}
        <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)',
                borderTopColor: '#fff', borderRadius: '50%',
                animation: 'spin 0.7s linear infinite', display: 'inline-block',
              }} />
              Signing in…
            </span>
          ) : 'Sign In'}
        </button>

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text3)' }}>
          New here?{' '}
          <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
            Create account
          </Link>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role,     setRole]     = useState('passenger');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const { login, showToast } = useApp();
  const navigate = useNavigate();

  const handleSubmit = async () => {
    setError('');
    const u = username.trim();
    const p = password.trim();
    if (!u)           { setError('Please enter a username'); return; }
    if (u.length < 3) { setError('Username must be at least 3 characters'); return; }
    if (!p)           { setError('Please enter a password'); return; }
    if (p.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      // api.register expects { username, password, role } object
      const data = await api.register({ username: u, password: p, role });
      login(data.user);
      showToast('Account created! Welcome 🎉', 'success');
      navigate(role === 'driver' ? '/driver' : '/location-permission');
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #cce6f3, #ffffff)',
      padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 400, background: 'var(--bg2)',
        borderRadius: 20, padding: 28, boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 48, marginBottom: 6 }}>🚌</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--primary)', letterSpacing: -1 }}>NavBus</div>
          <div style={{ fontSize: 14, color: 'var(--text3)', marginTop: 4 }}>Create your account</div>
        </div>

        {/* Username */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>USERNAME</div>
          <input style={inp} type="text" placeholder="Choose a username"
            value={username} autoCapitalize="none" autoCorrect="off" autoComplete="username"
            onChange={e => setUsername(e.target.value)} />
        </div>

        {/* Password */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>PASSWORD</div>
          <input style={inp} type="password" placeholder="At least 6 characters"
            value={password} autoComplete="new-password"
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
        </div>

        {/* Role selector */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>I AM A</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {['passenger', 'driver'].map(r => (
              <button key={r} type="button" onClick={() => setRole(r)}
                style={{
                  flex: 1, padding: '12px 8px', borderRadius: 10, cursor: 'pointer',
                  border: `2px solid ${role === r ? 'var(--primary)' : 'var(--border)'}`,
                  background: role === r ? 'var(--primary-l)' : 'var(--bg)',
                  color: role === r ? 'var(--primary)' : 'var(--text3)',
                  fontWeight: 600, fontSize: 14, fontFamily: 'inherit',
                }}>
                {r === 'passenger' ? '🧍 Passenger' : '🚌 Driver'}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'var(--danger-l)', border: '1px solid var(--danger)',
            borderRadius: 10, padding: '10px 14px', fontSize: 13,
            color: 'var(--danger)', lineHeight: 1.5,
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Submit */}
        <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Creating account…' : 'Create Account'}
        </button>

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text3)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}