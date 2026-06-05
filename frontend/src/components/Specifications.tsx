import { Shield, Key, Workflow, FileJson } from 'lucide-react';
import './Specifications.css';

export default function Specifications() {
  return (
    <section className="spec-section hairline-bottom">
      <div className="spec-header hairline-bottom">
        SPECIFICATIONS
      </div>
      
      <div className="spec-row hairline-bottom">
        <div className="spec-cell spec-id hairline-right">2.01</div>
        <div className="spec-cell spec-title hairline-right">BRING YOUR OWN KEY</div>
        <div className="spec-cell spec-desc hairline-right">Centralized or local architecture. Utilize proprietary OpenAI, Anthropic, or Mistral keys securely.</div>
        <div className="spec-cell spec-icon"><Key size={24} strokeWidth={1} /></div>
      </div>

      <div className="spec-row hairline-bottom">
        <div className="spec-cell spec-id hairline-right">2.02</div>
        <div className="spec-cell spec-title hairline-right">DOMAIN PROBES</div>
        <div className="spec-cell spec-desc hairline-right">Prebuilt attack vectors targeting Banking, Healthcare, Legal, and HR compliance standards.</div>
        <div className="spec-cell spec-icon"><Shield size={24} strokeWidth={1} /></div>
      </div>

      <div className="spec-row hairline-bottom">
        <div className="spec-cell spec-id hairline-right">2.03</div>
        <div className="spec-cell spec-title hairline-right">AUTOMATED PIPELINE</div>
        <div className="spec-cell spec-desc hairline-right">Dual LLM configuration. Attacker model generates dynamic probes while an independent judge model evaluates risk.</div>
        <div className="spec-cell spec-icon"><Workflow size={24} strokeWidth={1} /></div>
      </div>

      <div className="spec-row">
        <div className="spec-cell spec-id hairline-right">2.04</div>
        <div className="spec-cell spec-title hairline-right">ACTIONABLE DATA</div>
        <div className="spec-cell spec-desc hairline-right">Exports complete structural breakdowns via CLI tables and JSON arrays for immediate integration.</div>
        <div className="spec-cell spec-icon"><FileJson size={24} strokeWidth={1} /></div>
      </div>
    </section>
  );
}
