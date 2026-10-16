
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  FileText,
  History,
  Leaf,
  RefreshCw,
  TrendingUp,
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

import "./DemandHome.css";

const BASE_PATH = "/tea-demand-forecasting";

const GRADE_COLORS = {
  BOP: "#2563eb",
  BOPF: "#16a34a",
  Dust: "#dc2626",
  OP: "#9333ea",
  Pekoe: "#ea580c",
};

const QUICK_ACTIONS = [
  {
    title: "Weekly Data Entry",
    description: "Enter and manage factory observations.",
    icon: Database,
    path: `${BASE_PATH}/weekly-data`,
  },
  {
    title: "Research TFT Forecast",
    description: "Explore four-week predictions and intervals.",
    icon: BarChart3,
    path: `${BASE_PATH}/research-forecast`,
  },
  {
    title: "Research Explainability",
    description: "Explore feature importance and attention.",
    icon: BrainCircuit,
    path: `${BASE_PATH}/research-explainability`,
  },
  {
    title: "Forecast History",
    description: "Review saved operational forecasts.",
    icon: History,
    path: `${BASE_PATH}/history`,
  },
  {
    title: "Reports",
    description: "Access forecast reporting tools.",
    icon: FileText,
    path: `${BASE_PATH}/reports`,
  },
];

function formatKg(value) {
  if (!Number.isFinite(Number(value)) || value === null) {
    return "—";
  }

  return `${Number(value).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })} kg`;
}

function formatCompactKg(value) {
  if (!Number.isFinite(Number(value)) || value === null) {
    return "—";
  }

  const number = Number(value);

  if (Math.abs(number) >= 1000) {
    return `${(number / 1000).toFixed(1)}k kg`;
  }

  return formatKg(number);
}

