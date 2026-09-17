import React, { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_DEMAND_API_URL || "http://127.0.0.1:8000";
const NAME = { high_1000kg: "High-grown", medium_1000kg: "Medium-grown", low_1000kg: "Low-grown" };
const METHODS = { last: "Last week", mean4: "Four-week mean", tft: "TFT" };

export default function AuctionResearch() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/research/auction/results`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Research results are unavailable. Run the auction evaluation scripts in the backend.");
        return response.json();
      })
      .then(setReport)
      .catch((reason) => { if (reason.name !== "AbortError") setError(reason.message); });
    return () => controller.abort();
  }, []);

  const rows = report?.evaluation?.metrics || [];
  const averages = Object.keys(NAME).flatMap((target) =>
    Object.keys(METHODS).map((method) => {
      const values = rows.filter((row) => row.target === target && row.method === method);
      return { target, method, mae: values.length === 4
        ? (values.reduce((sum, row) => sum + row.mae_1000kg, 0) / 4).toFixed(2) : "—" };
    })
  );
  const mediumWeek4 = report?.intervals?.results?.find(
    (row) => row.target === "medium_1000kg" && row.horizon_week === 4
  );

  return (
    <main style={{ maxWidth: 980, margin: "2rem auto", padding: "0 1.5rem", lineHeight: 1.6 }}>
      <h1>Real-data auction research</h1>
      <p>Exploratory four-week forecasts of observed Sri Lankan tea auction sales by elevation.
        Values below are in <strong>thousand kilograms</strong>.</p>
      <p role="note" style={{ padding: "1rem", background: "#fff4dc", borderRadius: 8 }}>
        This study is separate from the five-grade demand prototype, which uses generated data.
        Auction sales are not customer orders or grade-level demand.
      </p>
      {error && <p role="alert">{error}</p>}
      {!report && !error && <p>Loading research results…</p>}
      {report && <>
        <h2>Forecast accuracy</h2>
        <p>MAE averaged over forecast weeks 1–4; nine overlapping 2026 test dates per elevation.
          Lower is better. Models were compared on the same dates.</p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead><tr><th scope="col">Elevation</th><th scope="col">Method</th><th scope="col">MAE (thousand kg)</th></tr></thead>
            <tbody>{averages.map((row) => <tr key={`${row.target}-${row.method}`}>
              <th scope="row">{NAME[row.target]}</th><td>{METHODS[row.method]}</td><td>{row.mae}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <p><strong>Read the comparison by elevation:</strong> results can differ across markets and
          forecast weeks; a lower error in one elevation does not prove overall superiority.</p>
        <h2>Forecast ranges</h2>
        <p>The model’s nominal 80% interval covered {mediumWeek4
          ? `${Math.round(mediumWeek4.coverage * mediumWeek4.n)} of ${mediumWeek4.n}` : "an unverified number of"}
          {" "}medium-grown outcomes at week 4. These ranges should not be treated as
          calibrated operational uncertainty.</p>
        <h2>What the model used</h2>
        <p>Historical auction sales had the highest aggregate weight among encoder inputs across the
          three elevations. Model weights do not establish causes or explain an individual prediction.</p>
        <h2>Limits</h2>
        <ul>{report.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
      </>}
    </main>
  );
}
