import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { Shield, ArrowRight } from 'lucide-react';
import { ActionButton } from '../components/ui';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        const res = await api.authRegister({ email, password });
        await login(res.access_token);
      } else {
        const res = await api.authLogin({ email, password });
        await login(res.access_token);
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
        {/* Brand Stamp */}
        <div className="flex items-center gap-3 mb-8 pb-4 hairline-bottom">
          <div className="w-8 h-8 bg-slate text-parchment flex items-center justify-center font-bold">
            <Shield size={16} />
          </div>
          <div>
            <div className="text-sm font-bold tracking-[0.25em] text-slate uppercase">VALERIE</div>
            <div className="text-[10px] text-steel uppercase">AI SECURITY WORKSTATION</div>
          </div>
        </div>

        {/* Auth Form Box */}
        <div className="bg-ivory border border-hairline p-6 shadow-xl space-y-4">
          <div className="text-xs font-semibold uppercase tracking-[0.02em] text-slate pb-2 hairline-bottom flex justify-between items-center">
            <span>{isRegister ? 'OPERATOR REGISTRATION' : 'OPERATOR LOGIN'}</span>
            <span className="text-[10px] text-steel">[V0.1]</span>
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
