"use client";

export default function RunDetail({ params }: { params: { id: string } }) {
  // Mock data
  const run = {
    id: params.id,
    status: "running",
    domain: "bfsi",
    target_model: "gpt-4o",
    total_tasks: 150,
    successful_attacks: 42,
    avg_risk_score: 0.82
  };

  const mockResults = [
    { task_id: "t1", harm_type: "Financial Crime", technique: "Role Play", score: 0.95, breakthrough: true },
    { task_id: "t2", harm_type: "Data Privacy", technique: "Obfuscation", score: 0.45, breakthrough: false },
    { task_id: "t3", harm_type: "Market Manipulation", technique: "Indirect Prompting", score: 0.88, breakthrough: true }
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
            <h1 style={{ margin: 0 }}>Run: {run.id.split('-')[1] || run.id}</h1>
            <span className={`badge badge-${run.status === 'completed' ? 'success' : 'warning'}`}>
              {run.status.toUpperCase()}
            </span>
          </div>
          <p style={{ color: "#94a3b8", margin: 0 }}>Domain: <span style={{ textTransform: "capitalize", color: "white" }}>{run.domain}</span> | Target: <span style={{ color: "white" }}>{run.target_model}</span></p>
        </div>
        <button className="btn btn-secondary">Export CSV</button>
      </div>

      <div className="grid grid-cols-3" style={{ marginBottom: "2rem" }}>
        <div className="card">
          <div className="stat-label">Progress</div>
          <div className="stat-value">{run.successful_attacks} <span style={{ fontSize: "1rem", color: "#94a3b8" }}>/ {run.total_tasks}</span></div>
          <div style={{ background: "var(--border-color)", height: "4px", borderRadius: "2px", overflow: "hidden", marginTop: "1rem" }}>
            <div style={{ width: `${(run.successful_attacks / run.total_tasks) * 100}%`, height: "100%", background: "var(--primary-color)" }}></div>
          </div>
        </div>
        <div className="card">
          <div className="stat-label">Average Risk Score</div>
          <div className="stat-value" style={{ color: run.avg_risk_score > 0.7 ? "var(--danger)" : "white" }}>
            {(run.avg_risk_score * 100).toFixed(1)}%
          </div>
        </div>
        <div className="card">
          <div className="stat-label">Breakthrough Rate</div>
          <div className="stat-value">
            {((run.successful_attacks / Math.max(1, run.total_tasks)) * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      <h2>Evaluation Results</h2>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Harm Type</th>
              <th>Technique</th>
              <th>Risk Score</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {mockResults.map(res => (
              <tr key={res.task_id}>
                <td>{res.harm_type}</td>
                <td>{res.technique}</td>
                <td>
                  <span style={{ color: res.score > 0.7 ? "var(--danger)" : "var(--success)", fontWeight: 600 }}>
                    {(res.score * 100).toFixed(0)}%
                  </span>
                </td>
                <td>
                  {res.breakthrough ? (
                    <span className="badge badge-danger">Vulnerable</span>
                  ) : (
                    <span className="badge badge-success">Safe</span>
                  )}
                </td>
                <td>
                  <a href="#" style={{ fontWeight: 500 }}>Details</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
