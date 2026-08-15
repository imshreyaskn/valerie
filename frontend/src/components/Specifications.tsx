import { Shield, Key, Workflow, FileJson } from 'lucide-react';

export default function Specifications() {
  return (
    <section className="flex flex-col my-8 w-full hairline-bottom">
      <div className="p-4 text-[2rem] font-medium tracking-[-0.02em] uppercase hairline-bottom">
        SPECIFICATIONS
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-[80px_200px_1fr_120px] items-center p-0 hairline-bottom max-md:border-b-0 max-md:last:border-b max-md:[&>div]:border-b max-md:[&>div:last-child]:border-b-0">
        <div className="p-3 md:p-6 text-sm font-mono text-steel md:hairline-right">2.01</div>
        <div className="p-3 md:p-6 text-sm font-semibold uppercase tracking-[0.02em] md:hairline-right">BRING YOUR OWN KEY</div>
        <div className="p-3 md:p-6 text-[0.8rem] text-steel md:hairline-right">Centralized or local architecture. Utilize proprietary OpenAI, Anthropic, or Mistral keys securely.</div>
        <div className="p-4 md:py-6 md:px-4 flex justify-start md:justify-center text-slate max-md:w-full"><Key size={24} strokeWidth={1} /></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[80px_200px_1fr_120px] items-center p-0 hairline-bottom max-md:border-b-0 max-md:last:border-b max-md:[&>div]:border-b max-md:[&>div:last-child]:border-b-0">
        <div className="p-3 md:p-6 text-sm font-mono text-steel md:hairline-right">2.02</div>
        <div className="p-3 md:p-6 text-sm font-semibold uppercase tracking-[0.02em] md:hairline-right">DOMAIN PROBES</div>
        <div className="p-3 md:p-6 text-[0.8rem] text-steel md:hairline-right">Prebuilt attack vectors targeting Banking, Healthcare, Legal, and HR compliance standards.</div>
        <div className="p-4 md:py-6 md:px-4 flex justify-start md:justify-center text-slate max-md:w-full"><Shield size={24} strokeWidth={1} /></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[80px_200px_1fr_120px] items-center p-0 hairline-bottom max-md:border-b-0 max-md:last:border-b max-md:[&>div]:border-b max-md:[&>div:last-child]:border-b-0">
        <div className="p-3 md:p-6 text-sm font-mono text-steel md:hairline-right">2.03</div>
        <div className="p-3 md:p-6 text-sm font-semibold uppercase tracking-[0.02em] md:hairline-right">AUTOMATED PIPELINE</div>
        <div className="p-3 md:p-6 text-[0.8rem] text-steel md:hairline-right">Dual LLM configuration. Attacker model generates dynamic probes while an independent judge model evaluates risk.</div>
        <div className="p-4 md:py-6 md:px-4 flex justify-start md:justify-center text-slate max-md:w-full"><Workflow size={24} strokeWidth={1} /></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[80px_200px_1fr_120px] items-center p-0 max-md:border-b max-md:[&>div]:border-b max-md:[&>div:last-child]:border-b-0">
        <div className="p-3 md:p-6 text-sm font-mono text-steel md:hairline-right">2.04</div>
        <div className="p-3 md:p-6 text-sm font-semibold uppercase tracking-[0.02em] md:hairline-right">ACTIONABLE DATA</div>
        <div className="p-3 md:p-6 text-[0.8rem] text-steel md:hairline-right">Exports complete structural breakdowns via CLI tables and JSON arrays for immediate integration.</div>
        <div className="p-4 md:py-6 md:px-4 flex justify-start md:justify-center text-slate max-md:w-full"><FileJson size={24} strokeWidth={1} /></div>
      </div>
    </section>
  );
}
