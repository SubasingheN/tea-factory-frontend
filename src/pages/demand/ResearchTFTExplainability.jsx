
import { useCallback, useEffect, useState } from "react";

import {
  AlertTriangle,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Info,
  RefreshCw,
} from "lucide-react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  getResearchExplainability,
} from "../../services/researchExplainabilityService";

const FEATURE_NAMES = {
  grade: "Tea grade",
  demand_kg_scale: "Demand scaling factor",
  demand_kg_center: "Demand centering factor",
  relative_time_idx: "Relative time index",
  time_idx: "Time index",
  demand_kg: "Historical demand",
  month_sin: "Monthly seasonality (sine)",
  month_cos: "Monthly seasonality (cosine)",
  week_sin: "Weekly seasonality (sine)",
  week_cos: "Weekly seasonality (cosine)",
  year: "Year",
  month: "Month",
  week_of_year: "Week of year",
};

function formatFeature(name) {
  return (
    FEATURE_NAMES[name] ||
    String(name)
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function formatPercentage(value) {
  return `${Number(value).toFixed(2)}%`;
}

function ImportanceSection({
  title,
  description,
  items,
  color,
}) {
  const sorted = [...items].sort(
    (a, b) =>
      b.relative_importance_percent -
      a.relative_importance_percent
  );

  const chartData = sorted.map((item) => ({
    name: formatFeature(item.feature),
    importance: Number(
      item.relative_importance_percent
    ),
  }));

  return (
    <section className="demand-panel">
      <h2>{title}</h2>
      <p>{description}</p>

      <div
        style={{
          width: "100%",
          height: Math.max(
            190,
            chartData.length * 45 + 40
          ),
        }}
      >
        <ResponsiveContainer
          width="100%"
          height="100%"
        >
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{
              top: 10,
              right: 35,
              bottom: 5,
              left: 10,
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={false}
            />

            <XAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />

            <YAxis
              type="category"
              dataKey="name"
              width={180}
              tick={{ fontSize: 12 }}
            />

            <Tooltip
              formatter={(value) => [
                formatPercentage(value),
                "Relative importance",
              ]}
            />

            <Bar
              dataKey="importance"
              fill={color}
              radius={[0, 5, 5, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="importance-list">
        {sorted.map((item) => (
          <div
            className="importance-row"
            key={item.feature}
          >
            <div className="importance-label">
              <span>
                {formatFeature(item.feature)}
              </span>
              <strong>
                {formatPercentage(
                  item.relative_importance_percent
                )}
              </strong>
            </div>

            <div className="importance-track">
              <div
                className="importance-fill"
                style={{
                  width:
                    `${Math.max(
                      0,
                      Math.min(
                        100,
                        item.relative_importance_percent
                      )
                    )}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AttentionSection({ items }) {
  const chartData = [...items]
    .sort(
      (a, b) =>
        a.weeks_before_latest_observation -
        b.weeks_before_latest_observation
    )
    .map((item) => ({
      name:
        `${item.weeks_before_latest_observation} weeks ago`,
      importance: Number(
        item.relative_attention_percent
      ),
    }));

  return (
    <section className="demand-panel">
      <h2>Historical Temporal Attention</h2>

      <p>
        Ten historical positions receiving high
        aggregate model attention across the
        2024 validation windows.
      </p>

      <div
        style={{
          width: "100%",
          height: 330,
        }}
      >
        <ResponsiveContainer
          width="100%"
          height="100%"
        >
          <BarChart
            data={chartData}
            margin={{
              top: 10,
              right: 15,
              bottom: 40,
              left: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />

            <XAxis
              dataKey="name"
              angle={-35}
              textAnchor="end"
              height={75}
              tick={{ fontSize: 11 }}
            />

            <YAxis
              tickFormatter={(value) => `${value}%`}
            />

            <Tooltip
              formatter={(value) => [
                formatPercentage(value),
                "Attention",
              ]}
            />

            <Bar
              dataKey="importance"
              fill="#d97706"
              radius={[5, 5, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p
        style={{
          color: "#64748b",
          fontSize: "13px",
        }}
      >
        Zero weeks ago represents the latest
        historical observation. Larger offsets
        represent older observations. These ten
        positions are a subset of the 52-week
        history; their percentages do not need
        to sum to 100%.
      </p>
    </section>
  );
}

export default function ResearchTFTExplainability() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(
    async (signal, isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const result =
          await getResearchExplainability(signal);

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
          "Could not load research explanations."
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

    loadData(controller.signal);

    return () => controller.abort();
  }, [loadData]);

  if (loading) {
    return (
      <div className="demand-page">
        <div className="demand-panel">
          <h2>Loading Research Explainability...</h2>
          <p>
            Reading saved validation interpretation
            results from the backend.
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
            Research TFT Interpretability
          </span>

          <h1>Research TFT Explainability</h1>

          <p>
            Feature selection and historical
            attention results from the selected
            no-price Temporal Fusion Transformer.
          </p>
        </div>

        <button
          type="button"
          className="forecast-refresh-btn"
          onClick={() => loadData(undefined, true)}
          disabled={refreshing}
        >
          <RefreshCw size={17} />
          {refreshing
            ? "Reloading..."
            : "Reload Saved Explanation"}
        </button>
      </div>

      {error && (
        <div
          className="dashboard-warning-box"
          role="alert"
          style={{ marginBottom: "20px" }}
        >
          <AlertTriangle size={22} />
          <div>
            <h3>Unable to load explanation</h3>
            <p>{error}</p>
            <p>
              Ensure that the FastAPI backend is
              running on port 8000.
            </p>
          </div>
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
              Saved research interpretation
              results loaded successfully.
            </span>
          </div>

          <div className="forecast-type-grid">
            <div className="forecast-type-card">
              <BrainCircuit size={20} />
              <span>Selected Model</span>
              <h3>Without Auction Prices</h3>
            </div>

            <div className="forecast-type-card">
              <CalendarDays size={20} />
              <span>Interpretation Partition</span>
              <h3>2024 Validation</h3>
            </div>

            <div className="forecast-type-card">
              <Clock3 size={20} />
              <span>Historical Input</span>
              <h3>{data.encoder_history_weeks} Weeks</h3>
            </div>

            <div className="forecast-type-card">
              <span>Validation Windows</span>
              <h3>{data.validation_forecast_windows}</h3>
            </div>
          </div>

          <div
            className="demand-panel"
            style={{ marginTop: "20px" }}
          >
            <h2>How to Interpret These Results</h2>

            <p>
              The model uses three types of
              information: static characteristics
              of each tea grade, historical
              variables observed in the encoder,
              and calendar variables known for
              future forecast weeks.
            </p>

            <p>
              Each feature group's importance
              scores are normalized separately.
              A percentage in one group should
              not be directly compared with a
              percentage in another group.
            </p>

            <p>
              <strong>
                These are aggregate explanations
                from the 2024 validation period,
                not explanations calculated
                specifically for the October 2026
                operational forecast.
              </strong>
            </p>
          </div>

          <ImportanceSection
            title="Static Feature Importance"
            description={
              "Information distinguishing tea " +
              "grade series and their demand scales."
            }
            items={data.static_feature_importance}
            color="#0d9488"
          />

          <ImportanceSection
            title="Historical Feature Importance"
            description={
              "Variables selected from the " +
              "52-week historical input window."
            }
            items={data.encoder_feature_importance}
            color="#2563eb"
          />

          <ImportanceSection
            title="Future-Known Feature Importance"
            description={
              "Calendar and time variables " +
              "available for future forecast weeks."
            }
            items={data.decoder_feature_importance}
            color="#9333ea"
          />

          <AttentionSection
            items={
              data.top_historical_attention_positions
            }
          />

          <section className="demand-panel">
            <div
              style={{
                display: "flex",
                gap: "10px",
                alignItems: "center",
              }}
            >
              <Info size={21} />
              <h2 style={{ margin: 0 }}>
                Research Limitations
              </h2>
            </div>

            <ul
              style={{
                marginTop: "14px",
                paddingLeft: "22px",
                lineHeight: 1.8,
              }}
            >
              {data.limitations.map((limitation, index) => (
                <li key={`${index}-${limitation}`}>
                  {limitation}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
