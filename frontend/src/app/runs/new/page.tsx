"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewRun() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [endpointValid, setEndpointValid] = useState<boolean | null>(null);

  const handleValidate = async () => {
    setValidating(true);
    // Simulate validation
    setTimeout(() => {
      setValidating(false);
      setEndpointValid(true);
    }, 1000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      router.push("/runs/run-999");
    }, 1500);
  };

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto" }}>
      <h1>Launch New Run</h1>
      
      <div className="card" style={{ marginTop: "2rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem" }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ 
              flex: 1, 
              height: "4px", 
              background: step >= i ? "var(--primary-color)" : "var(--border-color)",
              borderRadius: "2px"
            }} />
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {step === 1 && (
            <div>
              <h2>Target Configuration</h2>
              <div className="form-group">
                <label>Target Model</label>
                <select defaultValue="mistral/mistral-small-latest">
                  <option value="mistral/mistral-small-latest">Mistral Small Latest</option>
                  <option value="bedrock/anthropic.claude-3-5-sonnet-20241022-v2:0">Bedrock Claude 3.5 Sonnet</option>
                  <option value="gpt-4o">OpenAI GPT-4o</option>
                  <option value="custom">Custom Endpoint</option>
                </select>
              </div>
              <div className="form-group">
                <label>API Key (Optional if managed)</label>
                <input type="password" placeholder="sk-..." />
              </div>
              <div className="form-group">
                <button type="button" className="btn btn-secondary" onClick={handleValidate} disabled={validating}>
                  {validating ? "Checking..." : "Verify Endpoint Access"}
                </button>
                {endpointValid && <span style={{ color: "var(--success)", marginLeft: "1rem" }}>✓ Connection successful</span>}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2>Domain & Scope</h2>
              <div className="form-group">
                <label>Industry Domain</label>
                <select defaultValue="bfsi">
                  <option value="general">General</option>
                  <option value="bfsi">BFSI (Finance)</option>
                  <option value="healthcare">Healthcare</option>
                  <option value="legal">Legal</option>
                  <option value="hr">Human Resources</option>
                  <option value="ecommerce">E-Commerce</option>
                </select>
              </div>
              <div className="form-group">
                <label>Max Iterations per Prompt</label>
                <input type="number" defaultValue={3} min={1} max={5} />
              </div>
              <div className="form-group">
                <label>Risk Threshold</label>
                <input type="number" step="0.1" defaultValue={0.7} min={0} max={1} />
                <small style={{ color: "#94a3b8", display: "block", marginTop: "0.25rem" }}>Stop iterating when risk exceeds this score (0.0 to 1.0)</small>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2>Review & Launch</h2>
              <div style={{ background: "rgba(0,0,0,0.2)", padding: "1rem", borderRadius: "0.375rem", marginBottom: "1.5rem" }}>
                <p><strong>Target:</strong> mistral/mistral-small-latest</p>
                <p><strong>Domain:</strong> BFSI</p>
                <p><strong>Estimated Tasks:</strong> 150</p>
                <p><strong>Concurrency:</strong> 10 workers</p>
              </div>
              <p style={{ color: "var(--warning)", marginBottom: "1.5rem", fontSize: "0.875rem" }}>
                ⚠️ This run will consume approximately 450 target LLM API calls and 900 evaluation LLM API calls.
              </p>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2rem", borderTop: "1px solid var(--border-color)", paddingTop: "1.5rem" }}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => setStep(s => s - 1)}
              style={{ visibility: step > 1 ? "visible" : "hidden" }}
            >
              Back
            </button>
            
            {step < 3 ? (
              <button 
                type="button" 
                className="btn" 
                onClick={() => setStep(s => s + 1)}
                disabled={step === 1 && endpointValid === false}
              >
                Next Step
              </button>
            ) : (
              <button type="submit" className="btn" disabled={loading}>
                {loading ? "Initializing..." : "Launch Pipeline"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
