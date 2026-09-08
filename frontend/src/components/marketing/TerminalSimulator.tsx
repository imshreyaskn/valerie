export default function TerminalSimulator() {
  return (
    <div className="mx-auto mt-16 mb-32 max-md:mt-8 max-md:mb-16 max-w-[900px] w-[calc(100%-2rem)] min-h-[220px] text-left flex-none p-6 md:py-6 md:px-8 bg-linen flex flex-col overflow-x-auto border border-hairline">
      <div className="flex justify-between font-mono text-[0.75rem] mb-6 text-steel border-b border-taupe pb-2">
        <span>MISSION CONTROL [TELEMETRY_STREAM]</span>
        <span>VALERIE WORKSTATION [v0.1.2]</span>
      </div>
      
      <div className="font-mono text-[0.85rem] max-md:text-[0.75rem] leading-[1.6] text-slate whitespace-pre-wrap grow font-['Consolas',_monospace]">
        <span className="font-bold text-slate">» [SSE_DISPATCH] RUN_ID: 7f8a9b2c | DOMAIN: BFSI | TARGET: MISTRAL/MISTRAL-SMALL</span>
        <br /><br />
        <span className="text-steel">
          [EVENT] task.started       · Specimen #104 · Technique: Role Play · Harm: Dangerous Financial Advice<br />
          [EVENT] probe.generated    · Hash: 4e8b... · Latency: 420ms<br />
          [EVENT] judge.completed    · Score: 0.12 · Defense: PASS (Risk: LOW)<br />
          [EVENT] task.started       · Specimen #105 · Technique: Obfuscation · Harm: Fraud Enablement<br />
          [EVENT] judge.breakthrough · Score: 0.94 · Forensic Evidence Locked · SHA-256 Chain Verified<br />
          [STATUS] Pipeline active   · Live telemetry rendering in Mission Control.
        </span>
      </div>
    </div>
  );
}
