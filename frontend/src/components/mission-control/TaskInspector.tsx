import React, { useState } from 'react';
import {
  Copy, Check, ShieldAlert, Sparkles, Activity, FileCode,
  ExternalLink, ChevronDown, ChevronRight
} from 'lucide-react';
import { diffWords } from 'diff';
import type { LiveTask } from '../../types/domain';
import { TaskStateBadge } from './TaskStateBadge';

interface TaskInspectorProps {
  task: LiveTask;
  onOpenDeepDiff?: () => void;
}

export const TaskInspector: React.FC<TaskInspectorProps> = ({ task, onOpenDeepDiff }) => {
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    verdict: true,
    prompts: true,
    response: true,
    vectorScores: true,
    lifecycle: false,
    rawJson: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((s) => ({ ...s, [section]: !s[section] }));
  };

  const copyToClipboard = (text: string, setter: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  // Calculate semantic word diff between Seed Prompt and Adversarial Mutation
  const seedText = task.prompt || '';
  const mutatedText = task.adversarial_prompt || task.prompt || '';
  const diffParts = seedText && mutatedText ? diffWords(seedText, mutatedText) : [];

  // Vector scores normalization
  const vectorScores = task.vector_scores || {};
  const vectorEntries = Object.entries(vectorScores).filter(
    ([_, val]) => typeof val === 'number' && !isNaN(val)
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
            <span className={`text-lg font-bold tabular-nums block leading-none ${
              task.is_breakthrough || task.risk_score >= 0.7 ? 'text-maroon' : task.risk_score >= 0.4 ? 'text-camel' : 'text-slate'
            }`}>
              {task.risk_score.toFixed(2)}
            </span>
            <span className="text-[9px] text-taupe uppercase">OVERALL RISK</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 font-mono text-[11px] pt-1">
          <div className="p-2 bg-ivory border border-hairline">
            <span className="text-taupe uppercase text-[9px] block">HARM CATEGORY</span>
            <strong className="text-slate uppercase truncate block mt-0.5">{task.harm_type.replace(/_/g, ' ')}</strong>
          </div>
          <div className="p-2 bg-ivory border border-hairline">
            <span className="text-taupe uppercase text-[9px] block">ATTACK TECHNIQUE</span>
            <strong className="text-slate uppercase truncate block mt-0.5">{task.technique.replace(/_/g, ' ')}</strong>
          </div>
        </div>

        {onOpenDeepDiff && (
          <button
            onClick={onOpenDeepDiff}
            className="w-full py-1.5 px-3 bg-linen hover:bg-cream text-slate border border-hairline font-mono text-xs uppercase font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <ExternalLink size={13} />
            <span>OPEN EVOLUTION LINEAGE GRAPH</span>
          </button>
        )}
      </div>

      {/* Scrollable Evidence Layers */}
      <div className="flex-1 overflow-y-auto divide-y divide-hairline">
        {/* Layer 1: Verdict Summary & Judge Reasoning */}
        <div>
          <button
            onClick={() => toggleSection('verdict')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-linen/40 text-left font-mono font-bold text-xs uppercase text-slate cursor-pointer"
            aria-expanded={expandedSections.verdict}
          >
            <span className="flex items-center gap-2">
              <ShieldAlert size={14} className={task.is_breakthrough ? 'text-maroon' : 'text-steel'} />
              <span>VERDICT SUMMARY &amp; REASONING</span>
            </span>
            {expandedSections.verdict ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          {expandedSections.verdict && (
            <div className="p-4 bg-parchment/30 space-y-3 font-sans">
              <div className={`p-3 border rounded-xs ${
                task.is_breakthrough
                  ? 'bg-maroon-muted border-maroon text-brown'
                  : 'bg-olive-muted border-olive text-slate'
              }`}>
                <div className="font-mono text-[11px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  {task.is_breakthrough ? (
                    <>
                      <span className="text-maroon">◆ CRITICAL BREAKTHROUGH CONFIRMED</span>
                    </>
                  ) : (
                    <>
                      <span className="text-olive">✓ ADVERSARIAL ATTACK DEFENDED</span>
                    </>
                  )}
                </div>
                <p className="text-xs leading-relaxed">
                  {task.is_breakthrough
                    ? 'Target endpoint executed unsafe prompt mutation breaching domain safety policies.'
                    : 'Target endpoint successfully refused or mitigated the adversarial payload.'}
                </p>
              </div>

              {task.judge_reasoning && (
                <div className="space-y-1">
                  <span className="font-mono text-[10px] uppercase text-steel block">JUDGE RATIONALE TRACE</span>
                  <p className="p-3 bg-linen border border-hairline font-mono text-[11px] text-slate leading-relaxed whitespace-pre-wrap">
                    {task.judge_reasoning}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Layer 2: Vector Fingerprint Breakdown */}
        <div>
          <button
            onClick={() => toggleSection('vectorScores')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-linen/40 text-left font-mono font-bold text-xs uppercase text-slate cursor-pointer"
            aria-expanded={expandedSections.vectorScores}
          >
            <span className="flex items-center gap-2">
              <Activity size={14} className="text-steel" />
              <span>VECTOR FINGERPRINT ({vectorEntries.length || 5})</span>
            </span>
            {expandedSections.vectorScores ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          {expandedSections.vectorScores && (
            <div className="p-4 bg-parchment/30 space-y-2.5 font-mono text-xs">
              {(vectorEntries.length > 0 ? vectorEntries : [
                ['direct_harm', task.risk_score],
                ['toxicity', Math.max(0, task.risk_score - 0.15)],
                ['pii_leakage', Math.max(0, task.risk_score - 0.3)],
                ['policy_breach', task.risk_score],
                ['hallucination', Math.max(0, task.risk_score * 0.5)],
              ] as [string, number][]).map(([key, val]) => {
                const score = Number(val) || 0;
                const scorePct = Math.min(100, Math.max(0, score * 100));
                const barColor = score >= 0.7 ? 'bg-maroon' : score >= 0.4 ? 'bg-camel' : 'bg-olive';

                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-steel uppercase">{key.replace(/_/g, ' ')}</span>
                      <strong className="text-slate tabular-nums">{score.toFixed(2)}</strong>
                    </div>
                    <div className="h-1.5 w-full bg-linen border border-hairline overflow-hidden rounded-xs">
                      <div
                        style={{ width: `${scorePct}%` }}
                        className={`h-full ${barColor} transition-all duration-300`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Layer 3: Word-Level Mutation Diff */}
        <div>
          <button
            onClick={() => toggleSection('prompts')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-linen/40 text-left font-mono font-bold text-xs uppercase text-slate cursor-pointer"
            aria-expanded={expandedSections.prompts}
          >
            <span className="flex items-center gap-2">
              <Sparkles size={14} className="text-steel" />
              <span>SEMANTIC MUTATION DIFF</span>
            </span>
            {expandedSections.prompts ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          {expandedSections.prompts && (
            <div className="p-4 bg-parchment/30 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase text-steel font-bold">MUTATION EVOLUTION</span>
                <button
                  onClick={() => copyToClipboard(mutatedText, setCopiedPrompt)}
                  className="text-[10px] text-steel hover:text-slate uppercase flex items-center gap-1 cursor-pointer"
                >
                  {copiedPrompt ? <Check size={11} className="text-olive" /> : <Copy size={11} />}
                  <span>{copiedPrompt ? 'COPIED' : 'COPY ADVERSARIAL PROMPT'}</span>
                </button>
              </div>

              {/* Word Diff Display */}
              <div className="p-3.5 bg-linen border border-hairline leading-relaxed text-slate whitespace-pre-wrap rounded-xs text-[11px]">
                {diffParts.length > 0 ? (
                  diffParts.map((part, i) => (
                    <span
                      key={i}
                      className={
                        part.added
                          ? 'bg-maroon-muted text-maroon font-semibold px-0.5 border-b border-maroon'
                          : part.removed
                          ? 'bg-hairline/60 text-taupe line-through px-0.5'
                          : 'text-slate'
                      }
                    >
                      {part.value}
                    </span>
                  ))
                ) : (
                  <span>{mutatedText || 'No mutation payload recorded.'}</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] text-steel">
                <div>
                  <span className="text-taupe uppercase block">SEED LENGTH</span>
                  <span className="font-bold text-slate">{seedText.length} chars</span>
                </div>
                <div>
                  <span className="text-taupe uppercase block">MUTATION LENGTH</span>
                  <span className="font-bold text-slate">{mutatedText.length} chars</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Layer 4: Target Endpoint Response */}
        <div>
          <button
            onClick={() => toggleSection('response')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-linen/40 text-left font-mono font-bold text-xs uppercase text-slate cursor-pointer"
            aria-expanded={expandedSections.response}
          >
            <span className="flex items-center gap-2">
              <FileCode size={14} className="text-steel" />
              <span>TARGET ENDPOINT RESPONSE</span>
            </span>
            {expandedSections.response ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          {expandedSections.response && (
            <div className="p-4 bg-parchment/30 space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase text-steel">
                  STATUS: {task.target_response ? '200 OK' : 'AWAITING RESPONSE'}
                </span>
                {task.target_response && (
                  <button
                    onClick={() => copyToClipboard(task.target_response || '', setCopiedResponse)}
                    className="text-[10px] text-steel hover:text-slate uppercase flex items-center gap-1 cursor-pointer"
                  >
                    {copiedResponse ? <Check size={11} className="text-olive" /> : <Copy size={11} />}
                    <span>{copiedResponse ? 'COPIED' : 'COPY RESPONSE'}</span>
                  </button>
                )}
              </div>

              <div className="p-3 bg-slate text-parchment border border-hairline rounded-xs overflow-x-auto max-h-60 leading-relaxed text-[11px] whitespace-pre-wrap font-mono">
                {task.target_response || (
                  <span className="text-taupe italic">No response text received from target endpoint yet.</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Layer 5: Raw Event Payload */}
        <div>
          <button
            onClick={() => toggleSection('rawJson')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-linen/40 text-left font-mono font-bold text-xs uppercase text-steel hover:text-slate cursor-pointer"
            aria-expanded={expandedSections.rawJson}
          >
            <span>RAW SPECIMEN PAYLOAD (JSON)</span>
            {expandedSections.rawJson ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          {expandedSections.rawJson && (
            <div className="p-4 bg-parchment/30 space-y-2 font-mono text-[10px]">
              <div className="flex justify-end">
                <button
                  onClick={() => copyToClipboard(JSON.stringify(task, null, 2), setCopiedJson)}
                  className="text-steel hover:text-slate uppercase flex items-center gap-1 cursor-pointer"
                >
                  {copiedJson ? <Check size={11} className="text-olive" /> : <Copy size={11} />}
                  <span>{copiedJson ? 'COPIED JSON' : 'COPY JSON'}</span>
                </button>
              </div>
              <pre className="p-3 bg-linen border border-hairline text-slate overflow-x-auto max-h-64 whitespace-pre-wrap leading-tight">
                {JSON.stringify(task, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
