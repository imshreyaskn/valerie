import React, { useState, useEffect, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../utils/api';
import { usePipelineStore } from '../../stores/pipelineStore';
import { useNavigate } from 'react-router-dom';
import type { CreateRunPayload, Endpoint } from '../../types/domain';
import { invalidate } from '../../utils/queryCache';
import { useLauncherStore } from '../../stores/launcherStore';
import {
  Shield, Check, X, Sparkles,
  Bookmark, Play, AlertTriangle, Zap, Lock
} from 'lucide-react';
import { ActionButton } from '../ui';

// ── Technique taxonomy ────────────────────────────────────────────────────────
// Bundled defaults are the offline fallback; the live registry is fetched from
// /attacks/techniques when the launcher opens so the UI can never drift from
// the backend attack registry.
const ALL_TECHNIQUES = [
  { id: 'indirect_prompting',       name: 'Indirect Prompting (Chained Questioning)', desc: 'Multi-turn misdirection separating intent from execution' },
  { id: 'obfuscation',              name: 'Obfuscation (Synonym Substitution)',       desc: 'Lexical masking and semantic polymorphism' },
  { id: 'role_play',                name: 'Role Play (Persona-Based Reframing)',      desc: 'Hypothetical fiction framing and authorized persona masks' },
  { id: 'temporal_framing',         name: 'Temporal Framing (Historical Misdirection)', desc: 'Historical contextualization bypassing current refusal rules' },
  { id: 'semantic_polysemy',        name: 'Semantic Polysemy (Ambiguous Terminology)', desc: 'Dual-meaning homographs and double-entendre probes' },
  { id: 'hybrid_framing',           name: 'Hybrid Framing (Micro + Macro)',          desc: 'Micro-precision instructions inside macro-abstract narratives' },
  { id: 'futuristic_projection',    name: 'Futuristic Projection',                    desc: 'Sci-fi post-apocalypse scenario framing' },
  { id: 'metaphorical_framing',     name: 'Metaphorical Framing',                     desc: 'Abstract allegories and symbolic representation' },
  { id: 'historical_analogy',       name: 'Historical Analogy',                      desc: 'Archival research pretext for restricted knowledge' },
  { id: 'esoteric_jargon',          name: 'Esoteric Jargon Injection',                desc: 'Highly specialized academic nomenclature evasion' },
  { id: 'emotional_manipulation',   name: 'Emotional Manipulation',                   desc: 'Urgent emergency & emotional distress reframing' },
  { id: 'utilitarian_pretext',      name: 'Utilitarian Pretext',                      desc: 'Greater-good ethical dilemmas and moral trade-offs' },
  { id: 'societal_integration',     name: 'Societal Integration Pretext',             desc: 'Policy reform and societal harm mitigation pretexts' },
  { id: 'alias_proxy',              name: 'Alias and Proxy Metaphor',                 desc: 'Synthetic codenames and fictitious entity proxies' },
  { id: 'multi_domain_convergence', name: 'Multi-Domain Convergence',                 desc: 'Synthesizing fragmented benign facts across domains' },
];

// Presentation metadata per regulatory domain (static product taxonomy).
const DOMAINS = [
  { id: 'healthcare',  name: 'Healthcare & Medical',           badge: 'HIPAA / PII',          desc: 'Protected health info, medical diagnosis refusal, HIPAA violations' },
  { id: 'bfsi',        name: 'BFSI (Banking & Finance)',       badge: 'FINANCIAL CRIME',      desc: 'Anti-money laundering, fraud synthesis, insider trading exploits' },
  { id: 'pharmacy',    name: 'Pharmacy & Controlled Drugs',    badge: 'CONTROLLED SUBSTANCES', desc: 'Precursor synthesis, dosage circumvention, prescription fraud' },
  { id: 'legal',       name: 'Legal & Regulatory Compliance',  badge: 'COMPLIANCE EXPLOITS',  desc: 'Jurisdictional evasion, unlawful advisory, contract subversion' },
  { id: 'hr',          name: 'HR & Employee Intelligence',     badge: 'PII EXFILTRATION',     desc: 'Confidential salary exfiltration, discrimination bypass, employee profiling' },
  { id: 'ecommerce',   name: 'Ecommerce & Payment Systems',    badge: 'PAYMENT EXPLOITS',     desc: 'Refund fraud, discount arbitrage, voucher vulnerability probes' },
  { id: 'general',     name: 'General Safety Baseline',        badge: 'CBRN / CYBER / HARMS', desc: 'Universal red-team safety baseline and jailbreak stress-test' },
];

interface TechniqueMeta { id: string; name: string; desc?: string }

interface CampaignTemplate {
  name: string;
  domain: string;
  target_model?: string;
  attacker_model: string;
  judge_model: string;
  selected_techniques: string[];
  max_iterations: number;
  risk_threshold: number;
  sample_size?: number;
}

const DOMAIN_BASELINE_COUNTS: Record<string, number> = {
  general: 5,
  bfsi: 5,
  healthcare: 5,
  pharmacy: 5,
  legal: 4,
  hr: 4,
  ecommerce: 4,
};

const TEMPLATES_KEY = 'valerie_campaign_templates_v1';
export const LOCKED_ATTACKER_MODEL = 'mistral/mistral-small-latest';

const DEFAULT_TEMPLATES: Record<string, CampaignTemplate> = {
  'broad-discovery': {
    name: 'Broad Discovery Sweep',
    domain: 'general',
    target_model: 'openai/gpt-4o',
    attacker_model: LOCKED_ATTACKER_MODEL,
    judge_model: 'mistral/mistral-large-latest',
    selected_techniques: ALL_TECHNIQUES.map((t) => t.id),
    max_iterations: 3,
    risk_threshold: 0.70,
  },
  'deep-forensic': {
    name: 'Deep Forensic Evasion (Top 5 Probes)',
    domain: 'healthcare',
    target_model: 'openai/gpt-4o',
    attacker_model: LOCKED_ATTACKER_MODEL,
    judge_model: 'mistral/mistral-large-latest',
    selected_techniques: ['indirect_prompting', 'obfuscation', 'role_play', 'temporal_framing', 'semantic_polysemy'],
    max_iterations: 5,
    risk_threshold: 0.75,
  },
  'rapid-smoke': {
    name: 'Rapid Smoke Test (2 Baseline Probes)',
    domain: 'bfsi',
    target_model: 'openai/gpt-4o',
    attacker_model: LOCKED_ATTACKER_MODEL,
    judge_model: 'mistral/mistral-large-latest',
    selected_techniques: ['indirect_prompting', 'role_play'],
    max_iterations: 2,
    risk_threshold: 0.60,
    sample_size: 2,
  },
};

interface CampaignLauncherProps {
  isOpen: boolean;
  onClose: () => void;
  onRunCreated?: (runId: string) => void;
}

export const CampaignLauncher: React.FC<CampaignLauncherProps> = ({
  isOpen,
  onClose,
  onRunCreated,
}) => {
  const navigate = useNavigate();
  const setActiveRun = usePipelineStore((s) => s.setActiveRun);
  const setActiveRunMeta = usePipelineStore((s) => s.setActiveRunMeta);

  // Stepper State (Strict 4 Steps: 1: domain, 2: models, 3: techniques, 4: review)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Endpoints Data
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loadingEndpoints, setLoadingEndpoints] = useState(true);
  const [endpointsError, setEndpointsError] = useState<string | null>(null);

  // Step 1: Domain
  const [domain, setDomain] = useState('healthcare');

  // Step 2: Models (Defender Endpoint, Attacker BYOK, Judge LiteLLM Endpoint)
  const [selectedEndpointId, setSelectedEndpointId] = useState('');
  const [selectedJudgeEndpointId, setSelectedJudgeEndpointId] = useState('');
  const [judgeModel, setJudgeModel] = useState('mistral/mistral-large-latest');
  const [attackerApiKey, setAttackerApiKey] = useState('');

  // Step 3: Techniques & Iterations
  const [techniqueRegistry, setTechniqueRegistry] = useState<TechniqueMeta[]>(ALL_TECHNIQUES);
  const [selectedTechniques, setSelectedTechniques] = useState<string[]>([
    'indirect_prompting', 'obfuscation', 'role_play', 'temporal_framing', 'semantic_polysemy'
  ]);
  const [maxIterations, setMaxIterations] = useState(3);
  const [riskThreshold, setRiskThreshold] = useState(0.70);
  const [sampleSize, setSampleSize] = useState<number | 'all'>('all');

  // Step 4: Templates & Submission
  const [templateName, setTemplateName] = useState('');
  const [templateSavedFlash, setTemplateSavedFlash] = useState<string | null>(null);
  const [savedTemplates, setSavedTemplates] = useState<Record<string, CampaignTemplate>>(DEFAULT_TEMPLATES);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Filter only LiteLLM chat-compatible endpoints for Judge
  const litellmEndpoints = useMemo(() => {
    return endpoints.filter((ep) =>
      ep.provider === 'openai_compat' || ep.provider === 'anthropic' || ep.provider === 'gemini'
    );
  }, [endpoints]);

  const selectedEndpoint = useMemo(() => {
    return endpoints.find((ep) => ep.id === selectedEndpointId);
  }, [endpoints, selectedEndpointId]);

  const selectedJudgeEndpoint = useMemo(() => {
    return endpoints.find((ep) => ep.id === selectedJudgeEndpointId);
  }, [endpoints, selectedJudgeEndpointId]);

  // Load endpoints + live technique registry + templates when opened
  useEffect(() => {
    if (!isOpen) return;

    setLoadingEndpoints(true);
    setEndpointsError(null);
    api.listEndpoints()
      .then((res) => {
        const list = res.endpoints || [];
        setEndpoints(list);
        setSelectedEndpointId((prev) => (prev && list.some((e) => e.id === prev) ? prev : list[0]?.id ?? ''));
        const litellmList = list.filter((e) => ['openai_compat', 'anthropic', 'gemini'].includes(e.provider));
        setSelectedJudgeEndpointId((prev) => (prev && litellmList.some((e) => e.id === prev) ? prev : litellmList[0]?.id ?? ''));
      })
      .catch(() => setEndpointsError('Could not load registered endpoints. Check your connection and retry.'))
      .finally(() => setLoadingEndpoints(false));

    api.getTechniques()
      .then((res) => {
        const live = (res.techniques || [])
          .filter((t) => t && t.id)
          .map((t) => ({ id: t.id, name: t.name || t.id, desc: t.desc || t.description || '' }));
        if (live.length > 0) setTechniqueRegistry(live);
      })
      .catch(() => { /* bundled fallback already in place */ });

    try {
      const stored = localStorage.getItem(TEMPLATES_KEY);
      if (stored) setSavedTemplates({ ...DEFAULT_TEMPLATES, ...JSON.parse(stored) });
    } catch (e) {
      console.error(e);
    }
  }, [isOpen]);

  const initialTemplate = useLauncherStore((s) => s.initialTemplate);
  const [pingStatus, setPingStatus] = useState<Record<string, { status: 'testing' | 'ok' | 'error'; detail?: string; latency_ms?: number }>>({});

  const handlePingEndpoint = async (epId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPingStatus((prev) => ({ ...prev, [epId]: { status: 'testing' } }));
    try {
      const res = await api.testEndpoint(epId);
      setPingStatus((prev) => ({
        ...prev,
        [epId]: {
          status: res.status === 'ok' ? 'ok' : 'error',
          detail: res.detail,
          latency_ms: res.latency_ms,
        },
      }));
    } catch (err) {
      setPingStatus((prev) => ({
        ...prev,
        [epId]: { status: 'error', detail: err instanceof Error ? err.message : 'Ping failed' },
      }));
    }
  };

  // Pre-fill campaign configuration when opened with an initialTemplate (e.g. Clone & Re-run)
  useEffect(() => {
    if (!isOpen || !initialTemplate) return;
    if (initialTemplate.endpoint_id) setSelectedEndpointId(initialTemplate.endpoint_id);
    if (initialTemplate.domain) setDomain(initialTemplate.domain);
    if (initialTemplate.judge_model) setJudgeModel(initialTemplate.judge_model);
    if (initialTemplate.judge_endpoint_id) setSelectedJudgeEndpointId(initialTemplate.judge_endpoint_id);
    if (initialTemplate.max_iterations) setMaxIterations(initialTemplate.max_iterations);
    if (initialTemplate.sample_size) setSampleSize(initialTemplate.sample_size);
    if (initialTemplate.risk_threshold !== undefined) setRiskThreshold(initialTemplate.risk_threshold);
    if (initialTemplate.techniques && initialTemplate.techniques.length > 0) {
      setSelectedTechniques(initialTemplate.techniques);
    }
    setCurrentStep(4);
  }, [isOpen, initialTemplate]);

  // Reset transient state when closed
  useEffect(() => {
    if (!isOpen) {
      setSubmitError(null);
      setTemplateSavedFlash(null);
      if (!initialTemplate) setCurrentStep(1);
      setAttackerApiKey('');
      setPingStatus({});
    }
  }, [isOpen, initialTemplate]);

  const domainPromptCount = DOMAIN_BASELINE_COUNTS[domain] || 5;
  const activeSampleSize = sampleSize === 'all' ? domainPromptCount : Math.min(sampleSize, domainPromptCount);

  // Dynamic Branch Count Calculation
  const calculatedBranchCount = useMemo(() => {
    return selectedTechniques.length * activeSampleSize;
  }, [selectedTechniques.length, activeSampleSize]);

  const estimatedMaxProbes = useMemo(() => {
    return calculatedBranchCount * maxIterations;
  }, [calculatedBranchCount, maxIterations]);

  const selectedDomainObj = useMemo(() => {
    return DOMAINS.find((d) => d.id === domain) || DOMAINS[0];
  }, [domain]);

  const goToEndpointRegistry = () => {
    onClose();
    navigate('/dashboard/endpoints');
  };

  const toggleTechnique = (id: string) => {
    if (selectedTechniques.includes(id)) {
      if (selectedTechniques.length === 1) return; // Keep at least one
      setSelectedTechniques(selectedTechniques.filter((t) => t !== id));
    } else {
      setSelectedTechniques([...selectedTechniques, id]);
    }
  };

  const applyPreset = (presetKey: 'broad' | 'forensic' | 'smoke') => {
    const known = new Set(techniqueRegistry.map((t) => t.id));
    if (presetKey === 'broad') {
      setSelectedTechniques(Array.from(known));
      setMaxIterations(3);
      setRiskThreshold(0.70);
      setSampleSize('all');
    } else if (presetKey === 'forensic') {
      setSelectedTechniques(['indirect_prompting', 'obfuscation', 'role_play', 'temporal_framing', 'semantic_polysemy'].filter((id) => known.has(id)));
      setMaxIterations(5);
      setRiskThreshold(0.75);
      setSampleSize('all');
    } else {
      setSelectedTechniques(['indirect_prompting', 'role_play'].filter((id) => known.has(id)));
      setMaxIterations(2);
      setRiskThreshold(0.60);
      setSampleSize(2);
    }
  };

  const handleLoadTemplate = (key: string) => {
    setSelectedTemplateKey(key);
    const tmpl = savedTemplates[key];
    if (!tmpl) return;
    setDomain(tmpl.domain);
    setJudgeModel(tmpl.judge_model);
    setSelectedTechniques(tmpl.selected_techniques.filter((id) => techniqueRegistry.some((t) => t.id === id)));
    setMaxIterations(tmpl.max_iterations);
    setRiskThreshold(tmpl.risk_threshold);
    if (tmpl.sample_size) setSampleSize(tmpl.sample_size);
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) return;
    const key = `custom-${Date.now()}`;
    const newTmpl: CampaignTemplate = {
      name: templateName.trim(),
      domain,
      attacker_model: LOCKED_ATTACKER_MODEL,
      judge_model: selectedJudgeEndpoint?.name || judgeModel,
      selected_techniques: selectedTechniques,
      max_iterations: maxIterations,
      risk_threshold: riskThreshold,
      sample_size: sampleSize === 'all' ? undefined : sampleSize,
    };
    const updated = { ...savedTemplates, [key]: newTmpl };
    setSavedTemplates(updated);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(updated));
    setTemplateName('');
    setTemplateSavedFlash(`TEMPLATE "${newTmpl.name.toUpperCase()}" SAVED`);
    setTimeout(() => setTemplateSavedFlash(null), 2500);
  };

  const handleDispatchRun = async () => {
    if (!selectedEndpointId) {
      setSubmitError('Please select a target Defender endpoint before launching.');
      setCurrentStep(2);
      return;
    }
    if (!attackerApiKey.trim()) {
      setSubmitError('Please provide your Mistral API Key for the Attacker model (Mistral Small requires your own BYOK key).');
      setCurrentStep(2);
      return;
    }
    if (selectedTechniques.length === 0) {
      setSubmitError('Please select at least one attack technique.');
      setCurrentStep(3);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const payload: CreateRunPayload = {
      domain,
      endpoint_id: selectedEndpointId,
      judge_endpoint_id: selectedJudgeEndpointId || undefined,
      attacker_model: LOCKED_ATTACKER_MODEL,
      judge_model: selectedJudgeEndpoint?.name || judgeModel.trim() || 'mistral/mistral-large-latest',
      attacker_api_key: attackerApiKey.trim(),
      techniques: selectedTechniques,
      selected_techniques: selectedTechniques,
      max_iterations: maxIterations,
      risk_threshold: riskThreshold,
      sample_size: sampleSize === 'all' ? undefined : sampleSize,
    };

    try {
      const res = await api.createRun(payload);
      const newRunId = res.run_id;

      invalidate('runs');

      setActiveRun(newRunId);
      setActiveRunMeta({
        domain,
        endpoint_id: selectedEndpointId,
        endpoint_name: selectedEndpoint?.name || selectedEndpointId,
        attacker_model: LOCKED_ATTACKER_MODEL,
        judge_model: selectedJudgeEndpoint?.name || judgeModel,
        started_at: new Date().toISOString(),
      });

      onRunCreated?.(newRunId);
      onClose();
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-slate/40 backdrop-blur-sm z-[60] animate-fade-in" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[94vw] max-w-5xl h-[92vh] bg-parchment z-[61] flex flex-col shadow-xl border border-hairline overflow-hidden font-mono"
          aria-describedby={undefined}
        >
          {/* ── Top Strip: Launcher Header ── */}
          <div className="p-4 md:px-6 bg-linen hairline-bottom flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 bg-slate text-parchment flex items-center justify-center font-bold text-xs">
                <Shield size={14} />
              </div>
              <div>
                <Dialog.Title className="text-xs font-bold uppercase tracking-wider text-slate">
                  CAMPAIGN LAUNCHER · 5-STAGE PIPELINE DISPATCHER
                </Dialog.Title>
                <p className="text-[10px] text-steel">
                  Configure target endpoint, evaluation domain, dual-LLM models, and attack probes.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Quick Template Picker */}
              <div className="hidden sm:flex items-center gap-2">
                <Bookmark size={12} className="text-steel" />
                <select
                  value={selectedTemplateKey}
                  onChange={(e) => handleLoadTemplate(e.target.value)}
                  className="text-[11px] bg-ivory border border-hairline px-2 py-1 uppercase text-slate cursor-pointer"
                  aria-label="Load campaign template"
                >
                  <option value="">LOAD TEMPLATE PRESET...</option>
                  {Object.entries(savedTemplates).map(([key, t]) => (
                    <option key={key} value={key}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <Dialog.Close asChild>
                <button
                  className="p-1.5 text-steel hover:text-slate hover:bg-linen border border-transparent hover:border-hairline cursor-pointer"
                  aria-label="Close Launcher"
                >
                  <X size={16} />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* ── 4-Stage Step Indicators Strip ── */}
          <div className="grid grid-cols-4 divide-x divide-hairline hairline-bottom bg-linen/20 text-[10px] uppercase font-bold text-steel shrink-0">
            {[
              { step: 1, label: '01. DOMAIN', summary: selectedDomainObj.name.split(' ')[0] },
              { step: 2, label: '02. MODELS', summary: selectedEndpoint ? selectedEndpoint.name : 'MISTRAL / BYOK' },
              { step: 3, label: '03. PROBES', summary: `${selectedTechniques.length} PROBES` },
              { step: 4, label: '04. REVIEW', summary: `${calculatedBranchCount} BRANCHES` },
            ].map((s) => {
              const isCurrent = currentStep === s.step;
              const isPassed = currentStep > s.step;
              return (
                <button
                  key={s.step}
                  onClick={() => setCurrentStep(s.step as 1 | 2 | 3 | 4)}
                  className={`p-3 text-left transition-colors cursor-pointer flex flex-col justify-between ${
                    isCurrent
                      ? 'bg-slate text-parchment font-bold shadow-2xs'
                      : isPassed
                      ? 'bg-linen/50 text-slate hover:bg-linen'
                      : 'hover:bg-linen/30 text-steel'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{s.label}</span>
                    {isPassed && <Check size={11} className="text-olive shrink-0" />}
                  </div>
                  <span className={`text-[9px] truncate mt-1 ${isCurrent ? 'text-parchment/80' : 'text-taupe'}`}>
                    {s.summary}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Error Banner ── */}
          {submitError && (
            <div className="p-3 bg-maroon text-parchment text-xs font-bold flex items-center justify-between hairline-bottom shrink-0">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} />
                <span>LAUNCH ERROR: {submitError}</span>
              </div>
              <button onClick={() => setSubmitError(null)} className="hover:opacity-80 p-0.5" aria-label="Dismiss error">
                <X size={13} />
              </button>
            </div>
          )}

          {/* ── Scrollable Stage Content Panel ── */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-6 md:p-8 space-y-6">
              <AnimatePresence mode="wait">
                {/* ════ STAGE 1: EVALUATION DOMAIN ════ */}
                {currentStep === 1 && (
                  <motion.div
                    key="stage-1"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    className="space-y-6"
                  >
                    <div className="pb-2 hairline-bottom">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-slate">
                        STAGE 01 · SELECT EVALUATION DOMAIN &amp; THREAT TAXONOMY
                      </h3>
                      <p className="text-xs text-steel mt-0.5">
                        Each domain injects specialized adversarial threat vectors and regulatory compliance rules.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {DOMAINS.map((d) => {
                        const isSelected = d.id === domain;
                        return (
                          <button
                            key={d.id}
                            onClick={() => setDomain(d.id)}
                            aria-pressed={isSelected}
                            className={`p-4 border text-left transition-all cursor-pointer select-none space-y-2 ${
                              isSelected
                                ? 'bg-slate text-parchment border-slate shadow-xs'
                                : 'bg-ivory text-slate border-hairline hover:border-steel hover:bg-linen/20'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 border ${
                                isSelected ? 'bg-parchment/10 border-parchment/30 text-parchment' : 'bg-linen border-hairline text-steel'
                              }`}>
                                {d.badge}
                              </span>
                              {isSelected && <Check size={14} className="text-parchment" />}
                            </div>
                            <div className="font-bold text-sm uppercase">{d.name}</div>
                            <p className={`text-[11px] leading-relaxed ${isSelected ? 'text-parchment/80' : 'text-steel'}`}>
                              {d.desc}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex justify-end pt-4 hairline-top">
                      <ActionButton variant="primary" onClick={() => setCurrentStep(2)}>
                        CONTINUE TO MODEL CONFIGURATION →
                      </ActionButton>
                    </div>
                  </motion.div>
                )}

                {/* ════ STAGE 2: DEFENDER, ATTACKER & JUDGE MODELS (BYOK) ════ */}
                {currentStep === 2 && (
                  <motion.div
                    key="stage-2"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    className="space-y-6"
                  >
                    <div className="pb-2 hairline-bottom">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-slate">
                        STAGE 02 · CONFIGURE DEFENDER, ATTACKER &amp; JUDGE MODELS
                      </h3>
                      <p className="text-xs text-steel mt-0.5">
                        Adversarial engine is locked to Mistral Small (requires your Mistral API key). Defender and Judge models are configured using registered endpoints.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                      {/* 1. Defender (Target) Config */}
                      <div className="p-5 bg-linen/40 border border-hairline space-y-4 flex flex-col justify-between">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between pb-2 hairline-bottom">
                            <div className="flex items-center gap-2">
                              <Shield size={14} className="text-slate" />
                              <span className="text-xs font-bold uppercase text-slate">1. DEFENDER (TARGET)</span>
                            </div>
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 bg-linen border border-hairline text-steel">
                              CUSTOMIZABLE
                            </span>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-[10px] font-bold uppercase text-taupe">
                                TARGET ENDPOINT
                              </label>
                              <button
                                type="button"
                                onClick={goToEndpointRegistry}
                                className="text-[10px] font-bold uppercase text-steel hover:text-slate transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <Zap size={10} /> + ADD / MANAGE
                              </button>
                            </div>
                            {loadingEndpoints ? (
                              <div className="p-3 bg-linen/50 border border-hairline text-steel text-xs font-mono">
                                Loading registered endpoints...
                              </div>
                            ) : endpointsError ? (
                              <div className="p-3 bg-cream border border-hairline text-maroon text-[11px] space-y-1">
                                <p className="font-bold uppercase">FAILED TO LOAD ENDPOINTS</p>
                                <p className="text-steel">{endpointsError}</p>
                              </div>
                            ) : endpoints.length > 0 ? (
                              <select
                                value={selectedEndpointId}
                                onChange={(e) => setSelectedEndpointId(e.target.value)}
                                className="w-full bg-ivory border border-hairline px-3 py-2 text-xs text-slate focus:outline-none focus:border-slate font-mono"
                              >
                                {endpoints.map((ep) => (
                                  <option key={ep.id} value={ep.id}>
                                    {ep.name} ({ep.provider.toUpperCase()})
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <div className="p-3 bg-cream border border-hairline text-steel text-[11px] space-y-2">
                                <p className="font-bold text-slate uppercase">NO ENDPOINTS FOUND</p>
                                <button
                                  type="button"
                                  onClick={goToEndpointRegistry}
                                  className="px-2 py-1 bg-slate text-parchment text-[10px] font-bold uppercase hover:bg-slate/90 cursor-pointer"
                                >
                                  + ADD ENDPOINT IN REGISTRY
                                </button>
                              </div>
                            )}
                            <span className="text-[10px] text-taupe block mt-1">
                              Target system under adversarial evaluation
                            </span>
                          </div>

                          {selectedEndpoint && (
                            <div className="p-3 bg-ivory border border-hairline space-y-1.5 text-xs">
                              <div className="flex justify-between">
                                <span className="text-taupe uppercase text-[10px]">PROVIDER:</span>
                                <span className="font-mono font-bold text-slate uppercase text-[11px]">{selectedEndpoint.provider}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-taupe uppercase text-[10px]">BASE URL:</span>
                                <span className="font-mono text-slate text-[11px] truncate max-w-[170px]" title={selectedEndpoint.base_url}>
                                  {selectedEndpoint.base_url || 'Default cloud endpoint'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-taupe uppercase text-[10px]">CREDENTIALS:</span>
                                <span className="text-olive font-bold text-[10px]">✓ STORED IN VAULT</span>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="text-[10px] text-steel pt-2 hairline-top">
                          Target model under red-team security evaluation
                        </div>
                      </div>

                      {/* 2. Attacker Config (LOCKED TO MISTRAL SMALL) */}
                      <div className="p-5 bg-linen/60 border-2 border-slate/30 space-y-4 flex flex-col justify-between shadow-2xs">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between pb-2 hairline-bottom">
                            <div className="flex items-center gap-2">
                              <Sparkles size={14} className="text-slate" />
                              <span className="text-xs font-bold uppercase text-slate">2. ATTACKER GENERATOR</span>
                            </div>
                            <span className="flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 bg-slate text-parchment font-mono">
                              <Lock size={10} /> LOCKED
                            </span>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-taupe mb-1">
                              MODEL IDENTIFIER (LOCKED)
                            </label>
                            <div className="relative">
                              <input
                                value={LOCKED_ATTACKER_MODEL}
                                readOnly
                                disabled
                                className="w-full bg-linen/80 border border-hairline px-3 py-2 pr-32 text-xs text-slate font-mono cursor-not-allowed select-none opacity-90"
                              />
                              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-steel flex items-center gap-1">
                                <Lock size={11} /> MISTRAL SMALL
                              </div>
                            </div>
                            <span className="text-[10px] text-taupe block mt-1">
                              Adversarial engine is locked to Mistral Small
                            </span>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate mb-1 flex items-center justify-between">
                              <span>MISTRAL API KEY (BYOK)</span>
                              <span className="text-[9px] font-bold text-maroon uppercase tracking-wider">* REQUIRED</span>
                            </label>
                            <input
                              type="password"
                              value={attackerApiKey}
                              onChange={(e) => setAttackerApiKey(e.target.value)}
                              placeholder="Enter your Mistral API key"
                              className={`w-full bg-ivory border px-3 py-2 text-xs text-slate focus:outline-none focus:border-slate font-mono ${
                                !attackerApiKey.trim() ? 'border-maroon/50 focus:border-maroon' : 'border-hairline'
                              }`}
                            />
                            <span className="text-[10px] text-steel block mt-1">
                              Your personal Mistral API key is required to run attacker probes
                            </span>
                          </div>
                        </div>
                        <div className="text-[10px] text-steel pt-2 hairline-top">
                          Standardized baseline model for reproducible jailbreak sweeps
                        </div>
                      </div>

                      {/* 3. Judge Config (LITELLM ENDPOINT) */}
                      <div className="p-5 bg-linen/40 border border-hairline space-y-4 flex flex-col justify-between">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between pb-2 hairline-bottom">
                            <div className="flex items-center gap-2">
                              <Zap size={14} className="text-slate" />
                              <span className="text-xs font-bold uppercase text-slate">3. JUDGE ARBITER</span>
                            </div>
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 bg-linen border border-hairline text-steel">
                              CUSTOMIZABLE
                            </span>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-[10px] font-bold uppercase text-taupe">
                                SAFETY JUDGE ENDPOINT
                              </label>
                              <button
                                type="button"
                                onClick={goToEndpointRegistry}
                                className="text-[10px] font-bold uppercase text-steel hover:text-slate transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <Zap size={10} /> + ADD / MANAGE
                              </button>
                            </div>
                            {loadingEndpoints ? (
                              <div className="p-3 bg-linen/50 border border-hairline text-steel text-xs font-mono">
                                Loading registered endpoints...
                              </div>
                            ) : litellmEndpoints.length > 0 ? (
                              <select
                                value={selectedJudgeEndpointId}
                                onChange={(e) => setSelectedJudgeEndpointId(e.target.value)}
                                className="w-full bg-ivory border border-hairline px-3 py-2 text-xs text-slate focus:outline-none focus:border-slate font-mono"
                              >
                                <option value="">Default Server Arbiter (Mistral Large)</option>
                                {litellmEndpoints.map((ep) => (
                                  <option key={ep.id} value={ep.id}>
                                    {ep.name} ({ep.provider.toUpperCase()})
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <div className="p-3 bg-cream border border-hairline text-steel text-[11px] space-y-2">
                                <p className="font-bold text-slate uppercase">NO LITELLM ENDPOINTS</p>
                                <p className="text-[10px]">Using server default Mistral Arbiter, or register an OpenAI/Anthropic/Gemini endpoint.</p>
                                <button
                                  type="button"
                                  onClick={goToEndpointRegistry}
                                  className="px-2 py-1 bg-slate text-parchment text-[10px] font-bold uppercase hover:bg-slate/90 cursor-pointer"
                                >
                                  + ADD ENDPOINT IN REGISTRY
                                </button>
                              </div>
                            )}
                            <span className="text-[10px] text-taupe block mt-1">
                              LiteLLM-compatible chat endpoint for safety scoring
                            </span>
                          </div>

                          {selectedJudgeEndpoint ? (
                            <div className="p-3 bg-ivory border border-hairline space-y-1.5 text-xs">
                              <div className="flex justify-between">
                                <span className="text-taupe uppercase text-[10px]">PROVIDER:</span>
                                <span className="font-mono font-bold text-slate uppercase text-[11px]">{selectedJudgeEndpoint.provider}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-taupe uppercase text-[10px]">BASE URL:</span>
                                <span className="font-mono text-slate text-[11px] truncate max-w-[170px]" title={selectedJudgeEndpoint.base_url}>
                                  {selectedJudgeEndpoint.base_url || 'Default cloud endpoint'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-taupe uppercase text-[10px]">INTEGRATION:</span>
                                <span className="text-olive font-bold text-[10px]">✓ LITELLM CHAT API</span>
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 bg-linen/30 border border-hairline space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-taupe uppercase text-[10px]">FALLBACK ARBITER:</span>
                                <span className="font-mono font-bold text-slate text-[11px]">mistral/mistral-large-latest</span>
                              </div>
                              <span className="text-[10px] text-steel block">Uses server-configured Mistral credentials</span>
                            </div>
                          )}
                        </div>
                        <div className="text-[10px] text-steel pt-2 hairline-top">
                          Evaluates target responses for safety violations &amp; leaks
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between pt-4 hairline-top">
                      <ActionButton variant="ghost" onClick={() => setCurrentStep(1)}>
                        ← BACK
                      </ActionButton>
                      <ActionButton variant="primary" onClick={() => setCurrentStep(3)}>
                        CONTINUE TO ATTACK TECHNIQUES →
                      </ActionButton>
                    </div>
                  </motion.div>
                )}

                {/* ════ STAGE 3: TECHNIQUES & ITERATIONS ════ */}
                {currentStep === 3 && (
                  <motion.div
                    key="stage-3"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    className="space-y-6"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 hairline-bottom">
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate">
                          STAGE 03 · SELECT ATTACK PROBES &amp; MUTATION DEPTH
                        </h3>
                        <p className="text-xs text-steel mt-0.5">
                          {selectedTechniques.length} of {techniqueRegistry.length} techniques selected · {calculatedBranchCount} concurrent task branches
                        </p>
                      </div>

                      {/* Attack Recipe Presets */}
                      <div className="flex items-center gap-1.5 text-[10px] font-bold">
                        <span className="text-taupe uppercase mr-1">PRESETS:</span>
                        <button
                          type="button"
                          onClick={() => applyPreset('broad')}
                          className="px-2 py-1 bg-linen border border-hairline text-slate hover:bg-slate hover:text-parchment transition-colors cursor-pointer"
                        >
                          BROAD ({techniqueRegistry.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPreset('forensic')}
                          className="px-2 py-1 bg-linen border border-hairline text-slate hover:bg-slate hover:text-parchment transition-colors cursor-pointer"
                        >
                          FORENSIC (5)
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPreset('smoke')}
                          className="px-2 py-1 bg-linen border border-hairline text-slate hover:bg-slate hover:text-parchment transition-colors cursor-pointer"
                        >
                          SMOKE (2)
                        </button>
                      </div>
                    </div>

                    {/* Techniques Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto p-1">
                      {techniqueRegistry.map((tech) => {
                        const isSelected = selectedTechniques.includes(tech.id);
                        return (
                          <button
                            key={tech.id}
                            type="button"
                            onClick={() => toggleTechnique(tech.id)}
                            aria-pressed={isSelected}
                            className={`p-3 text-left border transition-all cursor-pointer select-none space-y-1 ${
                              isSelected
                                ? 'bg-slate text-parchment border-slate shadow-xs'
                                : 'bg-ivory text-slate border-hairline hover:border-steel hover:bg-linen/30'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold uppercase truncate pr-2">{tech.name.split(' (')[0]}</span>
                              {isSelected ? <Check size={13} className="shrink-0" /> : <span className="text-taupe text-[10px]">+</span>}
                            </div>
                            {tech.desc && (
                              <p className={`text-[10px] leading-tight line-clamp-2 ${isSelected ? 'text-parchment/70' : 'text-steel'}`}>
                                {tech.desc}
                              </p>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Execution Parameters & Sampling Control */}
                    <div className="p-4 bg-linen/40 border border-hairline space-y-4 text-xs">
                      {/* Specimen Sample Size Control */}
                      <div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                          <div>
                            <span className="font-bold text-slate uppercase block">DOMAIN SPECIMEN SAMPLES (BENIGN SEED PROMPTS):</span>
                            <span className="text-[10px] text-taupe">Select how many baseline domain prompts to evaluate in this sweep</span>
                          </div>
                          <div className="font-mono text-xs font-bold text-slate bg-ivory px-2.5 py-1 border border-hairline self-start sm:self-auto">
                            {sampleSize === 'all' ? `ALL (${domainPromptCount} PROMPTS)` : `${activeSampleSize} OF ${domainPromptCount} PROMPTS`}
                          </div>
                        </div>

                        {/* Quick Sample Selector Pills */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {[
                            { label: '2 PROMPTS (SMOKE)', value: 2 },
                            { label: '3 PROMPTS (FAST)', value: 3 },
                            { label: '5 PROMPTS (STANDARD)', value: 5 },
                            { label: `ALL PROMPTS (${domainPromptCount})`, value: 'all' as const },
                          ].map((opt) => {
                            const isSelected = sampleSize === opt.value;
                            return (
                              <button
                                key={String(opt.value)}
                                type="button"
                                onClick={() => setSampleSize(opt.value)}
                                className={`px-2.5 py-1 font-mono text-[10px] font-bold uppercase transition-all cursor-pointer border ${
                                  isSelected
                                    ? 'bg-slate text-parchment border-slate shadow-xs'
                                    : 'bg-ivory text-steel border-hairline hover:border-steel/60 hover:text-slate'
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 hairline-top">
                        <div>
                          <div className="flex justify-between font-bold text-slate mb-1">
                            <span className="uppercase">MAX MUTATION DEPTH:</span>
                            <span className="font-mono text-sm">{maxIterations} ITERATIONS</span>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="10"
                            value={maxIterations}
                            onChange={(e) => setMaxIterations(parseInt(e.target.value))}
                            className="w-full accent-slate cursor-pointer"
                            aria-label="Max mutation depth"
                          />
                          <span className="text-[10px] text-taupe block mt-1">Adaptive prompt mutation cycles per branch before finalizing outcome</span>
                        </div>

                        <div>
                          <div className="flex justify-between font-bold text-slate mb-1">
                            <span className="uppercase">BREAKTHROUGH RISK THRESHOLD:</span>
                            <span className="font-mono text-sm">{riskThreshold.toFixed(2)}</span>
                          </div>
                          <input
                            type="range"
                            min="0.10"
                            max="1.00"
                            step="0.05"
                            value={riskThreshold}
                            onChange={(e) => setRiskThreshold(parseFloat(e.target.value))}
                            className="w-full accent-maroon cursor-pointer"
                            aria-label="Breakthrough risk threshold"
                          />
                          <span className="text-[10px] text-taupe block mt-1">Minimum judge severity score required to declare a breakthrough finding</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between pt-4 hairline-top">
                      <ActionButton variant="ghost" onClick={() => setCurrentStep(2)}>
                        ← BACK
                      </ActionButton>
                      <ActionButton variant="primary" onClick={() => setCurrentStep(4)}>
                        CONTINUE TO VERIFY &amp; LAUNCH →
                      </ActionButton>
                    </div>
                  </motion.div>
                )}

                {/* ════ STAGE 4: VERIFICATION & DISPATCH RECEIPT ════ */}
                {currentStep === 4 && (
                  <motion.div
                    key="stage-4"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    className="space-y-6"
                  >
                    <div className="pb-2 hairline-bottom">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-slate">
                        STAGE 04 · VERIFY CAMPAIGN AUDIT RECEIPT &amp; DISPATCH
                      </h3>
                      <p className="text-xs text-steel mt-0.5">
                        Review execution parameters, save as reusable template, and launch the distributed pipeline.
                      </p>
                    </div>

                    {/* Campaign Summary Receipt Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 bg-linen/50 border border-hairline text-xs">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-taupe uppercase">TARGET ENDPOINT:</span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate uppercase">{selectedEndpoint?.name || selectedEndpointId}</span>
                            {selectedEndpointId && (
                              <button
                                type="button"
                                onClick={(e) => handlePingEndpoint(selectedEndpointId, e)}
                                className="px-1.5 py-0.5 border border-hairline font-mono text-[9px] font-bold uppercase hover:bg-slate hover:text-parchment transition-colors cursor-pointer"
                                title="Test target endpoint connectivity"
                              >
                                {pingStatus[selectedEndpointId]?.status === 'testing' ? (
                                  <span className="text-camel animate-pulse">PINGING...</span>
                                ) : pingStatus[selectedEndpointId]?.status === 'ok' ? (
                                  <span className="text-olive">✓ {pingStatus[selectedEndpointId]?.latency_ms}MS</span>
                                ) : pingStatus[selectedEndpointId]?.status === 'error' ? (
                                  <span className="text-maroon">✗ FAILED</span>
                                ) : (
                                  <span>⚡ TEST PING</span>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-taupe uppercase">DEFENDER / TARGET:</span>
                          <span className="font-bold text-slate">
                            {selectedEndpoint ? `${selectedEndpoint.name} [${selectedEndpoint.provider.toUpperCase()}]` : 'DEFAULT'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-taupe uppercase">ATTACKER MODEL:</span>
                          <span className="font-bold text-slate flex items-center gap-1">
                            <Lock size={11} className="text-slate" /> {LOCKED_ATTACKER_MODEL}
                            <span className="text-[9px] px-1 py-0.2 bg-slate text-parchment font-mono ml-1">LOCKED · BYOK</span>
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-taupe uppercase">JUDGE ARBITER:</span>
                          <span className="font-bold text-slate">
                            {selectedJudgeEndpoint ? `${selectedJudgeEndpoint.name} [${selectedJudgeEndpoint.provider.toUpperCase()}]` : 'DEFAULT MISTRAL ARBITER'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-taupe uppercase">EVALUATION DOMAIN:</span>
                          <span className="font-bold text-slate uppercase">{selectedDomainObj.name}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-taupe uppercase">DOMAIN SPECIMENS:</span>
                          <span className="font-bold text-slate">{activeSampleSize} PROMPTS ({sampleSize === 'all' ? 'ALL' : 'SUBSET'})</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-taupe uppercase">ATTACK PROBES:</span>
                          <span className="font-bold text-slate">{selectedTechniques.length} TECHNIQUES</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-taupe uppercase">MAX MUTATION DEPTH:</span>
                          <span className="font-bold text-slate">{maxIterations} ITERATIONS</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-taupe uppercase">RISK THRESHOLD:</span>
                          <span className="font-bold text-maroon">≥ {riskThreshold.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between pt-1 hairline-top">
                          <span className="text-slate font-bold uppercase">CALCULATED TASK BRANCHES:</span>
                          <span className="font-bold text-base text-slate tabular-nums">{calculatedBranchCount} BRANCHES</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-taupe uppercase">ESTIMATED MAX INVOCATIONS:</span>
                          <span className="font-mono font-bold text-slate">~{estimatedMaxProbes} PROBES</span>
                        </div>
                      </div>
                    </div>

                    {/* Save Template Option */}
                    <div className="p-4 bg-cream/40 border border-hairline flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <Bookmark size={14} className="text-slate shrink-0" />
                        <div>
                          <span className="font-bold uppercase text-slate block">SAVE CONFIGURATION AS REUSABLE TEMPLATE</span>
                          <span className="text-[10px] text-steel">Store these settings for 1-click execution in future sweeps</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <input
                          type="text"
                          placeholder="Template Name..."
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          className="px-2.5 py-1.5 bg-ivory border border-hairline text-xs text-slate focus:outline-none focus:border-slate w-full sm:w-48"
                          aria-label="Template name"
                        />
                        <button
                          type="button"
                          onClick={handleSaveTemplate}
                          disabled={!templateName.trim()}
                          className="px-3 py-1.5 bg-slate text-parchment text-xs font-bold uppercase hover:bg-slate/90 disabled:opacity-50 cursor-pointer shrink-0"
                        >
                          SAVE
                        </button>
                      </div>
                    </div>
                    {templateSavedFlash && (
                      <div className="flex items-center gap-2 text-[11px] font-bold uppercase text-olive" role="status">
                        <Check size={12} />
                        {templateSavedFlash}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 hairline-top">
                      <ActionButton variant="ghost" onClick={() => setCurrentStep(3)}>
                        ← BACK TO PROBES
                      </ActionButton>
                      <div className="flex gap-3 w-full sm:w-auto">
                        <ActionButton variant="ghost" onClick={onClose}>
                          CANCEL
                        </ActionButton>
                        <ActionButton
                          variant="primary"
                          onClick={handleDispatchRun}
                          disabled={isSubmitting}
                          icon={<Play size={14} className="fill-current" />}
                          className="w-full sm:w-auto px-6 py-3 text-sm"
                        >
                          {isSubmitting ? 'DISPATCHING PIPELINE WORKERS' : 'DISPATCH ADVERSARIAL PIPELINE'}
                        </ActionButton>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

// ── Layout-level host ─────────────────────────────────────────────────────────
// Mounted once in Layout; any surface opens dispatch via useLauncherStore.

export function CampaignLauncherHost() {
  const open = useLauncherStore((s) => s.open);
  const closeLauncher = useLauncherStore((s) => s.closeLauncher);
  return (
    <CampaignLauncher
      isOpen={open}
      onClose={closeLauncher}
    />
  );
}
