
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  RefreshCw,
  TrendingUp,
  Info,
} from "lucide-react";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

import {
  getResearchTFTForecast,
  TEA_GRADES,
} from "../../services/researchForecastService";

const GRADE_COLORS = {
  BOP: "#2563eb",
  BOPF: "#16a34a",
  Dust: "#dc2626",
  OP: "#9333ea",
  Pekoe: "#ea580c",
};

const panelStyle = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  padding: "22px",
  marginBottom: "20px",
};

const numberStyle = {
  fontSize: "26px",
  fontWeight: 700,
  color: "#17324d",
  margin: "8px 0 0",
};

function formatKg(value) {
  if (!Number.isFinite(Number(value))) {
    return "-";
  }

  return (
    Number(value).toLocaleString("en-US", {
      maximumFractionDigits: 0,
    }) + " kg"
  );
}

function formatNumber(value) {
  return Number(value).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const parts = String(value).split("-");

  if (parts.length !== 3) {
    return String(value);
  }

  const [year, month, day] = parts.map(Number);

  const date = new Date(
    year,
    month - 1,
    day
  );

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getChartData(data) {
  if (!data?.forecasts) {
    return [];
  }

  return Array.from(
    { length: 4 },
    (_, index) => {
      const firstWeek =
        data.forecasts.BOP[index];

      const row = {
        name: `Week ${index + 1}`,
        date: firstWeek.week,
      };

      for (const grade of TEA_GRADES) {
        row[grade] = Number(
          data.forecasts[grade][index]
            .median_demand_kg
        );
      }

      return row;
    }
  );
}

function getWeeklyTotals(data) {
  if (!data?.forecasts) {
    return [];
  }

  return Array.from(
    { length: 4 },
    (_, index) => {
      const values = TEA_GRADES.map(
        (grade) =>
          Number(
            data.forecasts[grade][index]
              .median_demand_kg
          )
      );

      return {
        horizon: index + 1,
        week: data.forecasts.BOP[index].week,
        medianTotal: values.reduce(
          (sum, value) => sum + value,
          0
        ),
      };
    }
  );
}

export default function ResearchTFTForecast() {
  const [data, setData] = useState(null);
  const [selectedGrade, setSelectedGrade] =
    useState("BOP");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] = useState("");

  const loadForecast = useCallback(
    async (signal, isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const result =
          await getResearchTFTForecast(signal);

        if (!signal?.aborted) {
          setData(result);
        }
      } catch (caughtError) {
        if (
          caughtError.name === "AbortError" ||
          signal?.aborted
        ) {
          return;
        }

        setError(
          caughtError.message ||
            "Unable to load research forecasts."
        );
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();

    loadForecast(controller.signal);

    return () => controller.abort();
  }, [loadForecast]);

  const chartData = useMemo(
    () => getChartData(data),
    [data]
  );

  const weeklyTotals = useMemo(
    () => getWeeklyTotals(data),
    [data]
  );

  const selectedWeeks =
    data?.forecasts?.[selectedGrade] ?? [];

  const fourWeekTotal = selectedWeeks.reduce(
    (sum, week) =>
      sum + Number(week.median_demand_kg),
    0
  );

  const firstWeek = selectedWeeks[0];
  const lastWeek = selectedWeeks[3];

  const changePercent =
    firstWeek && lastWeek &&
    Number(firstWeek.median_demand_kg) > 0
      ? (
          (
            Number(lastWeek.median_demand_kg) -
            Number(firstWeek.median_demand_kg)
          ) /
          Number(firstWeek.median_demand_kg)
        ) * 100
      : null;

  const refreshForecast = () => {
    loadForecast(undefined, true);
  };

  if (loading) {
    return (
      <div className="demand-page">
        <div className="demand-panel">
          <h2>Loading Research TFT Forecast...</h2>
          <p>
            Retrieving the saved four-week forecasts
            from your research API.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="demand-page">
      <div className="demand-page-header-row">
        <div className="demand-page-header">
          <span className="demand-page-label">
            Research TFT Model
          </span>

          <h1>Four-Week Tea Demand Forecast</h1>

          <p>
            Frozen Temporal Fusion Transformer
            predictions for five tea grades,
            including P10–P90 demand intervals.
          </p>
        </div>

        <button
          type="button"
          className="forecast-refresh-btn"
          onClick={refreshForecast}
          disabled={refreshing}
        >
          <RefreshCw size={17} />
          {refreshing
            ? "Refreshing..."
            : "Reload Saved Forecast"}
        </button>
      </div>

      {error && (
        <div
          className="dashboard-warning-box"
          style={{ marginBottom: "20px" }}
          role="alert"
        >
          <AlertTriangle size={22} />
          <div>
            <h3>
              Unable to load research forecast
            </h3>
            <p>{error}</p>
            <p>
              Check that FastAPI is running on
              port 8000 and the Step 20 endpoint
              is available.
            </p>
          </div>
        </div>
      )}

      {!data && !error && (
        <div className="demand-panel">
          No research forecast is available.
        </div>
      )}

      {data && (
        <>
          <div
            className="demand-success-message"
            style={{ marginBottom: "20px" }}
          >
            <CheckCircle2 size={19} />
            <span>
              Research forecasts loaded from the
              selected no-price TFT model.
            </span>
          </div>

          <div
            style={{
              ...panelStyle,
              background: "#f8fafc",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "12px",
                alignItems: "flex-start",
              }}
            >
              <CalendarDays
                size={21}
                color="#2563eb"
              />

              <div>
                <strong>
                  Forecast origin:{" "}
                  {formatDate(data.forecast_origin)}
                </strong>

                <p
                  style={{
                    margin: "6px 0 0",
                    color: "#64748b",
                  }}
                >
                  These predictions are based on
                  the latest recorded factory data
                  at this origin. Reloading this
                  page does not retrain the model
                  or create a new forecast.
                </p>
              </div>
            </div>
          </div>

          <div className="forecast-type-grid">
            <div className="forecast-type-card">
              <span>Forecast Horizon</span>
              <h3>
                {data.forecast_horizon_weeks} Weeks
              </h3>
            </div>

            <div className="forecast-type-card">
              <span>Tea Grades</span>
              <h3>{data.tea_grade_count}</h3>
            </div>

            <div className="forecast-type-card">
              <span>Total Predictions</span>
              <h3>{data.forecast_count}</h3>
            </div>
          </div>

          <div
            className="demand-panel forecast-chart-panel"
            style={{ marginTop: "20px" }}
          >
            <div className="forecast-chart-header">
              <div>
                <h2>
                  Predicted Weekly Tea Demand
                </h2>
                <p>
                  P50 median demand forecasts
                  for all five tea grades.
                </p>
              </div>
            </div>

            <div className="forecast-chart-container">
              <ResponsiveContainer
                width="100%"
                height={360}
              >
                <LineChart
                  data={chartData}
                  margin={{
                    top: 12,
                    right: 20,
                    left: 10,
                    bottom: 12,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                  />

                  <XAxis dataKey="name" />

                  <YAxis
                    tickFormatter={formatNumber}
                    width={72}
                  />

                  <Tooltip
                    formatter={(value, name) => [
                      formatKg(value),
                      name,
                    ]}
                    labelFormatter={(
                      label,
                      payload
                    ) => {
                      const week =
                        payload?.[0]?.payload?.date;

                      return week
                        ? `${label} — ${formatDate(week)}`
                        : label;
                    }}
                  />

                  <Legend />

                  {TEA_GRADES.map((grade) => (
                    <Line
                      key={grade}
                      type="monotone"
                      dataKey={grade}
                      stroke={GRADE_COLORS[grade]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>
              Weekly Demand Across All Grades
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(170px, 1fr))",
                gap: "12px",
              }}
            >
              {weeklyTotals.map((week) => (
                <div
                  key={week.horizon}
                  style={{
                    padding: "16px",
                    background: "#f8fafc",
                    borderRadius: "10px",
                  }}
                >
                  <span style={{ color: "#64748b" }}>
                    Week {week.horizon}
                  </span>

                  <h3 style={numberStyle}>
                    {formatKg(week.medianTotal)}
                  </h3>

                  <small>
                    {formatDate(week.week)}
                  </small>
                </div>
              ))}
            </div>

            <p
              style={{
                color: "#64748b",
                fontSize: "13px",
                marginBottom: 0,
              }}
            >
              These totals are sums of the
              individual grade median forecasts.
              They are not separately calibrated
              quantiles for total factory demand.
            </p>
          </div>

          <div style={panelStyle}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "15px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <h2 style={{ margin: 0 }}>
                  Forecast by Tea Grade
                </h2>

                <p
                  style={{
                    color: "#64748b",
                  }}
                >
                  Select a grade to inspect
                  its four-week prediction intervals.
                </p>
              </div>

              <select
                aria-label="Select tea grade"
                value={selectedGrade}
                onChange={(event) =>
                  setSelectedGrade(event.target.value)
                }
                style={{
                  padding: "11px 14px",
                  borderRadius: "9px",
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  minWidth: "160px",
                  fontSize: "15px",
                }}
              >
                {TEA_GRADES.map((grade) => (
                  <option
                    key={grade}
                    value={grade}
                  >
                    {grade}
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "14px",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  padding: "17px",
                  background: "#f1f5f9",
                  borderRadius: "10px",
                }}
              >
                <span>Four-week P50 total</span>
                <h3 style={numberStyle}>
                  {formatKg(fourWeekTotal)}
                </h3>
              </div>

              <div
                style={{
                  padding: "17px",
                  background: "#f1f5f9",
                  borderRadius: "10px",
                }}
              >
                <span>
                  Week 1 to Week 4 change
                </span>

                <h3 style={numberStyle}>
                  {changePercent === null
                    ? "-"
                    : `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%`}
                </h3>
              </div>
            </div>

            <div
              style={{
                overflowX: "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left",
                  minWidth: "640px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#f1f5f9",
                    }}
                  >
                    {[
                      "Week",
                      "Forecast Date",
                      "P10 Lower",
                      "P50 Median",
                      "P90 Upper",
                    ].map((heading) => (
                      <th
                        key={heading}
                        style={{
                          padding: "13px",
                          borderBottom:
                            "1px solid #e2e8f0",
                        }}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {selectedWeeks.map((week) => (
                    <tr key={week.horizon}>
                      <td
                        style={{
                          padding: "13px",
                          borderBottom:
                            "1px solid #e2e8f0",
                        }}
                      >
                        Week {week.horizon}
                      </td>

                      <td
                        style={{
                          padding: "13px",
                          borderBottom:
                            "1px solid #e2e8f0",
                        }}
                      >
                        {formatDate(week.week)}
                      </td>

                      <td
                        style={{
                          padding: "13px",
                          borderBottom:
                            "1px solid #e2e8f0",
                        }}
                      >
                        {formatKg(
                          week.lower_demand_kg
                        )}
                      </td>

                      <td
                        style={{
                          padding: "13px",
                          fontWeight: 700,
                          color: "#17324d",
                          borderBottom:
                            "1px solid #e2e8f0",
                        }}
                      >
                        {formatKg(
                          week.median_demand_kg
                        )}
                      </td>

                      <td
                        style={{
                          padding: "13px",
                          borderBottom:
                            "1px solid #e2e8f0",
                        }}
                      >
                        {formatKg(
                          week.upper_demand_kg
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={panelStyle}>
            <div
              style={{
                display: "flex",
                gap: "12px",
                alignItems: "flex-start",
              }}
            >
              <TrendingUp
                size={23}
                color="#2563eb"
              />

              <div>
                <h3 style={{ marginTop: 0 }}>
                  Understanding the Predictions
                </h3>

                <p>
                  The P50 value represents the
                  median predicted demand. P10
                  and P90 define a model-estimated
                  80% prediction interval.
                </p>

                <p>
                  On the held-out test period,
                  this model achieved an MAE of
                  approximately 977.71 kg,
                  WAPE of 7.46%, and overall
                  interval coverage of 79.89%.
                </p>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: "10px",
                alignItems: "flex-start",
                marginTop: "12px",
                color: "#64748b",
              }}
            >
              <Info size={18} />

              <small>
                These results come from the selected
                no-price research model and are
                separate from forecasts generated
                through the operational Weekly Data
                Entry page.
              </small>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
