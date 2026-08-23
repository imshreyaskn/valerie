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
        <pre className="font-mono text-[0.85rem] max-md:text-[0.6rem] font-bold leading-[1.2] text-slate whitespace-pre" aria-hidden="true">{ARCHITECTURE_ASCII_ART}</pre>
      </figure>

      <div className="py-8 px-12 max-md:py-8 max-md:px-4 text-[0.85rem] text-steel leading-[1.6] max-w-[1100px] mx-auto text-left">
        <ul className="list-none p-0 m-0 flex flex-col gap-4">
          <li className="flex items-start">
            <span className="text-slate w-10 shrink-0 text-[0.7rem] mt-[0.2rem]">1.01</span>
            <div><strong className="text-slate">CLI INITIATION:</strong> The user triggers the pipeline via CLI, securely injecting domain constraints and local API keys.</div>
          </li>
          <li className="flex items-start">
            <span className="text-slate w-10 shrink-0 text-[0.7rem] mt-[0.2rem]">1.02</span>
            <div><strong className="text-slate">ASYNC QUEUEING:</strong> The FastAPI Server authenticates credentials against PostgreSQL and dispatches a fire-and-forget task to the isolated Worker.</div>
          </li>
          <li className="flex items-start">
            <span className="text-slate w-10 shrink-0 text-[0.7rem] mt-[0.2rem]">1.03</span>
            <div><strong className="text-slate">LANGGRAPH FAN-OUT:</strong> The Worker loads baseline datasets and dynamically spawns N parallel threads for high-concurrency adversarial generation.</div>
          </li>
          <li className="flex items-start">
            <span className="text-slate w-10 shrink-0 text-[0.7rem] mt-[0.2rem]">1.04</span>
            <div><strong className="text-slate">ADAPTIVE FEEDBACK:</strong> Failed attacks recursively re-calibrate prompt strategies up to a max iteration threshold until a safety breakthrough is forced.</div>
          </li>
          <li className="flex items-start">
            <span className="text-slate w-10 shrink-0 text-[0.7rem] mt-[0.2rem]">1.05</span>
            <div><strong className="text-slate">LLM ROUTING:</strong> All Attacker, Target, and Judge requests are piped through LiteLLM, abstracting vendor complexities and enforcing exponential backoff.</div>
          </li>
          <li className="flex items-start">
            <span className="text-slate w-10 shrink-0 text-[0.7rem] mt-[0.2rem]">1.06</span>
            <div><strong className="text-slate">FAN-IN AGGREGATION:</strong> Thread results are reduced into a unified vulnerability matrix, serialized to PostgreSQL, and pushed back to the CLI as actionable intelligence.</div>
          </li>
        </ul>
      </div>
    </section>
  );
}
