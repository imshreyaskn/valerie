import Link from "next/link";

// Mock data until API is wired in next phase
const MOCK_RUNS = [
  { id: "run-123", status: "completed", domain: "bfsi", target_model: "gpt-4o", successful_attacks: 42, total_tasks: 150, avg_risk_score: 0.82, created_at: "2026-06-03T10:00:00Z" },
  { id: "run-124", status: "running", domain: "healthcare", target_model: "claude-3-5-sonnet", successful_attacks: 12, total_tasks: 100, avg_risk_score: 0.45, created_at: "2026-06-03T11:30:00Z" }
];

export default function Home() {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1>Pipeline Runs</h1>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Status</th>
              <th>Domain</th>
              <th>Target Model</th>
              <th>Progress</th>
              <th>Avg Risk</th>
              <th>Started</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_RUNS.map(run => (
              <tr key={run.id}>
                <td style={{ fontFamily: "monospace", color: "#94a3b8" }}>{run.id.split('-')[1]}</td>
                <td>
                  <span className={`badge badge-${run.status === 'completed' ? 'success' : 'warning'}`}>
                    {run.status.toUpperCase()}
                  </span>
                </td>
                <td style={{ textTransform: "capitalize" }}>{run.domain}</td>
                <td>{run.target_model}</td>
                <td>{run.successful_attacks} / {run.total_tasks}</td>
                <td>{(run.avg_risk_score * 100).toFixed(1)}%</td>
                <td style={{ color: "#94a3b8" }}>{new Date(run.created_at).toLocaleString()}</td>
                <td>
                  <Link href={`/runs/${run.id}`} style={{ fontWeight: 500 }}>View</Link>
                </td>
              </tr>
            ))}
            {MOCK_RUNS.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>
                  No runs found. Launch a new run to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
