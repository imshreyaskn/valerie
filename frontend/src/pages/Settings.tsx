import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { PageHeader, ActionButton } from '../components/ui';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { Shield, User, Sliders, AlertTriangle } from 'lucide-react';

export default function Settings() {
  const { user, logout } = useAuth();
  const { density, setDensity } = useWorkspaceStore();

  const handleDelete = async () => {
    if (!confirm('Are you sure? This will permanently delete your operator account, stored API keys, and all historical pipeline data.')) return;
    try {
      await api.deleteMe();
      await logout();
    } catch (err) {
      alert(`Account deletion failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <section className="flex flex-col w-full hairline-bottom animate-fade-in pb-16 font-mono select-none" aria-label="Workstation Settings">
      {/* ── 1. Page Header ── */}
      <PageHeader
        title="SETTINGS"
        subtitle="OPERATOR ACCOUNT, WORKSTATION PREFERENCES &amp; SECURITY POLICY"
      />

      {/* ── 2. Swiss Telemetry Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-hairline hairline-bottom">
        <div className="py-5 pr-4 md:py-6 md:pr-6 md:pl-0 flex flex-col justify-between">
          <div>
            <div className="text-xs text-steel mb-1">1.01</div>
            <div className="text-xs font-semibold uppercase tracking-[0.02em] text-slate mb-2">
              OPERATOR ROLE
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-slate tabular-nums leading-none">
            {user?.role?.toUpperCase() || 'RESEARCHER'}
          </div>
        </div>

        <div className="p-4 md:p-6 flex flex-col justify-between">
          <div>
            <div className="text-xs text-steel mb-1">1.02</div>
            <div className="text-xs font-semibold uppercase tracking-[0.02em] text-slate mb-2">
              DISPLAY DENSITY
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-slate tabular-nums leading-none uppercase">
            {density}
          </div>
        </div>

        <div className="p-4 md:p-6 flex flex-col justify-between">
          <div>
            <div className="text-xs text-steel mb-1">1.03</div>
            <div className="text-xs font-semibold uppercase tracking-[0.02em] text-slate mb-2">
              TELEMETRY BUS
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-olive tabular-nums leading-none flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-olive" />
            REDIS STREAMS
          </div>
        </div>

        <div className="py-5 pl-4 md:py-6 md:pl-6 flex flex-col justify-between">
          <div>
            <div className="text-xs text-steel mb-1">1.04</div>
            <div className="text-xs font-semibold uppercase tracking-[0.02em] text-slate mb-2">
              PLATFORM BUILD
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-slate tabular-nums leading-none">
            v0.1.2
          </div>
        </div>
      </div>

      <div className="divide-y divide-hairline">
        {/* ── 3. Operator Identity Section ── */}
        <div className="p-6 md:p-8 bg-ivory space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate pb-2 hairline-bottom">
            <User size={14} />
            <span>OPERATOR IDENTITY &amp; CREDENTIALS</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-[10px] text-taupe uppercase font-bold block mb-1">EMAIL ADDRESS</span>
              <div className="p-3 bg-linen/60 border border-hairline font-bold text-slate select-all shadow-2xs">
                {user?.email || 'Unknown Operator'}
              </div>
            </div>
            <div>
              <span className="text-[10px] text-taupe uppercase font-bold block mb-1">OPERATOR UNIQUE IDENTIFIER (UID)</span>
              <div className="p-3 bg-linen/60 border border-hairline text-steel select-all break-all shadow-2xs">
                {user?.uid || 'Unknown'}
              </div>
            </div>
          </div>
        </div>

        {/* ── 4. Workstation Display Preferences ── */}
        <div className="p-6 md:p-8 bg-ivory space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate pb-2 hairline-bottom">
            <Sliders size={14} />
            <span>WORKSTATION DISPLAY &amp; INTERACTION DENSITY</span>
          </div>
          <div className="space-y-2">
            <span className="text-[10px] text-taupe uppercase font-bold block">SPECIMEN LEDGER DENSITY</span>
            <div className="flex flex-wrap gap-3">
              {[
                { id: 'comfortable', label: 'COMFORTABLE', desc: 'Spacious padding, seed & mutation prompt previews' },
                { id: 'compact',     label: 'COMPACT',     desc: 'Dense tabular ledger for high-velocity triage' },
                { id: 'research',    label: 'RESEARCH',    desc: 'Maximum information density with micro metadata' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setDensity(opt.id as 'comfortable' | 'compact' | 'research')}
                  className={`p-4 border text-left transition-all cursor-pointer flex-1 min-w-[200px] ${
                    density === opt.id
                      ? 'bg-slate text-parchment border-slate shadow-xs'
                      : 'bg-linen/40 text-slate border-hairline hover:bg-linen'
                  }`}
                >
                  <div className="font-bold text-xs uppercase mb-1">{opt.label}</div>
                  <div className={`text-[10px] leading-tight ${density === opt.id ? 'text-parchment/80' : 'text-steel'}`}>
                    {opt.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── 5. Platform Architecture Status ── */}
        <div className="p-6 md:p-8 bg-ivory space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate pb-2 hairline-bottom">
            <Shield size={14} />
            <span>ARCHITECTURAL DOMAIN STATUS</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 bg-linen/50 border border-hairline space-y-1">
              <span className="text-[9px] uppercase text-taupe block">01. EXECUTION ENGINE</span>
              <span className="font-bold text-slate block">LITELLM + MISTRAL</span>
              <span className="text-[10px] text-olive font-bold uppercase">● OPERATIONAL</span>
            </div>
            <div className="p-3.5 bg-linen/50 border border-hairline space-y-1">
              <span className="text-[9px] uppercase text-taupe block">02. EVENT STREAM BUS</span>
              <span className="font-bold text-slate block">REDIS STREAMS</span>
              <span className="text-[10px] text-olive font-bold uppercase">● SSE BROADCASTING</span>
            </div>
            <div className="p-3.5 bg-linen/50 border border-hairline space-y-1">
              <span className="text-[9px] uppercase text-taupe block">03. INTELLIGENCE DOMAIN</span>
              <span className="font-bold text-slate block">DBSCAN + ISOLATION FOREST</span>
              <span className="text-[10px] text-olive font-bold uppercase">● ML CONSUMERS ONLINE</span>
            </div>
          </div>
        </div>

        {/* ── 6. Danger Zone ── */}
        <div className="p-6 md:p-8 bg-cream/30 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-maroon pb-2 hairline-bottom">
            <AlertTriangle size={14} />
            <span>DANGER ZONE // PERMANENT ACCOUNT DELETION</span>
          </div>
          <p className="text-xs text-steel font-sans leading-relaxed">
            Irreversibly delete your operator identity, active API tokens, registered endpoint credentials, and historical adversarial evaluation ledgers. This action cannot be undone.
          </p>
          <div className="pt-2">
            <ActionButton variant="danger" onClick={handleDelete}>
              DELETE OPERATOR ACCOUNT
            </ActionButton>
          </div>
        </div>
      </div>
    </section>
  );
}
