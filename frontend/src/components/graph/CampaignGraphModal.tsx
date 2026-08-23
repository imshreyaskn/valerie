import React, { useEffect, useCallback, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CampaignGraph }       from './v2/CampaignGraph';
import { usePipelineStore } from '../../stores/pipelineStore';
import { api } from '../../utils/api';
import type { Run, RunResultsResponse, HistoricalTaskResult } from '../../types/domain';

// Runs hydrated this session — prevents duplicate task synthesis on reopen.
const hydratedRuns = new Set<string>();

interface Props {
  run: Run | null;
  onClose: () => void;
}

export const CampaignGraphModal: React.FC<Props> = ({ run, onClose }) => {
  const navigate = useNavigate();
  const setActiveRun    = usePipelineStore(s => s.setActiveRun);
  const setActiveRunMeta = usePipelineStore(s => s.setActiveRunMeta);
  const subscribeRun    = usePipelineStore(s => s.subscribeRun);
  const processEvent    = usePipelineStore(s => s.processEvent);
  const hydrationRef = useRef(false);

  const isLive = run?.status === 'running';

  // Bootstrap store for this run
  useEffect(() => {
    if (!run) return;

    // Scope (never wipe) — per-run maps preserve other runs' live state and
    // switching back to Mission Control restores its view automatically.
    subscribeRun(run.id);
    setActiveRun(run.id);
    setActiveRunMeta({
      domain:        run.domain,
      endpoint_id:   run.endpoint_id,
      endpoint_name: run.endpoint_id,
      attacker_model: run.attacker_model,
      judge_model:    run.judge_model,
      started_at:    run.created_at,
    });

    // For completed/historical runs — hydrate from results endpoint once.
    if (run.status !== 'running' && !hydratedRuns.has(run.id)) {
      hydrationRef.current = true;
      hydratedRuns.add(run.id);
      api.getResults(run.id).then((data: RunResultsResponse) => {
        const results: HistoricalTaskResult[] = data?.results ?? [];
        // Synthesize task.completed events from each result record
        results.forEach((r, idx) => {
          const fakeEvent = {
            id:             `hydrate-${r.id ?? idx}`,
            type:           'task.completed',
            source:         'hydration',
            timestamp:      run.created_at,
            correlation_id: run.id,
            payload: {
              task_id:         r.task_id || r.id || `task-${idx}`,
              technique:       r.technique_id || 'unknown',
              harm_type:       r.harm_type || 'general',
              is_breakthrough: r.is_breakthrough ?? false,
              final_score:     r.overall_risk_score ?? 0,
              iterations_used: r.iterations ?? 1,
              adversarial_prompt: r.adversarial_prompt || '',
              target_response:    r.target_response || '',
            },
          };
          // Fire a dispatched event first so the task appears
          processEvent({
            ...fakeEvent,
            type: 'task.dispatched',
            payload: {
              task_id:   fakeEvent.payload.task_id,
              technique: fakeEvent.payload.technique,
              harm_type: fakeEvent.payload.harm_type,
            },
          });
          // Then fire completion
          processEvent(fakeEvent);
        });
      }).catch((err) => {
        hydratedRuns.delete(run.id); // allow retry on next open
        console.error('Failed to hydrate campaign graph', err);
      }).finally(() => { hydrationRef.current = false; });
    }

    return () => { /* keep store alive — user might navigate to Mission Control */ };
  }, [run?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenMissionControl = useCallback(() => {
    onClose();
    navigate('/dashboard');
  }, [navigate, onClose]);

  if (!run) return null;

  return (
    <Dialog.Root open={!!run} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(36,41,52,0.6)',
            backdropFilter: 'blur(2px)',
          }}
        />
        <Dialog.Content
          style={{
            position: 'fixed',
            inset: '32px',
            zIndex: 51,
            display: 'flex',
            flexDirection: 'column',
            background: '#F6F2EE',
            border: '1px solid #D8D0C7',
            boxShadow: '0 24px 80px rgba(36,41,52,0.35)',
            outline: 'none',
          }}
          aria-describedby={undefined}
        >
          {/* ── Modal Header Bar ── */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            borderBottom: '1px solid #D8D0C7',
            background: '#FFFFFF',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Dialog.Title style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.2em',
                color: '#242934',
                margin: 0,
              }}>
                EXECUTION GRAPH
              </Dialog.Title>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                color: '#A8A29D',
                letterSpacing: '0.1em',
              }}>
                #{run.id.slice(0, 12)} · {run.domain?.toUpperCase().replace(/_/g, ' ')}
              </span>
              {isLive && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 8, letterSpacing: '0.15em', fontWeight: 700,
                  color: '#415438',
                  background: '#EBF0E7',
                  padding: '2px 8px',
                }}>
                  <span style={{
                    width: 5, height: 5, borderRadius: '50%', background: '#415438',
                    animation: 'pulse-dot 2s ease-in-out infinite',
                    display: 'inline-block',
                  }} />
                  LIVE
                </span>
              )}
              {!isLive && (
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 8, letterSpacing: '0.15em', fontWeight: 700,
                  color: '#6E7280', background: '#EDE6DF', padding: '2px 8px',
                }}>
                  HISTORICAL SNAPSHOT
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={handleOpenMissionControl}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
                  color: '#242934', background: 'transparent',
                  border: '1px solid #D8D0C7',
                  padding: '5px 12px', cursor: 'pointer',
                }}
                title="Open in Mission Control"
              >
                <ExternalLink size={11} />
                MISSION CONTROL
              </button>
              <Dialog.Close asChild>
                <button
                  style={{
                    width: 32, height: 32,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'transparent', border: '1px solid #D8D0C7',
                    cursor: 'pointer', color: '#6E7280',
                  }}
                  aria-label="Close graph"
                >
                  <X size={14} />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* ── Canvas ── */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <CampaignGraph />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
