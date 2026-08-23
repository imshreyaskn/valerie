import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { Trash2, Copy, Check, Key, X, Plus } from 'lucide-react';
import { PageHeader, ActionButton } from '../components/ui';
import { TelemetryRow } from '../components/ui/TelemetryRow';
import type { ApiKeyItem, CreatedApiKey } from '../types/domain';

export default function ApiKeys() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [label, setLabel] = useState('');
  const [newKey, setNewKey] = useState<CreatedApiKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadKeys = () => {
    setLoading(true);
    api.listKeys()
      .then((res) => setKeys(res.keys || []))
      .catch((err) => {
        console.error(err);
        setActionError('Could not load API keys. Please refresh the page.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadKeys();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    setIsCreating(true);
    setActionError(null);
    try {
      const res = await api.createKey(label.trim());
      setNewKey(res);
      setLabel('');
      setShowCreateForm(false);
      loadKeys();
    } catch (err) {
      console.error(err);
      setActionError(err instanceof Error ? err.message : 'Key generation failed. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    if (!confirm('Are you sure you want to permanently revoke this API key? Automated CI/CD pipelines using this key will immediately fail.')) return;
    setActionError(null);
    try {
      await api.revokeKey(keyId);
      loadKeys();
    } catch (err) {
      console.error(err);
      setActionError('Key revocation failed. The key is still active — please retry.');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="flex flex-col w-full hairline-bottom animate-fade-in pb-16 select-none font-mono" aria-label="API Keys">
      {/* ── 1. Page Header ── */}
      <PageHeader
        title="API KEYS &amp; SECRETS"
        subtitle="PROGRAMMATIC WORKSTATION ACCESS &amp; CI/CD AUTOMATION"
        action={
          <ActionButton
            variant="primary"
            icon={showCreateForm ? <X size={14} /> : <Plus size={14} strokeWidth={2.5} />}
            onClick={() => setShowCreateForm((v) => !v)}
          >
            {showCreateForm ? 'CLOSE FORM' : '+ GENERATE KEY'}
          </ActionButton>
        }
      />

      {/* ── 2. Telemetry Row (configuration facts, styled static) ── */}
      <TelemetryRow
        ariaLabel="Key vault configuration"
        cells={[
          {
            index: '1.01',
            label: 'ACTIVE ACCESS TOKENS',
            value: <><span>{keys.length}</span><span className="text-steel text-sm font-normal"> KEYS</span></>,
            sublabel: 'CI/CD WORKSTATION CREDENTIALS',
          },
          {
            index: '1.02',
            label: 'AUTHENTICATION PROTOCOL',
            variant: 'static',
            value: <span className="text-slate">HS256 JWT</span>,
            sublabel: 'BEARER · 24H EXPIRY',
          },
          {
            index: '1.03',
            label: 'ISSUANCE THROTTLE',
            variant: 'static',
            value: <span className="text-slate">10/MIN</span>,
            sublabel: 'SERVER-ENFORCED RATE LIMIT',
          },
          {
            index: '1.04',
            label: 'VAULT INTEGRITY',
            variant: 'static',
            value: <span className="text-slate">PBKDF2</span>,
            sublabel: 'SHA-256 HASHED AT REST',
          },
        ]}
      />

      {/* ── 3. Error Banner ── */}
      {actionError && (
        <div className="p-4 bg-maroon/5 border-b border-maroon/30 flex items-center justify-between font-mono animate-fade-in" role="alert">
          <span className="text-xs font-bold uppercase tracking-wider text-maroon">{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-maroon hover:text-slate cursor-pointer p-1" aria-label="Dismiss error">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── 4. Secret Token Reveal Banner ── */}
      {newKey && (
        <div className="p-6 bg-cream/80 hairline-bottom space-y-3 font-mono animate-fade-in">
          <div className="text-xs font-bold uppercase tracking-wider text-maroon flex items-center gap-2">
            <Key size={14} />
            <span>NEW API KEY GENERATED — COPY NOW (WILL NEVER BE SHOWN AGAIN)</span>
          </div>
          <div className="flex items-center gap-3">
            <code className="flex-1 p-3 bg-linen border border-hairline text-xs font-bold text-slate select-all break-all shadow-2xs">
              {newKey.api_key}
            </code>
            <button
              onClick={() => copyToClipboard(newKey.api_key)}
              className="px-5 py-3 bg-slate text-parchment font-mono text-xs font-bold uppercase flex items-center gap-2 hover:bg-slate/90 shrink-0 cursor-pointer shadow-xs"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'COPIED' : 'COPY KEY'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── 4. Create Key Drawer ── */}
      {showCreateForm && (
        <form onSubmit={handleCreate} className="p-6 md:p-8 bg-linen/60 hairline-bottom space-y-4 font-mono animate-fade-in">
          <div className="flex justify-between items-center pb-2 hairline-bottom">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate block">
                GENERATE NEW PROGRAMMATIC ACCESS KEY
              </span>
              <span className="text-[11px] text-steel">
                Authorize CI/CD test workers and external API scripts to trigger adversarial campaigns.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="text-steel hover:text-slate p-1 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <div className="max-w-md space-y-2">
            <label className="block text-[10px] font-bold uppercase text-taupe">
              KEY IDENTIFIER / USAGE CONTEXT *
            </label>
            <input
              type="text"
              placeholder="e.g. GitHub Actions CI/CD Pipeline"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              className="w-full bg-ivory border border-hairline px-3 py-2 text-xs font-mono text-slate focus:outline-none focus:border-slate shadow-2xs"
              autoFocus
            />
          </div>

          <div className="flex gap-3 pt-2 hairline-top">
            <ActionButton variant="primary" type="submit" disabled={isCreating || !label.trim()}>
              {isCreating ? 'GENERATING' : 'GENERATE TOKEN'}
            </ActionButton>
            <ActionButton variant="ghost" type="button" onClick={() => setShowCreateForm(false)}>
              CANCEL
            </ActionButton>
          </div>
        </form>
      )}

      {/* ── 5. Keys Table ── */}
      {loading ? (
        <div className="py-16 text-center text-xs text-steel font-mono">LOADING API ACCESS KEYS</div>
      ) : keys.length > 0 ? (
        <div className="w-full hairline-bottom select-none font-mono" role="region" aria-label="API Keys Table">
          {/* Table Headers */}
          <div className="hidden md:grid md:grid-cols-[60px_220px_1fr_160px_100px] items-center p-0 hairline-bottom bg-linen/30 text-xs font-semibold uppercase text-steel">
            <div className="p-3 md:p-4 hairline-right">#</div>
            <div className="p-3 md:p-4 hairline-right">LABEL</div>
            <div className="p-3 md:p-4 hairline-right">KEY PREFIX HASH</div>
            <div className="p-3 md:p-4 hairline-right text-center">LAST ACCESSED</div>
            <div className="p-3 md:p-4 text-right">ACTION</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-hairline">
            {keys.map((k, idx) => {
              const indexStr = String(idx + 1).padStart(2, '0');
              return (
                <div
                  key={k.id}
                  className="grid grid-cols-1 md:grid-cols-[60px_220px_1fr_160px_100px] items-center p-0 hover:bg-linen/40 transition-colors bg-ivory"
                >
                  <div className="p-3 md:p-4 text-sm font-mono text-steel md:hairline-right select-none">
                    {indexStr}
                  </div>
                  <div className="p-3 md:p-4 text-sm font-bold uppercase tracking-tight text-slate md:hairline-right truncate">
                    {k.label}
                  </div>
                  <div className="p-3 md:p-4 text-xs font-mono text-steel md:hairline-right truncate">
                    <code>{k.key_prefix}••••••••••••••••</code>
                  </div>
                  <div className="p-3 md:p-4 text-left md:text-center md:hairline-right text-xs font-mono text-steel">
                    {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'NEVER'}
                  </div>
                  <div className="p-3 md:p-4 text-left md:text-right">
                    <button
                      onClick={() => handleRevoke(k.id)}
                      className="p-1.5 text-steel hover:text-maroon hover:bg-maroon/10 border border-transparent hover:border-maroon/30 transition-colors cursor-pointer"
                      title="Revoke Key"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="py-16 px-6 text-center font-mono select-none hairline-bottom bg-linen/20">
          <Key className="w-6 h-6 text-steel/50 mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-xs font-bold uppercase text-slate">NO ACTIVE API ACCESS KEYS</p>
          <p className="text-[11px] text-steel mt-1 max-w-md mx-auto">
            Generate programmatic keys to integrate Valerie into your automated testing frameworks and CI/CD pipelines.
          </p>
          <div className="mt-4">
            <ActionButton variant="primary" onClick={() => setShowCreateForm(true)}>
              + GENERATE FIRST KEY
            </ActionButton>
          </div>
        </div>
      )}
    </section>
  );
}
