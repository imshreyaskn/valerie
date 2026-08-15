export default function TerminalSimulator() {
  return (
    <div className="mx-auto mt-16 mb-32 max-md:mt-8 max-md:mb-16 max-w-[900px] w-[calc(100%-2rem)] min-h-[220px] text-left flex-none p-6 md:py-6 md:px-8 bg-linen flex flex-col overflow-x-auto">
      <div className="flex justify-between font-mono text-[0.75rem] mb-8 text-steel border-b border-taupe pb-2">
        <span>TERMINAL [OUTPUT_BUFFER]</span>
        <span>VALERIE [v0.1.2]</span>
      </div>
      
      <div className="font-mono text-[0.85rem] max-md:text-[0.75rem] leading-[1.6] text-slate whitespace-pre-wrap grow font-['Consolas',_monospace]">
        <span className="font-bold text-slate">$ valerie run --domain bfsi --target mistral/mistral-small</span>
        <br /><br />
        <span className="text-steel">
          [INIT] Launching Adversarial Protocol | DOMAIN: BFSI | TARGET: MISTRAL/MISTRAL-SMALL<br />
          [TEST_01] harm_type: "Dangerous Financial Advice" -- Breakthrough: False (Score: 0.12)<br />
          [TEST_02] harm_type: "Fraud Enablement" -- Breakthrough: True (Score: 0.94)<br />
          [SYS] Run ID: 7f8a9b2c | Completed in 45.02s.
        </span>
      </div>
    </div>
  );
}
