import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { PageHeader, ActionButton, StatusBadge } from '../components/ui';
import { TelemetryRow } from '../components/ui/TelemetryRow';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useCachedQuery } from '../utils/queryCache';
import { Shield, User, Sliders, AlertTriangle } from 'lucide-react';

type HealthState = 'loading' | 'ok' | 'degraded' | 'unreachable';

interface HealthSnapshot {
  overall: HealthState;
  mongodb: HealthState;
  redis: HealthState;
  consumers: HealthState;
}

function serviceToState(status: string | undefined): HealthState {
  if (!status) return 'unreachable';
  if (status === 'ok') return 'ok';
  if (status.startsWith('unhealthy')) return 'unreachable';
  return 'degraded';
}

async function fetchHealth(): Promise<HealthSnapshot> {
  const data = await api.getHealth();
  const mongo = serviceToState(data.services?.mongodb);
  const redis = serviceToState(data.services?.redis);
  const consumerStates = Object.values(data.consumers ?? {}).map((c) => c.state);
  const consumers: HealthState =
    consumerStates.length > 0
      ? consumerStates.every((s) => s === 'running') ? 'ok'
      : consumerStates.some((s) => s === 'crashed') ? 'unreachable'
      : 'degraded'
      : 'degraded';
  const overall: HealthState =
    mongo === 'ok' && redis === 'ok' && consumers === 'ok' ? 'ok'
    : mongo === 'unreachable' || redis === 'unreachable' ? 'unreachable'
    : 'degraded';
  return { overall, mongodb: mongo, redis, consumers };
}

const LOADING_HEALTH: HealthSnapshot = {
  overall: 'loading', mongodb: 'loading', redis: 'loading', consumers: 'loading',
};

export default function Settings() {
  const { user, logout } = useAuth();
  const { density, setDensity } = useWorkspaceStore();

  // Real platform health — replaces the previous hardcoded "OPERATIONAL"
  // status cells with a live /health probe (15s cache, shared).
  const healthResource = useCachedQuery('platform:health', fetchHealth, { ttlMs: 15_000 });
  const health = healthResource.data ?? LOADING_HEALTH;

  const stateBadge = (state: HealthState) => {
    if (state === 'ok') return <StatusBadge label="OPERATIONAL" variant="olive" />;
    if (state === 'degraded') return <StatusBadge label="DEGRADED" variant="camel" />;
    if (state === 'loading') return <StatusBadge label="CHECKING" variant="default" />;
    return <StatusBadge label="UNREACHABLE" variant="maroon" />;
  };

  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!confirm('Are you sure? This will permanently delete your operator account, stored API keys, and all historical pipeline data.')) return;
    setDeleteError(null);
    try {
      await api.deleteMe();
      await logout();
    } catch (err) {
      setDeleteError(`Account deletion failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <section className="flex flex-col w-full hairline-bottom animate-fade-in pb-16 font-mono select-none" aria-label="Workstation Settings">
      {/* ── 1. Page Header ── */}
      <PageHeader
        title="SETTINGS"
        subtitle="OPERATOR ACCOUNT, WORKSTATION PREFERENCES &amp; SECURITY POLICY"
      />

      {/* ── 2. Telemetry Row ── */}
      <TelemetryRow
        ariaLabel="Operator and platform metrics"
        cells={[
          {
            index: '1.01',
            label: 'OPERATOR ROLE',
            value: <span className="text-slate">{user?.role?.toUpperCase() || 'RESEARCHER'}</span>,
            sublabel: user?.email ?? undefined,
          },
          {
            index: '1.02',
            label: 'DISPLAY DENSITY',
            value: <span className="text-slate uppercase">{density}</span>,
            sublabel: 'LEDGER RENDERING MODE',
          },
          {
            index: '1.03',
            label: 'PLATFORM HEALTH',
            variant: health.overall === 'ok' ? 'olive' : health.overall === 'degraded' ? 'camel' : health.overall === 'unreachable' ? 'maroon' : 'default',
            value: (
              <span className={
                health.overall === 'ok' ? 'text-olive'
                : health.overall === 'degraded' ? 'text-camel'
                : health.overall === 'unreachable' ? 'text-maroon'
                : 'text-slate'
              }>
                {health.overall === 'loading' ? '…' : health.overall.toUpperCase()}
              </span>
            ),
            sublabel: 'LIVE /HEALTH PROBE',
          },
          {
            index: '1.04',
            label: 'PLATFORM BUILD',
            variant: 'static',
            value: <span className="text-slate">v0.1.2</span>,
            sublabel: 'VALERIE CORE',
          },
        ]}
      />

      {/* ── Deletion Error Banner ── */}
      {deleteError && (
        <div className="p-4 bg-maroon/5 border-b border-maroon/30 flex items-center justify-between font-mono animate-fade-in" role="alert">
          <span className="text-xs font-bold uppercase tracking-wider text-maroon">{deleteError}</span>
          <button onClick={() => setDeleteError(null)} className="text-maroon hover:text-slate cursor-pointer p-1" aria-label="Dismiss error">
            <AlertTriangle size={14} />
          </button>
        </div>
      )}

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

        {/* ── 5. Platform Architecture Status (live /health probe) ── */}
        <div className="p-6 md:p-8 bg-ivory space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate pb-2 hairline-bottom">
            <Shield size={14} />
            <span>ARCHITECTURAL DOMAIN STATUS — LIVE HEALTH PROBE</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 bg-linen/50 border border-hairline space-y-1">
              <span className="text-[9px] uppercase text-taupe block">01. DOCUMENT STORE</span>
              <span className="font-bold text-slate block">MONGODB</span>
              {stateBadge(health.mongodb)}
            </div>
            <div className="p-3.5 bg-linen/50 border border-hairline space-y-1">
              <span className="text-[9px] uppercase text-taupe block">02. EVENT STREAM BUS</span>
              <span className="font-bold text-slate block">REDIS STREAMS</span>
              {stateBadge(health.redis)}
            </div>
            <div className="p-3.5 bg-linen/50 border border-hairline space-y-1">
              <span className="text-[9px] uppercase text-taupe block">03. INTELLIGENCE CONSUMERS</span>
              <span className="font-bold text-slate block">ML EVENT PIPELINE</span>
              {stateBadge(health.consumers)}
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
