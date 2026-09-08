import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { ArrowRight } from 'lucide-react';
import { ActionButton } from '../components/ui';
import { HERO_ASCII_ART } from '../constants/ascii';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        const res = await api.authRegister({ email, password });
        const token = res.access_token || (res as any).token;
        await login(token);
        navigate('/dashboard', { replace: true });
      } else {
        const res = await api.authLogin({ email, password });
        const token = res.access_token || (res as any).token;
        await login(token);
        navigate('/dashboard', { replace: true });
      }
    } catch (err: unknown) {
      let msg = err instanceof Error ? err.message : 'Authentication failed';
      try { msg = JSON.parse(msg).detail || msg; } catch { /* keep original */ }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-parchment px-6 select-none font-mono">
      <div className="w-full max-w-sm animate-fade-in">
        {/* Brand Stamp with ASCII Art */}
        <div className="flex flex-col items-center mb-6 pb-2 select-none">
          <pre
            className="font-mono font-black text-slate whitespace-pre overflow-hidden select-none text-[0.19rem] sm:text-[0.21rem]"
            style={{ WebkitTextStroke: '0.3px var(--color-slate)', lineHeight: '1.08' }}
            aria-hidden="true"
          >
            {HERO_ASCII_ART}
          </pre>
          <div className="text-center mt-3">
            <h1 className="text-xl font-normal tracking-normal text-slate uppercase font-sans">
              VALERIE.
            </h1>
            <div className="text-[10px] text-steel font-normal tracking-[0.15em] uppercase mt-0.5 font-sans">
              AI SECURITY WORKSTATION
            </div>
          </div>
        </div>

        {/* Auth Form */}
        <div className="space-y-4">
          <div className="text-xs font-normal uppercase tracking-[0.02em] text-slate pb-2 hairline-bottom">
            <span>{isRegister ? 'OPERATOR REGISTRATION' : 'OPERATOR LOGIN'}</span>
          </div>

          {error && (
            <div className="p-3 bg-danger text-ivory text-xs border border-danger">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate mb-1">
                OPERATOR EMAIL
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-linen border border-hairline px-3 py-2 text-xs font-mono text-slate focus:outline-none focus:border-slate"
                placeholder="operator@defense.org"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate mb-1">
                SECURITY PASSPHRASE
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-linen border border-hairline px-3 py-2 text-xs font-mono text-slate focus:outline-none focus:border-slate"
                placeholder="••••••••••••"
              />
            </div>

            <div className="pt-2">
              <ActionButton
                variant="primary"
                type="submit"
                disabled={loading}
                className="w-full justify-between"
                icon={<ArrowRight size={14} />}
              >
                {loading ? 'AUTHENTICATING' : isRegister ? 'INITIALIZE OPERATOR' : 'AUTHENTICATE'}
              </ActionButton>
            </div>
          </form>

          <div className="pt-3 hairline-top text-center">
            <button
              onClick={() => { setIsRegister(!isRegister); setError(''); }}
              className="text-xs text-steel hover:text-slate uppercase cursor-pointer"
            >
              {isRegister ? '← Existing Operator? Login' : 'Need Access? Register Operator →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
