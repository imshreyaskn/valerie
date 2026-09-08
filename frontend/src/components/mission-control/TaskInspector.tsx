import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert, Sparkles, Activity, FileCode,
  ExternalLink, ChevronDown, Check
} from 'lucide-react';
import { diffWords } from 'diff';
import type { LiveTask } from '../../types/domain';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { CodeBlock, VectorScoresChart } from '../shared/evidence';
import { TaskStateBadge } from './TaskStateBadge';

interface TaskInspectorProps {
  task: LiveTask;
  onOpenDeepDiff?: () => void;
}

import type { Variants } from 'framer-motion';

const accordionVariants: Variants = {
  collapsed: { opacity: 0, height: 0, overflow: 'hidden' },
  expanded: {
    opacity: 1,
    height: 'auto',
    overflow: 'visible',
    transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

/**
 * Canonical forensic dossier for a single task specimen.
 */
export const TaskInspector: React.FC<TaskInspectorProps> = React.memo(({ task, onOpenDeepDiff }) => {
  const openPromptDiff = useWorkspaceStore((s) => s.openPromptDiff);
  const { copiedKey, copy } = useCopyToClipboard();

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    verdict: true,
    prompts: true,
    response: true,
    vectorScores: true,
    rawJson: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((s) => ({ ...s, [section]: !s[section] }));
  };

  // Word-level diff between Seed Prompt and Adversarial Mutation
  const seedText = task.prompt || '';
  const mutatedText = task.adversarial_prompt || task.prompt || '';
  const diffParts = React.useMemo(
    () => (seedText && mutatedText && seedText !== mutatedText ? diffWords(seedText, mutatedText) : []),
    [seedText, mutatedText]
  );

  return (
    <div className="flex flex-col h-full bg-ivory text-slate font-sans text-xs select-none">
      {/* Specimen Sub-Header */}
      <div className="p-4 bg-linen/50 hairline-bottom space-y-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <TaskStateBadge
            status={task.status}
            isBreakthrough={task.is_breakthrough}
            pulse={task.status === 'mutating' || task.status === 'scoring'}
          />
          <div className="font-mono text-right">
            <motion.span
              key={task.risk_score}
              initial={{ scale: 0.9, opacity: 0.8 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
              className={`text-lg font-bold tabular-nums block leading-none ${
                task.is_breakthrough || task.risk_score >= 0.7 ? 'text-maroon' : task.risk_score >= 0.4 ? 'text-camel' : 'text-slate'
              }`}
            >
              {task.risk_score.toFixed(2)}
            </motion.span>
            <span className="text-[9px] text-taupe uppercase">OVERALL RISK</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 font-mono text-[11px] pt-1">
          <div className="p-2 bg-ivory border border-hairline transition-colors hover:border-slate/40">
            <span className="text-taupe uppercase text-[9px] block">HARM CATEGORY</span>
            <strong className="text-slate uppercase truncate block mt-0.5">{task.harm_type.replace(/_/g, ' ')}</strong>
          </div>
          <div className="p-2 bg-ivory border border-hairline transition-colors hover:border-slate/40">
            <span className="text-taupe uppercase text-[9px] block">ATTACK TECHNIQUE</span>
            <strong className="text-slate uppercase truncate block mt-0.5">{task.technique.replace(/_/g, ' ')}</strong>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={
            onOpenDeepDiff ??
            (() => openPromptDiff(task.run_id || 'all', task.task_id))
          }
          className="w-full py-2 px-3 bg-linen hover:bg-cream text-slate border border-hairline font-mono text-xs uppercase font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <ExternalLink size={13} />
          <span>OPEN EVOLUTION LINEAGE GRAPH</span>
        </motion.button>
      </div>

      {/* Scrollable Evidence Layers */}
      <div className="flex-1 overflow-y-auto divide-y divide-hairline">
        {/* Layer 1: Verdict Summary & Judge Reasoning */}
        <div>
          <button
            onClick={() => toggleSection('verdict')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-linen/40 text-left font-mono font-bold text-xs uppercase text-slate cursor-pointer transition-colors"
            aria-expanded={expandedSections.verdict}
          >
            <span className="flex items-center gap-2">
              <ShieldAlert size={14} className={task.is_breakthrough ? 'text-maroon' : 'text-steel'} />
              <span>VERDICT SUMMARY &amp; REASONING</span>
            </span>
            <motion.div
              animate={{ rotate: expandedSections.verdict ? 0 : -90 }}
              transition={{ duration: 0.18 }}
            >
              <ChevronDown size={14} />
            </motion.div>
          </button>

          <AnimatePresence initial={false}>
            {expandedSections.verdict && (
              <motion.div
                initial="collapsed"
                animate="expanded"
                exit="collapsed"
                variants={accordionVariants}
              >
                <div className="p-4 bg-parchment/30 space-y-3 font-sans">
                  <div className={`p-3 border transition-colors ${
                    task.is_breakthrough
                      ? 'bg-maroon-muted border-maroon'
                      : 'bg-olive-muted border-olive'
                  }`}>
                    <div className="font-mono text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                      {task.is_breakthrough ? (
                        <span className="text-maroon">◆ BREAKTHROUGH RECORDED</span>
                      ) : (
                        <span className="text-olive">✓ DEFENDED</span>
                      )}
                    </div>
                    {task.error_message && (
                      <p className="font-mono text-[10px] text-maroon mt-1">{task.error_message}</p>
                    )}
                  </div>

                  {task.judge_reasoning ? (
                    <div className="space-y-1">
                      <span className="font-mono text-[10px] uppercase text-steel block">JUDGE RATIONALE TRACE</span>
                      <p className="p-3 bg-linen border border-hairline font-mono text-[11px] text-slate leading-relaxed whitespace-pre-wrap">
                        {task.judge_reasoning}
                      </p>
                    </div>
                  ) : (
                    <p className="font-mono text-[10px] text-taupe uppercase">
                      No judge rationale recorded for this specimen.
                    </p>
                  )}

                  {Object.keys(task.vector_scores ?? {}).length > 0 && (
                    <div className="pt-1 space-y-2">
                      <span className="font-mono text-[10px] uppercase text-steel block">MEASURED VECTOR SCORES</span>
                      <VectorScoresChart scores={task.vector_scores} />
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Layer 2: Vector Fingerprint Breakdown */}
        <div>
          <button
            onClick={() => toggleSection('vectorScores')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-linen/40 text-left font-mono font-bold text-xs uppercase text-slate cursor-pointer transition-colors"
            aria-expanded={expandedSections.vectorScores}
          >
            <span className="flex items-center gap-2">
              <Activity size={14} className="text-steel" />
              <span>VECTOR FINGERPRINT</span>
            </span>
            <motion.div
              animate={{ rotate: expandedSections.vectorScores ? 0 : -90 }}
              transition={{ duration: 0.18 }}
            >
              <ChevronDown size={14} />
            </motion.div>
          </button>

          <AnimatePresence initial={false}>
            {expandedSections.vectorScores && (
              <motion.div
                initial="collapsed"
                animate="expanded"
                exit="collapsed"
                variants={accordionVariants}
              >
                <div className="p-4 bg-parchment/30 font-mono text-xs">
                  <VectorScoresChart scores={task.vector_scores} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Layer 3: Word-Level Mutation Diff */}
        <div>
          <button
            onClick={() => toggleSection('prompts')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-linen/40 text-left font-mono font-bold text-xs uppercase text-slate cursor-pointer transition-colors"
            aria-expanded={expandedSections.prompts}
          >
            <span className="flex items-center gap-2">
              <Sparkles size={14} className="text-steel" />
              <span>SEMANTIC MUTATION DIFF</span>
            </span>
            <motion.div
              animate={{ rotate: expandedSections.prompts ? 0 : -90 }}
              transition={{ duration: 0.18 }}
            >
              <ChevronDown size={14} />
            </motion.div>
          </button>

          <AnimatePresence initial={false}>
            {expandedSections.prompts && (
              <motion.div
                initial="collapsed"
                animate="expanded"
                exit="collapsed"
                variants={accordionVariants}
              >
                <div className="p-4 bg-parchment/30 space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase text-steel font-bold">MUTATION EVOLUTION</span>
                    <motion.button
                      whileTap={{ scale: 0.94 }}
                      onClick={() => copy(mutatedText, 'adversarial')}
                      disabled={!mutatedText}
                      className="text-[10px] text-steel hover:text-slate uppercase flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {copiedKey === 'adversarial' ? <Check size={11} className="text-olive" /> : null}
                      <span>{copiedKey === 'adversarial' ? 'COPIED' : 'COPY ADVERSARIAL PROMPT'}</span>
                    </motion.button>
                  </div>

                  <CodeBlock
                    label="prompt"
                    text={
                      diffParts.length > 0
                        ? diffParts.map(p => p.value).join('')
                        : mutatedText || 'No mutation payload recorded.'
                    }
                  />

                  <div className="grid grid-cols-2 gap-2 text-[10px] text-steel">
                    <div className="p-2 bg-linen/50 border border-hairline">
                      <span className="text-taupe uppercase block text-[9px]">SEED LENGTH</span>
                      <span className="font-bold text-slate">{seedText.length} chars</span>
                    </div>
                    <div className="p-2 bg-linen/50 border border-hairline">
                      <span className="text-taupe uppercase block text-[9px]">MUTATION LENGTH</span>
                      <span className="font-bold text-slate">{mutatedText.length} chars</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Layer 4: Target Endpoint Response */}
        <div>
          <button
            onClick={() => toggleSection('response')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-linen/40 text-left font-mono font-bold text-xs uppercase text-slate cursor-pointer transition-colors"
            aria-expanded={expandedSections.response}
          >
            <span className="flex items-center gap-2">
              <FileCode size={14} className="text-steel" />
              <span>TARGET ENDPOINT RESPONSE</span>
            </span>
            <motion.div
              animate={{ rotate: expandedSections.response ? 0 : -90 }}
              transition={{ duration: 0.18 }}
            >
              <ChevronDown size={14} />
            </motion.div>
          </button>

          <AnimatePresence initial={false}>
            {expandedSections.response && (
              <motion.div
                initial="collapsed"
                animate="expanded"
                exit="collapsed"
                variants={accordionVariants}
              >
                <div className="p-4 bg-parchment/30 space-y-2 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase text-steel">
                      {task.target_response ? 'RESPONSE RECEIVED' : 'AWAITING RESPONSE'}
                    </span>
                    {task.target_response && (
                      <motion.button
                        whileTap={{ scale: 0.94 }}
                        onClick={() => copy(task.target_response || '', 'response')}
                        className="text-[10px] text-steel hover:text-slate uppercase flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <span>{copiedKey === 'response' ? 'COPIED' : 'COPY RESPONSE'}</span>
                      </motion.button>
                    )}
                  </div>

                  <div className="p-3 bg-slate text-parchment border border-hairline overflow-x-auto max-h-60 leading-relaxed text-[11px] whitespace-pre-wrap font-mono">
                    {task.target_response || (
                      <span className="text-taupe italic">No response text received from target endpoint yet.</span>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Layer 5: Raw Event Payload */}
        <div>
          <button
            onClick={() => toggleSection('rawJson')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-linen/40 text-left font-mono font-bold text-xs uppercase text-steel hover:text-slate cursor-pointer transition-colors"
            aria-expanded={expandedSections.rawJson}
          >
            <span>RAW SPECIMEN PAYLOAD (JSON)</span>
            <motion.div
              animate={{ rotate: expandedSections.rawJson ? 0 : -90 }}
              transition={{ duration: 0.18 }}
            >
              <ChevronDown size={14} />
            </motion.div>
          </button>

          <AnimatePresence initial={false}>
            {expandedSections.rawJson && (
              <motion.div
                initial="collapsed"
                animate="expanded"
                exit="collapsed"
                variants={accordionVariants}
              >
                <div className="p-4 bg-parchment/30 space-y-2 font-mono text-[10px]">
                  <div className="flex justify-end">
                    <motion.button
                      whileTap={{ scale: 0.94 }}
                      onClick={() => copy(JSON.stringify(task, null, 2), 'json')}
                      className="text-steel hover:text-slate uppercase flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <span>{copiedKey === 'json' ? 'COPIED JSON' : 'COPY JSON'}</span>
                    </motion.button>
                  </div>
                  <pre className="p-3 bg-linen border border-hairline text-slate overflow-x-auto max-h-64 whitespace-pre-wrap leading-tight font-mono">
                    {JSON.stringify(task, null, 2)}
                  </pre>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
});

TaskInspector.displayName = 'TaskInspector';