function formatDate(dateString) {
  if (!dateString) {
    return "Unavailable";
  }

  const [year, month, day] = String(dateString)
    .split("-")
    .map(Number);

  const date = new Date(year, month - 1, day);

  if (Number.isNaN(date.getTime())) {
    return String(dateString);
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function createChartData(data) {
  if (!data?.forecasts?.BOP) {
    return [];
  }

  return Array.from({ length: 4 }, (_, index) => {
    const row = {
      week: `Week ${index + 1}`,
      date: data.forecasts.BOP[index].week,
    };

    for (const grade of TEA_GRADES) {
      row[grade] = Number(
        data.forecasts[grade][index].median_demand_kg
      );
    }

    return row;
  });
}

function createGradeSummaries(data) {
  if (!data?.forecasts) {
    return [];
  }

  return TEA_GRADES.map((grade) => {
    const weeks = data.forecasts[grade];

    const fourWeekTotal = weeks.reduce(
      (total, week) =>
        total + Number(week.median_demand_kg),
      0
    );

    return {
      grade,
      color: GRADE_COLORS[grade],
      weekOne: Number(weeks[0].median_demand_kg),
      fourWeekTotal,
      weekFour: Number(weeks[3].median_demand_kg),
    };
  });
}

function DashboardMetric({
  icon: Icon,
  title,
  value,
  subtitle,
}) {
  return (
    <article className="tdh-metric-card">
      <div className="tdh-metric-heading">
        <span>{title}</span>
        <span className="tdh-metric-icon">
          <Icon size={19} aria-hidden="true" />
        </span>
      </div>

      <strong className="tdh-metric-value">
        {value}
      </strong>

      <p>{subtitle}</p>
    </article>
  );
}

export default function DemandHome() {
  const navigate = useNavigate();

  const [forecastData, setForecastData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Manual refresh only. State updates here occur
  // in response to the user's button click.
  const loadForecast = useCallback(
    async (signal, isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const result = await getResearchTFTForecast(signal);

        if (!signal?.aborted) {
          setForecastData(result);
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
            "Unable to retrieve the research forecast."
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

  // Initial loading is already true.
  // Fetch directly and update state only when
  // the asynchronous request settles.
  //
  // This avoids synchronous state updates
  // inside the effect and satisfies ESLint.
  useEffect(() => {
    const controller = new AbortController();

    getResearchTFTForecast(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setForecastData(result);
        }
      })
      .catch((caughtError) => {
        if (
          caughtError.name === "AbortError" ||
          controller.signal.aborted
        ) {
          return;
        }

        setError(
          caughtError.message ||
            "Unable to retrieve the research forecast."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  const chartData = useMemo(
    () => createChartData(forecastData),
    [forecastData]
  );

  const gradeSummaries = useMemo(
    () => createGradeSummaries(forecastData),
    [forecastData]
  );

  const totalFourWeekDemand = useMemo(
    () =>
      gradeSummaries.reduce(
        (sum, item) => sum + item.fourWeekTotal,
        0
      ),
    [gradeSummaries]
  );

  const firstForecastDate =
    forecastData?.forecasts?.BOP?.[0]?.week;

  const finalForecastDate =
    forecastData?.forecasts?.BOP?.[3]?.week;

  function handleReload() {
    loadForecast(undefined, true);
  }

  return (
    <div className="tdh-page">
      <header className="tdh-hero">
        <div className="tdh-hero-content">
          <span className="tdh-eyebrow">
            <Leaf size={15} aria-hidden="true" />
            TEA FACTORY INTELLIGENCE
          </span>

          <h1>Tea Demand Dashboard</h1>

          <p className="tdh-hero-description">
            Explore four-week tea demand predictions,
            analyze demand across five tea grades,
            and access your forecasting tools.
          </p>

          <div className="tdh-hero-actions">
            <button
              type="button"
              className="tdh-btn tdh-btn-primary"
              onClick={() =>
                navigate(`${BASE_PATH}/research-forecast`)
              }
            >
              <BarChart3 size={18} aria-hidden="true" />
              Explore Research Forecast
              <ArrowRight size={17} aria-hidden="true" />
            </button>

            <button
              type="button"
              className="tdh-btn tdh-btn-secondary"
              onClick={() =>
                navigate(`${BASE_PATH}/weekly-data`)
              }
            >
              <Database size={18} aria-hidden="true" />
              Weekly Data Entry
            </button>
          </div>
        </div>

        <div className="tdh-hero-model">
          <div className="tdh-model-icon">
            <BrainCircuit size={25} aria-hidden="true" />
          </div>

          <span>SELECTED RESEARCH MODEL</span>
          <strong>Temporal Fusion Transformer</strong>
          <p>No-price TFT · Four-week horizon</p>

          <div className="tdh-model-status">
            <CheckCircle2 size={15} aria-hidden="true" />
            Validated research model
          </div>
        </div>
      </header>

      <div className="tdh-main">
        <div className="tdh-section-top">
          <div>
            <span className="tdh-section-kicker">
              FORECAST OVERVIEW
            </span>

            <h2>Research Forecast Snapshot</h2>

            <p>
              Saved predictions from the selected
              no-price TFT model.
            </p>
          </div>

          <button
            type="button"
            className="tdh-reload-btn"
            onClick={handleReload}
            disabled={loading || refreshing}
          >
            <RefreshCw
              size={16}
              aria-hidden="true"
              className={
                loading || refreshing
                  ? "tdh-spin"
                  : ""
              }
            />

            {refreshing ? "Reloading..." : "Reload Data"}
          </button>
        </div>

        {loading && (
          <div
            className="tdh-feedback tdh-feedback-loading"
            role="status"
          >
            <RefreshCw
              size={20}
              className="tdh-spin"
              aria-hidden="true"
            />

            <div>
              <strong>Loading forecast data</strong>
              <p>
                Connecting to the research forecasting API.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div
            className="tdh-feedback tdh-feedback-error"
            role="alert"
          >
            <AlertCircle size={22} aria-hidden="true" />

            <div>
              <strong>
                {forecastData
                  ? "Unable to refresh the forecast"
                  : "Forecast data unavailable"}
              </strong>

              <p>{error}</p>

              <p>
                Make sure the FastAPI backend is running
                on port 8000.
              </p>

              {forecastData && (
                <p>
                  Previously loaded results are displayed
                  below and may be outdated.
                </p>
              )}
            </div>

            <button
              type="button"
              className="tdh-retry-btn"
              onClick={handleReload}
              disabled={refreshing}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !forecastData && !error && (
          <div className="tdh-feedback">
            No saved research forecasts are available.
          </div>
        )}

        {forecastData && (
          <>
            <div className="tdh-origin-banner">
              <div className="tdh-origin-main">
                <CalendarDays
                  size={19}
                  aria-hidden="true"
                />

                <div>
                  <strong>
                    Forecast origin:{" "}
                    {formatDate(forecastData.forecast_origin)}
                  </strong>

                  <span>
                    Forecast period:{" "}
                    {formatDate(firstForecastDate)}
                    {" — "}
                    {formatDate(finalForecastDate)}
                  </span>
                </div>
              </div>

              <div className="tdh-origin-label">
                Saved research forecast
              </div>
            </div>

            <div className="tdh-metrics-grid">
              <DashboardMetric
                icon={TrendingUp}
                title="Four-Week Median Demand Total"
                value={formatCompactKg(totalFourWeekDemand)}
                subtitle="Sum of 20 grade-level P50 forecasts"
              />

              <DashboardMetric
                icon={Leaf}
                title="Tea Grades"
                value={String(forecastData.tea_grade_count)}
                subtitle="BOP, BOPF, Dust, OP and Pekoe"
              />

              <DashboardMetric
                icon={CalendarDays}
                title="Forecast Horizon"
                value={`${forecastData.forecast_horizon_weeks} Weeks`}
                subtitle={`${forecastData.forecast_count} forecast values`}
              />

              <DashboardMetric
                icon={Clock3}
                title="Historical Input"
                value={`${forecastData.historical_input_weeks} Weeks`}
                subtitle="Observed demand history per tea grade"
              />
            </div>

            <section className="tdh-panel">
              <div className="tdh-panel-header">
                <div>
                  <span className="tdh-section-kicker">
                    PREDICTED DEMAND
                  </span>

                  <h2>Weekly Demand Trends</h2>

                  <p>
                    Median forecast demand for all five
                    tea grades, in kilograms.
                  </p>
                </div>

                <button
                  type="button"
                  className="tdh-text-link"
                  onClick={() =>
                    navigate(
                      `${BASE_PATH}/research-forecast`
                    )
                  }
                >
                  Detailed Forecast
                  <ArrowRight
                    size={16}
                    aria-hidden="true"
                  />
                </button>
              </div>

              <div className="tdh-chart">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
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
                      vertical={false}
                    />

                    <XAxis dataKey="week" />

                    <YAxis
                      width={62}
                      tickFormatter={(value) =>
                        `${(value / 1000).toFixed(0)}k`
                      }
                    />

                    <Tooltip
                      formatter={(value, name) => [
                        formatKg(value),
                        name,
                      ]}
                      labelFormatter={(label, payload) => {
                        const date =
                          payload?.[0]?.payload?.date;

                        return date
                          ? `${label} — ${formatDate(date)}`
                          : label;
                      }}
                    />

                    <Legend />

                    {TEA_GRADES.map((grade) => (
                      <Line
                        key={grade}
                        type="monotone"
                        dataKey={grade}
                        name={grade}
                        stroke={GRADE_COLORS[grade]}
                        strokeWidth={2.5}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <p className="tdh-chart-note">
                Chart values represent P50 median
                predictions, not observed demand.
              </p>
            </section>

            <section className="tdh-panel">
              <div className="tdh-panel-header">
                <div>
                  <span className="tdh-section-kicker">
                    GRADE ANALYTICS
                  </span>

                  <h2>Tea Grade Overview</h2>

                  <p>
                    Demand summaries derived from the
                    four saved median predictions for
                    each tea grade.
                  </p>
                </div>
              </div>

              <div className="tdh-grades-grid">
                {gradeSummaries.map((item) => (
                  <article
                    className="tdh-grade-card"
                    key={item.grade}
                    style={{
                      "--tdh-grade-color": item.color,
                    }}
                  >
                    <div className="tdh-grade-header">
                      <span className="tdh-grade-indicator" />

                      <h3>{item.grade}</h3>
                    </div>

                    <span className="tdh-grade-label">
                      Four-week P50 total
                    </span>

                    <strong className="tdh-grade-total">
                      {formatKg(item.fourWeekTotal)}
                    </strong>

                    <div className="tdh-grade-divider" />

                    <div className="tdh-grade-detail">
                      <span>Week 1</span>
                      <strong>
                        {formatKg(item.weekOne)}
                      </strong>
                    </div>

                    <div className="tdh-grade-detail">
                      <span>Week 4</span>
                      <strong>
                        {formatKg(item.weekFour)}
                      </strong>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <div className="tdh-information-note">
              <Activity size={20} aria-hidden="true" />

              <p>
                These are stored dataset-origin
                forecasts, not automatically
                updated live predictions. Combined
                totals are sums of grade-level
                medians, not separately calibrated
                uncertainty estimates.
              </p>
            </div>
          </>
        )}

        <section className="tdh-actions-section">
          <div className="tdh-section-top">
            <div>
              <span className="tdh-section-kicker">
                QUICK ACCESS
              </span>

              <h2>Forecasting Tools</h2>

              <p>
                Access the main features of your
                Tea Demand Forecasting component.
              </p>
            </div>
          </div>

          <div className="tdh-actions-grid">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;

              return (
                <button
                  key={action.path}
                  type="button"
                  className="tdh-action-card"
                  onClick={() => navigate(action.path)}
                >
                  <span className="tdh-action-icon">
                    <Icon size={22} aria-hidden="true" />
                  </span>

                  <strong>{action.title}</strong>

                  <span className="tdh-action-description">
                    {action.description}
                  </span>

                  <span className="tdh-action-footer">
                    Open Feature

                    <ChevronRight
                      size={17}
                      aria-hidden="true"
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
