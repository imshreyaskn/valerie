import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { Zap, Plus, Trash2, Play, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ALL_TECHNIQUES = [
  { id: 'indirect_prompting', name: 'Indirect Prompting (Chained Questioning)' },
  { id: 'obfuscation', name: 'Obfuscation (Synonym Substitution)' },
  { id: 'role_play', name: 'Role Play (Persona-Based Reframing)' },
  { id: 'temporal_framing', name: 'Temporal Framing (Chronological Misdirection)' },
  { id: 'semantic_polysemy', name: 'Semantic Polysemy (Ambiguous Terminology)' },
  { id: 'hybrid_framing', name: 'Hybrid Framing (Micro-Precision + Macro-Abstraction)' },
  { id: 'futuristic_projection', name: 'Futuristic Projection' },
  { id: 'metaphorical_framing', name: 'Metaphorical Framing' },
  { id: 'historical_analogy', name: 'Historical Analogy' },
  { id: 'esoteric_jargon', name: 'Esoteric Jargon Injection' },
  { id: 'emotional_manipulation', name: 'Emotional Manipulation' },
  { id: 'utilitarian_pretext', name: 'Utilitarian Pretext' },
  { id: 'societal_integration', name: 'Societal Integration Pretext' },
  { id: 'alias_proxy', name: 'Alias and Proxy Metaphor' },
  { id: 'multi_domain_convergence', name: 'Multi-Domain Convergence' },
];

export default function Endpoints() {
  const navigate = useNavigate();
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const [showCreateEndpoint, setShowCreateEndpoint] = useState(false);
  const [showLaunchRun, setShowLaunchRun] = useState(false);

  // Endpoint Form State
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('openai_compat');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');

  // Run Config Form State
  const [selectedEndpointId, setSelectedEndpointId] = useState('');
  const [domain, setDomain] = useState('bfsi');
  const [attackerModel, setAttackerModel] = useState('mistral/mistral-large-latest');
  const [judgeModel, setJudgeModel] = useState('mistral/mistral-large-latest');
  const [attackerApiKey, setAttackerApiKey] = useState('');
  const [judgeApiKey, setJudgeApiKey] = useState('');
  const [selectedTechniques, setSelectedTechniques] = useState<string[]>(['indirect_prompting']);
  const [maxIterations, setMaxIterations] = useState(3);
  const [riskThreshold, setRiskThreshold] = useState(0.7);
  const [isSubmittingRun, setIsSubmittingRun] = useState(false);

  const loadEndpoints = () => {
    api.listEndpoints().then(res => {
      setEndpoints(res.endpoints || []);
      if (res.endpoints && res.endpoints.length > 0) {
        setSelectedEndpointId(res.endpoints[0].id);
      }
    }).catch(console.error);
  };

  useEffect(() => { loadEndpoints(); }, []);

  const handleCreateEndpoint = async () => {
    await api.createEndpoint({ name, provider, base_url: baseUrl, api_key: apiKey });
    setShowCreateEndpoint(false);
    setName('');
    setBaseUrl('');
    setApiKey('');
    loadEndpoints();
  };

  const handleDeleteEndpoint = async (id: string) => {
    await api.deleteEndpoint(id);
    loadEndpoints();
  };

  const handleTestEndpoint = async (id: string) => {
    try {
      const res = await api.testEndpoint(id);
      alert(res.status === 'ok' ? 'Connection Successful' : `Connection Failed: ${res.detail}`);
    } catch (e) {
      alert('Test request failed.');
    }
  };

  const toggleTechnique = (techId: string) => {
    if (selectedTechniques.includes(techId)) {
      if (selectedTechniques.length === 1) return; // Must keep at least one
      setSelectedTechniques(selectedTechniques.filter(t => t !== techId));
    } else {
      setSelectedTechniques([...selectedTechniques, techId]);
    }
  };

  const handleLaunchRun = async () => {
    if (!selectedEndpointId) {
      alert('Please select or create an endpoint first.');
      return;
    }
    setIsSubmittingRun(true);
    try {
      const payload = {
        domain,
        endpoint_id: selectedEndpointId,
        attacker_model: attackerModel,
        judge_model: judgeModel,
        attacker_api_key: attackerApiKey || undefined,
        judge_api_key: judgeApiKey || undefined,
        selected_techniques: selectedTechniques,
        max_iterations: maxIterations,
        risk_threshold: riskThreshold,
      };
      await api.createRun(payload);
      setShowLaunchRun(false);
      navigate('/');
    } catch (err: any) {
      alert(`Failed to launch run: ${err.message || err}`);
    } finally {
      setIsSubmittingRun(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="display-text text-mountain-slate font-sans uppercase">
            Target Endpoints & Runs
          </h1>
          <p className="text-mountain-steel mt-1 font-mono text-sm tracking-wider uppercase">
            Model Connections & V3.0 Red-Team Pipelines
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowLaunchRun(true)} 
            className="px-4 py-2.5 bg-rose-600 text-white text-sm font-bold uppercase hover:bg-rose-700 transition-all flex items-center gap-2"
          >
            <Play className="w-4 h-4 fill-white" /> NEW RED-TEAM RUN
          </button>
          <button 
            onClick={() => setShowCreateEndpoint(true)} 
            className="px-4 py-2.5 bg-mountain-slate text-mountain-off-white text-sm font-bold uppercase hover:bg-mountain-steel transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> ADD ENDPOINT
          </button>
        </div>
      </div>

      {/* NEW ENDPOINT MODAL/PANEL */}
      {showCreateEndpoint && (
        <div className="bg-white border-2 border-mountain-slate p-6 space-y-4 shadow-lg">
          <h3 className="text-sm font-bold text-mountain-slate tracking-widest uppercase">New Endpoint</h3>
          <input 
            placeholder="Name (e.g. My Local vLLM / Mistral Target)" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            className="w-full bg-mountain-off-white border-2 border-mountain-slate/20 px-4 py-2 text-xs font-mono text-mountain-slate mb-2 focus:border-mountain-slate focus:outline-none" 
          />
          <select 
            value={provider} 
            onChange={e => setProvider(e.target.value)} 
            className="w-full bg-mountain-off-white border-2 border-mountain-slate/20 px-4 py-2 text-xs font-mono text-mountain-slate mb-2 uppercase focus:border-mountain-slate focus:outline-none"
          >
            <option value="openai_compat">OpenAI Compatible (Bearer Auth)</option>
            <option value="anthropic">Anthropic (x-api-key)</option>
            <option value="gemini">Google Gemini</option>
            <option value="custom">Custom HTTP</option>
          </select>
          <input 
            placeholder="Base URL" 
            value={baseUrl} 
            onChange={e => setBaseUrl(e.target.value)} 
            className="w-full bg-mountain-off-white border-2 border-mountain-slate/20 px-4 py-2 text-xs font-mono text-mountain-slate mb-2 focus:border-mountain-slate focus:outline-none" 
          />
          <input 
            placeholder="API Key / Auth Token" 
            type="password" 
            value={apiKey} 
            onChange={e => setApiKey(e.target.value)} 
            className="w-full bg-mountain-off-white border-2 border-mountain-slate/20 px-4 py-2 text-xs font-mono text-mountain-slate mb-4 focus:border-mountain-slate focus:outline-none" 
          />
          <div className="flex gap-2">
            <button onClick={handleCreateEndpoint} className="px-4 py-2 bg-mountain-slate text-mountain-off-white font-bold uppercase text-xs hover:bg-mountain-steel transition-colors">Save Endpoint</button>
            <button onClick={() => setShowCreateEndpoint(false)} className="px-4 py-2 bg-mountain-warm-grey/20 text-mountain-steel font-bold uppercase text-xs hover:text-mountain-slate transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* NEW RED TEAM RUN CONFIGURATION PANEL */}
      {showLaunchRun && (
        <div className="bg-white border-2 border-rose-600 p-6 space-y-6 shadow-xl">
          <div className="flex justify-between items-center border-b-2 border-rose-600/20 pb-3">
            <h3 className="text-sm font-bold text-rose-600 tracking-widest uppercase flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600" /> Launch Red-Team Pipeline (V3.0 Architecture)
            </h3>
            <button onClick={() => setShowLaunchRun(false)} className="text-xs font-mono font-bold text-mountain-steel hover:text-rose-600">✕ CLOSE</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div>
              <label className="block font-bold text-mountain-slate uppercase mb-1">Target Endpoint</label>
              <select 
                value={selectedEndpointId} 
                onChange={e => setSelectedEndpointId(e.target.value)} 
                className="w-full bg-mountain-off-white border border-mountain-slate p-2 focus:outline-none"
              >
                {endpoints.map(ep => (
                  <option key={ep.id} value={ep.id}>{ep.name} ({ep.provider})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-mountain-slate uppercase mb-1">Target Domain</label>
              <select 
                value={domain} 
                onChange={e => setDomain(e.target.value)} 
                className="w-full bg-mountain-off-white border border-mountain-slate p-2 focus:outline-none uppercase"
              >
                <option value="bfsi">BFSI (Financial Crime / Fraud)</option>
                <option value="healthcare">Healthcare & Medical</option>
                <option value="pharmacy">Pharmacy & Controlled Substances</option>
                <option value="legal">Legal & Compliance</option>
                <option value="hr">HR & Employee Data</option>
                <option value="ecommerce">Ecommerce & Payments</option>
                <option value="general">General Safety Baseline</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-mountain-slate uppercase mb-1">Attacker Model</label>
              <input 
                value={attackerModel} 
                onChange={e => setAttackerModel(e.target.value)} 
                placeholder="e.g. mistral/mistral-large-latest or groq/llama-3.3-70b-versatile"
                className="w-full bg-mountain-off-white border border-mountain-slate p-2 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-mountain-slate uppercase mb-1">Judge Model</label>
              <input 
                value={judgeModel} 
                onChange={e => setJudgeModel(e.target.value)} 
                placeholder="e.g. mistral/mistral-large-latest"
                className="w-full bg-mountain-off-white border border-mountain-slate p-2 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-mountain-slate uppercase mb-1">Attacker API Key Override (Optional)</label>
              <input 
                type="password"
                value={attackerApiKey} 
                onChange={e => setAttackerApiKey(e.target.value)} 
                placeholder="Groq / Mistral / OpenRouter Key"
                className="w-full bg-mountain-off-white border border-mountain-slate p-2 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-mountain-slate uppercase mb-1">Judge API Key Override (Optional)</label>
              <input 
                type="password"
                value={judgeApiKey} 
                onChange={e => setJudgeApiKey(e.target.value)} 
                placeholder="Mistral API Key"
                className="w-full bg-mountain-off-white border border-mountain-slate p-2 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-mountain-slate uppercase mb-1">Max Iterations: {maxIterations}</label>
              <input 
                type="range" min="1" max="10" 
                value={maxIterations} 
                onChange={e => setMaxIterations(parseInt(e.target.value))} 
                className="w-full accent-rose-600 cursor-pointer"
              />
            </div>

            <div>
              <label className="block font-bold text-mountain-slate uppercase mb-1">Risk Threshold: {riskThreshold.toFixed(2)}</label>
              <input 
                type="range" min="0.1" max="1.0" step="0.05"
                value={riskThreshold} 
                onChange={e => setRiskThreshold(parseFloat(e.target.value))} 
                className="w-full accent-rose-600 cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-mountain-slate uppercase mb-2 text-xs font-mono">
              V3.0 Attack Techniques ({selectedTechniques.length} Selected)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 border border-mountain-slate/20 bg-mountain-off-white">
              {ALL_TECHNIQUES.map(tech => {
                const isSelected = selectedTechniques.includes(tech.id);
                return (
                  <button 
                    key={tech.id}
                    type="button"
                    onClick={() => toggleTechnique(tech.id)}
                    className={`text-left text-[11px] font-mono p-2 border transition-all ${
                      isSelected 
                        ? 'border-rose-600 bg-rose-50 font-bold text-rose-900' 
                        : 'border-gray-200 bg-white text-mountain-steel hover:border-mountain-slate'
                    }`}
                  >
                    {isSelected ? '✓ ' : '+ '}{tech.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button 
              onClick={handleLaunchRun} 
              disabled={isSubmittingRun}
              className="px-6 py-2.5 bg-rose-600 text-white font-bold uppercase text-xs hover:bg-rose-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-white" /> {isSubmittingRun ? 'Dispatching...' : 'Start Pipeline Run'}
            </button>
            <button 
              onClick={() => setShowLaunchRun(false)} 
              className="px-4 py-2.5 bg-mountain-warm-grey/20 text-mountain-steel font-bold uppercase text-xs hover:text-mountain-slate transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ENDPOINT LIST */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {endpoints.map(ep => (
          <div key={ep.id} className="bg-white border-2 border-mountain-slate p-6 hover:shadow-md transition-all">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-mountain-slate" />
                <span className="font-bold text-mountain-slate uppercase tracking-widest">{ep.name}</span>
              </div>
              <button onClick={() => handleDeleteEndpoint(ep.id)} className="text-mountain-steel hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="text-xs font-mono text-mountain-steel mb-4 truncate">{ep.base_url || 'No Base URL'}</div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono uppercase bg-mountain-slate/10 px-2 py-1 text-mountain-steel">{ep.provider}</span>
              <button onClick={() => handleTestEndpoint(ep.id)} className="text-xs font-bold text-mountain-slate hover:opacity-70 uppercase">Test Connection</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
