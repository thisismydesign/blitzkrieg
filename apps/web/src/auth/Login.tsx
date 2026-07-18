import { useState, type FormEvent } from 'react';
import { signInWithOAuth, signInWithPassword, signUpWithPassword } from './actions';

export function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'up') {
        const { error } = await signUpWithPassword(email, password);
        if (error) throw error;
        setSent(true);
      } else {
        const { error } = await signInWithPassword(email, password);
        if (error) throw error;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="auth-card">
        <p>Check your email to confirm your account, then sign in.</p>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h2>{mode === 'in' ? 'Sign in' : 'Create account'}</h2>
      <p className="muted">Sign in to import your chess.com games and drill your mistakes.</p>
      <form onSubmit={submit} className="auth-form">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          minLength={6}
          required
        />
        {error && <div className="auth-error">{error}</div>}
        <button type="submit" disabled={busy}>
          {busy ? '…' : mode === 'in' ? 'Sign in' : 'Sign up'}
        </button>
      </form>
      <button className="link-btn" onClick={() => void signInWithOAuth('google')}>
        Continue with Google
      </button>
      <button className="link-btn" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
        {mode === 'in' ? 'No account? Sign up' : 'Have an account? Sign in'}
      </button>
    </div>
  );
}
