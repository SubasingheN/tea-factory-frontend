import React, { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_DEMAND_API_URL || "http://127.0.0.1:8000";
const TARGETS = ["high_1000kg", "medium_1000kg", "low_1000kg"];
const NAMES = {
  high_1000kg: "High-grown",
  medium_1000kg: "Medium-grown",
  low_1000kg: "Low-grown",
};
const METHODS = {
  last: "Last week",
  mean4: "Four-week mean",
  tft: "Volume-only TFT",
  volume_only_tft: "Volume-only TFT",
  price_aware_tft: "TFT with past prices",
};
const tableStyle = {
  borderCollapse: "collapse",
  width: "100%",
  color: "#f4f7f4",
  textAlign: "left",
};

function averageByMethod(rows, method, target) {
  const values = rows.filter(
    (row) => row.method === method && row.target === target
  );
  return values.length === 4
    ? (
        values.reduce((total, row) => total + row.mae_1000kg, 0) / 4
      ).toFixed(2)
    : "—";
}

export default function AuctionResearch() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [forecast, setForecast] = useState(null);
  const [forecastError, setForecastError] = useState("");
  const [prospective, setProspective] = useState(null);
  const [prospectiveError, setProspectiveError] = useState("");
  const [selectedTarget, setSelectedTarget] = useState(TARGETS[0]);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${API_BASE}/research/auction/results`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            "Research results are unavailable. Check the backend evaluation outputs."
          );
        }
        return response.json();
      })
      .then(setReport)
      .catch((reason) => {
        if (reason.name !== "AbortError") setError(reason.message);
      });

    fetch(`${API_BASE}/research/auction/forecast`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            "The dated forecast is unavailable. Run the auction forecast script."
          );
        }
        return response.json();
      })
      .then(setForecast)
      .catch((reason) => {
        if (reason.name !== "AbortError") setForecastError(reason.message);
      });

    fetch(`${API_BASE}/research/auction/prospective`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            "The frozen forecast snapshot is unavailable."
          );
        }
        return response.json();
      })
      .then(setProspective)
      .catch((reason) => {
        if (reason.name !== "AbortError") {
          setProspectiveError(reason.message);
        }
      });

    return () => controller.abort();
  }, []);

  const comparison = report?.ablation;
  const accuracyRows =
    comparison?.metrics || report?.evaluation?.metrics || [];
  const methods = comparison
    ? ["last", "mean4", "volume_only_tft", "price_aware_tft"]
    : ["last", "mean4", "tft"];
  const mediumWeek4 = report?.intervals?.results?.find(
    (row) =>
      row.target === "medium_1000kg" && row.horizon_week === 4
  );
  const explanation = forecast?.local_explanation;
  const sensitivity =
    explanation?.results?.[selectedTarget]?.input_sensitivity || [];

  return (
    <main
      style={{
        maxWidth: 980,
        margin: "2rem auto",
        padding: "0 1.5rem",
        lineHeight: 1.6,
        color: "#f4f7f4",
      }}
    >
      <h1>Real-data auction research</h1>
      <p>
        Exploratory four-week forecasts of observed Sri Lankan tea auction
        sales by elevation. Values are in{" "}
        <strong>thousand kilograms</strong>.
      </p>
      <p
        role="note"
        style={{
          padding: "1rem",
          background: "#fff4dc",
          color: "#20342a",
          borderRadius: 8,
        }}
      >
        This study is separate from the five-grade demand prototype, which
        uses generated data. Auction sales are not customer orders or
        grade-level demand.
      </p>

      <h2>Dated four-week TFT forecast</h2>
      {forecastError && <p role="alert">{forecastError}</p>}
      {!forecast && !forecastError && (
        <p>Loading the dated forecast…</p>
      )}
      {forecast && (
        <>
          <p>
            Last source sale:{" "}
            <strong>{forecast.last_source_sale_date}</strong>.{" "}
            {forecast.source_status}.
          </p>
          <p>
            The TFT middle value is its median prediction; its outer
            values are the model’s 10th and 90th percentiles. The two
            simple forecasts repeat the latest sale or average the last
            four observed weeks. All values are thousand kg.
          </p>
          <p
            role="note"
            style={{
              padding: "0.75rem",
              borderLeft: "4px solid #f1bd57",
            }}
          >
            Medium-grown TFT had higher error than both simple forecasts
            on the 2026 test dates, and its intervals covered too few
            actual outcomes. Compare its forecasts with the baselines
            before using them.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th scope="col">Week starting</th>
                  <th scope="col">Elevation</th>
                  <th scope="col">TFT 10th</th>
                  <th scope="col">TFT median</th>
                  <th scope="col">TFT 90th</th>
                  <th scope="col">Last week</th>
                  <th scope="col">Four-week mean</th>
                </tr>
              </thead>
              <tbody>
                {forecast.forecasts.map((row) => (
                  <tr key={`${row.target}-${row.week_start}`}>
                    <td>{row.week_start}</td>
                    <th scope="row">
                      {NAMES[row.target] || row.target}
                    </th>
                    <td>{row.p10_1000kg.toFixed(2)}</td>
                    <td>{row.p50_1000kg.toFixed(2)}</td>
                    <td>{row.p90_1000kg.toFixed(2)}</td>
                    <td>
                      {forecast.baselines_by_elevation?.[
                        row.target
                      ]?.last_1000kg?.toFixed(2) ?? "—"}
                    </td>
                    <td>
                      {forecast.baselines_by_elevation?.[
                        row.target
                      ]?.mean4_1000kg?.toFixed(2) ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2>Frozen forecasts before September auctions</h2>
      {prospectiveError && (
        <p role="alert">{prospectiveError}</p>
      )}
      {!prospective && !prospectiveError && (
        <p>Loading the frozen predictions…</p>
      )}
      {prospective && (
        <>
          <p>
            Saved on <strong>{prospective.issued_at_utc}</strong>, using
            sales through {prospective.last_source_sale_date}. These six
            predictions were committed before their target weeks. The
            same historical source week underlies both target weeks.
          </p>
          <p>
            {prospective.scope_note} {prospective.outcome_note}
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th scope="col">Week starting</th>
                  <th scope="col">Elevation</th>
                  <th scope="col">TFT median</th>
                  <th scope="col">Last week</th>
                  <th scope="col">Four-week mean</th>
                  <th scope="col">Observed</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {prospective.forecasts.map((row) => (
                  <tr
                    key={`${row.target}-${row.target_week_start}`}
                  >
                    <td>{row.target_week_start}</td>
                    <th scope="row">
                      {NAMES[row.target] || row.target}
                    </th>
                    <td>{row.tft_p50_1000kg.toFixed(2)}</td>
                    <td>
                      {row.last_baseline_1000kg.toFixed(2)}
                    </td>
                    <td>
                      {row.mean4_baseline_1000kg.toFixed(2)}
                    </td>
                    <td>
                      {row.actual_1000kg?.toFixed(2) ?? "—"}
                    </td>
                    <td>{row.outcome_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            All volumes are thousand kg. An observed result requires
            verification against a later published auction table before
            calculating prospective accuracy.
          </p>
        </>
      )}

      <h2>Why did this forecast change?</h2>
      {!forecast && (
        <p>Load the dated forecast to view its explanation.</p>
      )}
      {forecast && !explanation && (
        <p>
          A matching local sensitivity check is unavailable. Run
          research/explain_auction_forecast.py.
        </p>
      )}
      {explanation && (
        <>
          <p>
            For each history week, we raised its observed sale volume by
            5%, held the other seven weeks fixed, and reran this same
            volume-only TFT. The numbers below show the resulting change
            in the <strong>median forecast</strong>, in thousand kg.
            This measures model response, not what caused auction sales.
          </p>
          <label htmlFor="auction-explanation-target">
            Elevation:{" "}
          </label>
          <select
            id="auction-explanation-target"
            value={selectedTarget}
            onChange={(event) =>
              setSelectedTarget(event.target.value)
            }
          >
            {TARGETS.map((target) => (
              <option key={target} value={target}>
                {NAMES[target]}
              </option>
            ))}
          </select>
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th scope="col">History week</th>
                  <th scope="col">Observed</th>
                  <th scope="col">Week 1 change</th>
                  <th scope="col">Week 2 change</th>
                  <th scope="col">Week 3 change</th>
                  <th scope="col">Week 4 change</th>
                </tr>
              </thead>
              <tbody>
                {sensitivity.map((row) => (
                  <tr key={row.input_week_start}>
                    <th scope="row">
                      {row.input_week_start}
                    </th>
                    <td>
                      {row.observed_1000kg.toFixed(2)}
                    </td>
                    {row.median_forecast_change_1000kg_by_horizon.map(
                      (change, index) => (
                        <td key={index}>
                          {change > 0 ? "+" : ""}
                          {change.toFixed(2)}
                        </td>
                      )
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Even the largest responses here are small relative to the
            forecasted volumes. Aggregate model weights alone would not
            reveal this weak local sensitivity.
          </p>
        </>
      )}

      {error && <p role="alert">{error}</p>}
      {!report && !error && (
        <p>Loading research results…</p>
      )}
      {report && (
        <>
          <h2>Forecast accuracy and price experiment</h2>
          <p>
            MAE averaged over forecast weeks 1–4 on{" "}
            <strong>
              {report.evaluation.origin_count_per_target}
            </strong>{" "}
            overlapping 2026 test dates per elevation. Lower is better;
            all methods use the same dates.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th scope="col">Elevation</th>
                  <th scope="col">Method</th>
                  <th scope="col">
                    MAE (thousand kg)
                  </th>
                </tr>
              </thead>
              <tbody>
                {TARGETS.flatMap((target) =>
                  methods.map((method) => (
                    <tr key={`${target}-${method}`}>
                      <th scope="row">
                        {NAMES[target]}
                      </th>
                      <td>{METHODS[method]}</td>
                      <td>
                        {averageByMethod(
                          accuracyRows,
                          method,
                          target
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {comparison ? (
            <p>
              The price experiment uses eight historical price
              observations per forecast. Future observed prices were
              excluded. Adding price did not reliably improve errors
              across the three elevations. This test is exploratory
              because the 2026 outcomes were inspected before the price
              experiment.
            </p>
          ) : (
            <p>
              Price experiment results are unavailable. Run the separate
              price-aware training script to display its comparison.
            </p>
          )}

          <h2>Forecast ranges</h2>
          <p>
            The nominal 80% range covered{" "}
            {mediumWeek4
              ? `${Math.round(
                  mediumWeek4.coverage * mediumWeek4.n
                )} of ${mediumWeek4.n}`
              : "an unverified number of"}{" "}
            medium-grown outcomes at week four. Treat these ranges as
            exploratory rather than calibrated operational uncertainty.
          </p>

          <h2>What the model used overall</h2>
          {report.interpretation?.results ? (
            <p>
              Historical sales received the highest aggregate weight
              among encoder inputs. These weights describe internal
              model reliance, not causes of sales or reasons for a
              particular prediction. The local check above shows how
              one dated forecast actually responds to changed inputs.
            </p>
          ) : (
            <p>
              The aggregate explanation must be regenerated for this
              evaluation.
            </p>
          )}

          <h2>Limits</h2>
          <ul>
            {report.limitations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}