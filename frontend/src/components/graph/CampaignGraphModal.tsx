/**
 * components/graph/CampaignGraphModal.tsx
 * Fullscreen Interactive Forensic DAG Modal for Campaign Runs.
 * Hydrates completed run results in a single atomic pass and connects live streams for in-flight sweeps.
 */
import React, { useEffect, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, ExternalLink, Terminal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CampaignGraph } from './v2/CampaignGraph';
import { usePipelineStore } from '../../stores/pipelineStore';
import { api } from '../../utils/api';
import type { Run, RunResultsResponse } from '../../types/domain';

interface Props {
  run: Run | null;
  onClose: () => void;
}

export const CampaignGraphModal: React.FC<Props> = ({ run, onClose }) => {
  const navigate = useNavigate();
  const setActiveRun = usePipelineStore((s) => s.setActiveRun);
  const setActiveRunMeta = usePipelineStore((s) => s.setActiveRunMeta);
  const subscribeRun = usePipelineStore((s) => s.subscribeRun);
  const hydrateRunResults = usePipelineStore((s) => s.hydrateRunResults);
  const tasksByRun = usePipelineStore((s) => s.tasksByRun);

  const isLive = run?.status === 'running' || run?.status === 'queued';

  // Bootstrap store for this run
  useEffect(() => {
    if (!run) return;

    subscribeRun(run.id);
    setActiveRun(run.id);
    setActiveRunMeta({
      domain: run.domain,
      endpoint_id: run.endpoint_id,
      endpoint_name: run.endpoint_id,
      attacker_model: run.attacker_model,
      judge_model: run.judge_model,
      started_at: run.created_at,
    });

    // For completed/historical runs: hydrate from results endpoint if tasks not yet loaded
    const alreadyLoaded = tasksByRun[run.id] && Object.keys(tasksByRun[run.id]).length > 0;
    if (!isLive && !alreadyLoaded) {
      api
        .getResults(run.id)
        .then((data: RunResultsResponse) => {
          if (data?.results && data.results.length > 0) {
            hydrateRunResults(run.id, data.results);
          }
        })
        .catch((err) => {
          console.error('Failed to load historical campaign graph results', err);
        });
    }
  }, [run?.id, isLive]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenMissionControl = useCallback(() => {
    onClose();
    navigate('/dashboard');
  }, [navigate, onClose]);

  if (!run) return null;

  return (
    <Dialog.Root open={!!run} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate/60 backdrop-blur-xs" />
        <Dialog.Content
          className="fixed inset-4 sm:inset-6 z-50 flex flex-col bg-parchment border border-hairline shadow-2xl outline-hidden overflow-hidden"
          aria-describedby={undefined}
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-ivory border-b border-hairline shrink-0 select-none">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Terminal size={14} className="text-slate" />
                <Dialog.Title className="font-mono text-xs font-bold tracking-widest text-slate uppercase">
                  FORENSIC ATTACK GRAPH
                </Dialog.Title>
              </div>

              <span className="font-mono text-[11px] text-taupe tracking-wider">
                #{run.id.slice(0, 10)} · {run.domain?.toUpperCase().replace(/_/g, ' ') || 'GENERAL'}
              </span>

              {isLive ? (
                <span className="inline-flex items-center gap-1.5 font-mono text-[9px] font-bold tracking-wider text-olive bg-olive-muted px-2 py-0.5 border border-olive/30 uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-olive animate-pulse" />
                  LIVE RUN
                </span>
              ) : (
                <span className="font-mono text-[9px] font-bold tracking-wider text-steel bg-linen px-2 py-0.5 border border-hairline uppercase">
                  HISTORICAL SNAPSHOT
                </span>
              )}
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenMissionControl}
                className="inline-flex items-center gap-1.5 font-mono text-[9px] font-bold tracking-wider text-slate bg-linen hover:bg-cream border border-hairline px-3 py-1 transition-colors cursor-pointer"
                title="Open this campaign in Mission Control"
              >
                <ExternalLink size={11} />
                <span>MISSION CONTROL</span>
              </button>

              <Dialog.Close asChild>
                <button
                  type="button"
                  className="w-7 h-7 flex items-center justify-center bg-transparent hover:bg-linen border border-hairline text-steel hover:text-slate transition-colors cursor-pointer"
                  aria-label="Close graph modal"
                >
                  <X size={14} />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Graph Body */}
          <div className="flex-1 min-h-0 relative">
            <CampaignGraph />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
