import { ARCHITECTURE_ASCII_ART } from '../../constants/ascii';

export default function Architecture() {
  return (
    <section className="w-full">
      <div className="p-4 text-[2rem] font-medium tracking-[-0.02em] uppercase hairline-bottom">
        ARCHITECTURE
      </div>
      <figure className="flex justify-center md:justify-center max-md:justify-start items-center py-16 px-8 max-md:py-8 max-md:px-4 overflow-x-auto max-w-[100vw]">
        <figcaption className="sr-only">
          System Architecture Diagram: Illustrates the flow from CLI Initiation to FastAPI Async Queueing, LangGraph Fan-out execution, Adaptive Feedback loop, LiteLLM Routing, and Fan-in Aggregation into the database.
        </figcaption>
        <pre className="font-mono text-[0.85rem] max-md:text-[0.6rem] font-normal leading-[1.2] text-slate whitespace-pre" aria-hidden="true">{ARCHITECTURE_ASCII_ART}</pre>
      </figure>

      <div className="py-8 px-12 max-md:py-8 max-md:px-4 text-[0.85rem] text-steel leading-[1.6] max-w-[1100px] mx-auto text-left">
        <ul className="list-none p-0 m-0 flex flex-col gap-4">
          <li className="flex items-start">
            <span className="text-slate w-10 shrink-0 text-[0.7rem] mt-[0.2rem]">1.01</span>
            <div><strong className="text-slate">WORKSTATION DISPATCH:</strong> Operators launch campaigns from Mission Control, configuring regulatory domains, harm vectors, and BYOK credentials.</div>
          </li>
          <li className="flex items-start">
            <span className="text-slate w-10 shrink-0 text-[0.7rem] mt-[0.2rem]">1.02</span>
            <div><strong className="text-slate">EVENT-DRIVEN BUS:</strong> The API server dispatches evaluation tasks onto the Redis Streams event bus with real-time telemetry streaming and async worker execution.</div>
          </li>
          <li className="flex items-start">
            <span className="text-slate w-10 shrink-0 text-[0.7rem] mt-[0.2rem]">1.03</span>
            <div><strong className="text-slate">LANGGRAPH FAN-OUT:</strong> The Worker loads baseline datasets and dynamically spawns parallel execution nodes for high-concurrency adversarial generation.</div>
          </li>
          <li className="flex items-start">
            <span className="text-slate w-10 shrink-0 text-[0.7rem] mt-[0.2rem]">1.04</span>
            <div><strong className="text-slate">ADAPTIVE FEEDBACK:</strong> Multi-turn mutation loops recursively re-calibrate prompt strategies up to the threshold until safety boundaries are accurately mapped.</div>
          </li>
          <li className="flex items-start">
            <span className="text-slate w-10 shrink-0 text-[0.7rem] mt-[0.2rem]">1.05</span>
            <div><strong className="text-slate">LLM ROUTING:</strong> All Attacker, Target, and Judge requests route through LiteLLM with strict exponential backoff, timeout guards, and token protection.</div>
          </li>
          <li className="flex items-start">
            <span className="text-slate w-10 shrink-0 text-[0.7rem] mt-[0.2rem]">1.06</span>
            <div><strong className="text-slate">REAL-TIME INTELLIGENCE:</strong> Telemetry streams live via SSE into Mission Control with DBSCAN clustering, anomaly detection, and tamper-evident SHA-256 evidence.</div>
          </li>
        </ul>
      </div>
    </section>
  );
}
