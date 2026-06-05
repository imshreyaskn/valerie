import { ARCHITECTURE_ASCII_ART } from '../constants/ascii';
import './Architecture.css';

export default function Architecture() {
  return (
    <section className="architecture-section">
      <div className="architecture-header hairline-bottom">
        ARCHITECTURE
      </div>
      <div className="arch-canvas">
        <pre className="arch-ascii">{ARCHITECTURE_ASCII_ART}</pre>
      </div>
      <div className="arch-details">
        <ul className="arch-list">
          <li className="arch-list-item">
            <span className="arch-item-num">1.01</span>
            <div><strong className="arch-item-strong">CLI INITIATION:</strong> The user triggers the pipeline via CLI, securely injecting domain constraints and local API keys.</div>
          </li>
          <li className="arch-list-item">
            <span className="arch-item-num">1.02</span>
            <div><strong className="arch-item-strong">ASYNC QUEUEING:</strong> The FastAPI Server authenticates credentials against PostgreSQL and dispatches a fire-and-forget task to the isolated Worker.</div>
          </li>
          <li className="arch-list-item">
            <span className="arch-item-num">1.03</span>
            <div><strong className="arch-item-strong">LANGGRAPH FAN-OUT:</strong> The Worker loads baseline datasets and dynamically spawns N parallel threads for high-concurrency adversarial generation.</div>
          </li>
          <li className="arch-list-item">
            <span className="arch-item-num">1.04</span>
            <div><strong className="arch-item-strong">ADAPTIVE FEEDBACK:</strong> Failed attacks recursively re-calibrate prompt strategies up to a max iteration threshold until a safety breakthrough is forced.</div>
          </li>
          <li className="arch-list-item">
            <span className="arch-item-num">1.05</span>
            <div><strong className="arch-item-strong">LLM ROUTING:</strong> All Attacker, Target, and Judge requests are piped through LiteLLM, abstracting vendor complexities and enforcing exponential backoff.</div>
          </li>
          <li className="arch-list-item">
            <span className="arch-item-num">1.06</span>
            <div><strong className="arch-item-strong">FAN-IN AGGREGATION:</strong> Thread results are reduced into a unified vulnerability matrix, serialized to PostgreSQL, and pushed back to the CLI as actionable intelligence.</div>
          </li>
        </ul>
      </div>
    </section>
  );
}
