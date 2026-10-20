
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardPenLine,
  FileText,
  GitCompareArrows,
  History,
  Leaf,
  Package,
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
  EIGHT_INPUT_GRADES,
  getEightInputFactoryStatus,
  getEightInputHistoricalWeek,
} from "../../services/eightInputDataService";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000"
).replace(/\/+$/, "");

const BASE_PATH = "/tea-demand-forecasting";

const COLORS = {
  forest: "#153D2B",
  green: "#2E6B4E",
  ivory: "#F5F3E9",
  white: "#FFFFFF",
  muted: "#63756A",
  border: "#D8E2D3",
  warning: "#805C19",
  danger: "#A73939",
};

const GRADE_COLORS = {
  BOP: "#215C43",
  BOPF: "#B38D42",
  Dust: "#347DA1",
  OP: "#8659A7",
  Pekoe: "#C36D45",
};

const CHANGE_THRESHOLD_PERCENT = 15;

const PANEL_STYLE = {
  background: COLORS.white,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 16,
  padding: 24,
  marginBottom: 20,
};

const QUICK_ACTIONS = [
  {
    title: "Weekly Data Entry",
    description: "Enter weekly factory data.",
    icon: ClipboardPenLine,
    path: `${BASE_PATH}/weekly-data`,
  },
  {
    title: "Demand Forecast",
    description: "View the latest demand forecast.",
    icon: BarChart3,
    path: `${BASE_PATH}/forecast`,
  },
  {
    title: "Demand Forecast History",
    description: "View saved forecast versions.",
    icon: History,
    path: `${BASE_PATH}/history`,
  },
  {
    title: "Demand Forecast Comparison",
    description: "Compare saved demand forecasts.",
    icon: GitCompareArrows,
    path: `${BASE_PATH}/comparison`,
  },
  {
    title: "Alerts & Recommendations",
    description: "Review factory planning alerts.",
    icon: Bell,
    path: `${BASE_PATH}/alerts`,
  },
  {
    title: "Demand Reports",
    description: "View and download reports.",
    icon: FileText,
    path: `${BASE_PATH}/reports`,
  },
];

function numberOrNull(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const result = Number(value);

  return Number.isFinite(result)
    ? result
    : null;
}

function formatNumber(value, digits = 2) {
  const number = numberOrNull(value);

  return number === null
    ? "—"
    : number.toLocaleString("en-GB", {
        maximumFractionDigits: digits,
      });
}

function formatKg(value) {
  return numberOrNull(value) === null
    ? "—"
    : `${formatNumber(value)} kg`;
}

function formatCompactKg(value) {
  const number = numberOrNull(value);

  if (number === null) {
    return "—";
  }

  if (Math.abs(number) >= 1000000) {
    return `${formatNumber(number / 1000000, 2)}M kg`;
  }

  if (Math.abs(number) >= 1000) {
    return `${formatNumber(number / 1000, 1)}k kg`;
  }

  return formatKg(number);
}

function addDays(value, days) {
  if (!value) return "";

  const date = new Date(
    `${String(value).slice(0, 10)}T12:00:00Z`
  );

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setUTCDate(
    date.getUTCDate() + days
  );

  return date.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(
    `${String(value).slice(0, 10)}T12:00:00Z`
  );

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatWeek(start) {
  return (
    `${formatDate(start)} – ` +
    formatDate(addDays(start, 6))
  );
}

function getLatestCompletedWeek() {
  const parts = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Asia/Colombo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).formatToParts(new Date());

  const part = (type) =>
    Number(
      parts.find(
        (item) => item.type === type
      )?.value
    );

  const date = new Date(
    Date.UTC(
      part("year"),
      part("month") - 1,
      part("day")
    )
  );

  const daysSinceMonday =
    (date.getUTCDay() + 6) % 7;

  date.setUTCDate(
    date.getUTCDate() -
      daysSinceMonday -
      7
  );

  return date.toISOString().slice(0, 10);
}

function validateForecast(record, origin, grade) {
  if (
    !record ||
    record.finalized !== true ||
    record.tea_type !== grade ||
    record.forecast_origin !== origin ||
    !Array.isArray(record.forecasts) ||
    record.forecasts.length !== 4
  ) {
    return false;
  }

  return record.forecasts.every(
    (prediction, index) => {
      if (
        prediction?.week !==
          addDays(origin, (index + 1) * 7) ||
        Number(prediction?.horizon) !== index + 1
      ) {
        return false;
      }

      const values = [
        prediction.lower_demand_kg,
        prediction.median_demand_kg,
        prediction.upper_demand_kg,
      ].map(numberOrNull);

      return (
        values.every((value) => value !== null) &&
        values[0] >= 0 &&
        values[0] <= values[1] &&
        values[1] <= values[2]
      );
    }
  );
}

async function getLatestSavedRevision(origin) {
  const params = new URLSearchParams({ origin });

  let response;

  try {
    response = await fetch(
      `${API_BASE}/research/eight-input/history/revisions?${params.toString()}`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );
  } catch {
    throw new Error(
      "Cannot connect to the factory backend."
    );
  }

  const result = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof result.detail === "string"
        ? result.detail
        : "Unable to retrieve saved forecasts."
    );
  }

  if (
    result.status !== "success" ||
    result.forecast_origin !== origin ||
    !Array.isArray(result.revisions)
  ) {
    throw new Error(
      "The saved forecast response is invalid."
    );
  }

  const revisions = result.revisions
    .filter(
      (item) =>
        Number.isInteger(item.revision) &&
        item.revision >= 0 &&
        item.forecasts &&
        typeof item.forecasts === "object"
    )
    .sort(
      (left, right) =>
        right.revision - left.revision
    );

  if (
    result.available === false ||
    revisions.length === 0
  ) {
    return null;
  }

  const latest = revisions[0];

  for (const grade of EIGHT_INPUT_GRADES) {
    if (
      !validateForecast(
        latest.forecasts[grade],
        origin,
        grade
      )
    ) {
      throw new Error(
        `The saved ${grade} forecast is incomplete.`
      );
    }
  }

  return latest;
}

function extractObservations(result) {
  if (Array.isArray(result?.records)) {
    return result.records;
  }

  if (Array.isArray(result?.observations)) {
    return result.observations;
  }

  if (Array.isArray(result?.data?.records)) {
    return result.data.records;
  }

  return [];
}

function getDemandChange(predicted, baseline) {
  const expected = numberOrNull(predicted);
  const recorded = numberOrNull(baseline);

  if (
    expected === null ||
    recorded === null ||
    recorded <= 0
  ) {
    return null;
  }

  return ((expected - recorded) / recorded) * 100;
}

function buildGradeSummary(
  grade,
  record,
  observation
) {
  const predictions = record.forecasts;

  const weeklyDemand = predictions.map(
    (prediction) =>
      Number(prediction.median_demand_kg)
  );

  const recordedDemand = numberOrNull(
    observation?.demand_kg
  );

  const inventory = numberOrNull(
    observation?.inventory_kg
  );

  const changes = weeklyDemand.map(
    (demand) =>
      getDemandChange(demand, recordedDemand)
  );

  const increase = changes.some(
    (value) =>
      value !== null &&
      value >= CHANGE_THRESHOLD_PERCENT
  );

  const decrease = changes.some(
    (value) =>
      value !== null &&
      value <= -CHANGE_THRESHOLD_PERCENT
  );

  let status = "No Major Change";

  if (
    recordedDemand === null ||
    recordedDemand <= 0
  ) {
    status = "Demand Data Unavailable";
  } else if (increase && decrease) {
    status = "Mixed Demand Changes";
  } else if (increase) {
    status = "Demand Increase";
  } else if (decrease) {
    status = "Demand Decrease";
  }

  const stockReview =
    inventory !== null &&
    inventory >= 0 &&
    inventory < weeklyDemand[0];

  return {
    grade,
    weeklyDemand,
    total: weeklyDemand.reduce(
      (sum, value) => sum + value,
      0
    ),
    recordedDemand,
    inventory,
    status,
    stockReview,
    inventoryMissing:
      inventory === null || inventory < 0,
    demandMissing:
      recordedDemand === null ||
      recordedDemand <= 0,
  };
}

function Panel({
  title,
  icon: Icon,
  children,
  action,
}) {
  return (
    <section style={PANEL_STYLE}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <h2
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            margin: 0,
            color: COLORS.forest,
            fontSize: 19,
          }}
        >
          {Icon && <Icon size={20} />}
          {title}
        </h2>

        {action}
      </div>

      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  description,
  icon: Icon,
}) {
  return (
    <div
      style={{
        background: COLORS.white,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 14,
        padding: 19,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          color: COLORS.muted,
          gap: 10,
          marginBottom: 14,
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <span>{label}</span>

        {Icon && (
          <Icon
            size={20}
            color={COLORS.green}
          />
        )}
      </div>

      <strong
        style={{
          color: COLORS.forest,
          fontSize: 23,
          display: "block",
        }}
      >
        {value}
      </strong>

      {description && (
        <p
          style={{
            color: COLORS.muted,
            fontSize: 12,
            margin: "9px 0 0",
          }}
        >
          {description}
        </p>
      )}
    </div>
  );
}

function QuickAction({
  action,
  onClick,
}) {
  const Icon = action.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: COLORS.white,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
        padding: 18,
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        textAlign: "left",
        cursor: "pointer",
        width: "100%",
      }}
    >
      <div
        style={{
          padding: 11,
          borderRadius: 10,
          background: COLORS.ivory,
          color: COLORS.green,
          flexShrink: 0,
        }}
      >
        <Icon size={22} />
      </div>

      <div style={{ flex: 1 }}>
        <strong
          style={{
            color: COLORS.forest,
            fontSize: 14,
          }}
        >
          {action.title}
        </strong>

        <p
          style={{
            color: COLORS.muted,
            fontSize: 12,
            margin: "7px 0 0",
            lineHeight: 1.5,
          }}
        >
          {action.description}
        </p>
      </div>

      <ArrowRight
        size={17}
        color={COLORS.green}
        style={{
          flexShrink: 0,
          marginTop: 3,
        }}
      />
    </button>
  );
}

export default function DemandHome() {
  const navigate = useNavigate();

  const [reportingWeek, setReportingWeek] =
    useState(() => getLatestCompletedWeek());

  const [forecast, setForecast] =
    useState(null);

  const [observations, setObservations] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [
    observationWarning,
    setObservationWarning,
  ] = useState("");

  const requestId = useRef(0);

  const loadDashboard = useCallback(
    async () => {
      const request = ++requestId.current;

      setLoading(true);
      setError("");
      setObservationWarning("");
      setForecast(null);
      setObservations([]);

      try {
        let latestWeek = getLatestCompletedWeek();

        try {
          const status =
            await getEightInputFactoryStatus();

          if (status?.latest_completed_week) {
            latestWeek =
              status.latest_completed_week;
          }
        } catch {
          // Use the current completed week
          // when the status endpoint is unavailable.
        }

        if (request !== requestId.current) {
          return;
        }

        setReportingWeek(latestWeek);

        const latest =
          await getLatestSavedRevision(
            latestWeek
          );

        if (request !== requestId.current) {
          return;
        }

        setForecast(latest);

        if (latest) {
          try {
            const result =
              await getEightInputHistoricalWeek(
                latestWeek
              );

            if (request !== requestId.current) {
              return;
            }

            const records =
              extractObservations(result);

            setObservations(records);

            if (
              !EIGHT_INPUT_GRADES.every(
                (grade) =>
                  records.some(
                    (item) =>
                      (item.tea_type ||
                        item.grade) === grade
                  )
              )
            ) {
              setObservationWarning(
                "Some recorded factory data is unavailable. " +
                "Demand and inventory checks may be limited."
              );
            }
          } catch {
            if (request !== requestId.current) {
              return;
            }

            setObservationWarning(
              "Recorded factory data could not be loaded. " +
              "Saved forecast information remains available."
            );
          }
        }
      } catch (caughtError) {
        if (request !== requestId.current) {
          return;
        }

        setError(
          caughtError?.message ||
          "Unable to load the dashboard."
        );
      } finally {
        if (request === requestId.current) {
          setLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    loadDashboard();

    return () => {
      requestId.current += 1;
    };
  }, [loadDashboard]);

  const gradeSummaries = useMemo(() => {
    if (!forecast?.forecasts) {
      return [];
    }

    return EIGHT_INPUT_GRADES.map(
      (grade) => {
        const record =
          forecast.forecasts[grade];

        const observation =
          observations.find(
            (item) =>
              (item.tea_type ||
                item.grade) === grade
          ) || null;

        return buildGradeSummary(
          grade,
          record,
          observation
        );
      }
    );
  }, [forecast, observations]);

  const chartData = useMemo(() => {
    if (!forecast?.forecasts) {
      return [];
    }

    const firstRecord =
      forecast.forecasts[
        EIGHT_INPUT_GRADES[0]
      ];

    return firstRecord.forecasts.map(
      (prediction, index) => {
        const row = {
          week: `Week ${index + 1}`,
          date: prediction.week,
        };

        for (const grade of EIGHT_INPUT_GRADES) {
          row[grade] = Number(
            forecast.forecasts[grade]
              .forecasts[index]
              .median_demand_kg
          );
        }

        return row;
      }
    );
  }, [forecast]);

  const totalDemand = useMemo(() => {
    if (!gradeSummaries.length) {
      return null;
    }

    return gradeSummaries.reduce(
      (sum, grade) => sum + grade.total,
      0
    );
  }, [gradeSummaries]);

  const alertSummary = useMemo(() => {
    const demandChanges =
      gradeSummaries.filter(
        (item) =>
          item.status === "Demand Increase" ||
          item.status === "Demand Decrease" ||
          item.status === "Mixed Demand Changes"
      );

    const stockReviews =
      gradeSummaries.filter(
        (item) => item.stockReview
      );

    const missingData =
      gradeSummaries.filter(
        (item) =>
          item.demandMissing ||
          item.inventoryMissing
      );

    return {
      demandChanges,
      stockReviews,
      missingData,
      attention: gradeSummaries.filter(
        (item) =>
          demandChanges.includes(item) ||
          stockReviews.includes(item)
      ).length,
    };
  }, [gradeSummaries]);

  function goTo(path) {
    navigate(path);
  }

  return (
    <div
      className="demand-page"
      style={{
        background: COLORS.ivory,
        minHeight: "100vh",
        paddingBottom: 40,
      }}
    >
      <div
        className="demand-page-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 22,
        }}
      >
        <div>
          <h1>
            Demand Forecasting Dashboard
          </h1>

          <p
            style={{
              color: COLORS.muted,
              margin: "7px 0 0",
            }}
          >
            Latest completed week:{" "}
            {formatWeek(reportingWeek)}
          </p>
        </div>

        <button
          type="button"
          className="demand-secondary-btn"
          onClick={loadDashboard}
          disabled={loading}
        >
          <RefreshCw size={17} />
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && !loading && (
        <div
          className="demand-error-message"
          role="alert"
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 20,
          }}
        >
          <AlertTriangle size={19} />
          {error}
        </div>
      )}

      {loading && (
        <p
          style={{
            color: COLORS.muted,
          }}
        >
          Loading latest factory forecasts...
        </p>
      )}

      {!loading && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(210px, 1fr))",
              gap: 16,
              marginBottom: 20,
            }}
          >
            <MetricCard
              label="Tea Grades"
              value="5"
              description="BOP, BOPF, Dust, OP, Pekoe"
              icon={Leaf}
            />

            <MetricCard
              label="Forecast Period"
              value="4 Weeks"
              description="Weekly demand planning"
              icon={CalendarDays}
            />

            <MetricCard
              label="Saved Forecast Version"
              value={
                forecast
                  ? forecast.revision === 0
                    ? "Original"
                    : `Revision ${forecast.revision}`
                  : "Unavailable"
              }
              description="Latest completed reporting week"
              icon={CheckCircle2}
            />

            <MetricCard
              label="Total Expected Demand"
              value={formatCompactKg(totalDemand)}
              description="All five grades, four weeks"
              icon={TrendingUp}
            />
          </div>

          {!forecast && !error && (
            <Panel
              title="Forecast Availability"
              icon={CalendarDays}
            >
              <p
                style={{
                  color: COLORS.muted,
                  lineHeight: 1.7,
                }}
              >
                No saved demand forecast is available
                for {formatWeek(reportingWeek)}.
                Complete the weekly data entry
                and generate the forecast to
                view the latest demand plan.
              </p>

              <button
                type="button"
                className="demand-save-btn"
                onClick={() =>
                  goTo(
                    `${BASE_PATH}/weekly-data`
                  )
                }
              >
                <ClipboardPenLine size={17} />
                Open Weekly Data Entry
              </button>
            </Panel>
          )}

          {forecast && (
            <>
              {observationWarning && (
                <div
                  role="alert"
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: 15,
                    color: COLORS.warning,
                    background: "#FFF8EB",
                    borderRadius: 10,
                    marginBottom: 20,
                  }}
                >
                  <AlertTriangle
                    size={18}
                    style={{ flexShrink: 0 }}
                  />
                  {observationWarning}
                </div>
              )}

              <Panel
                title="Four-Week Demand Overview"
                icon={BarChart3}
                action={
                  <button
                    type="button"
                    className="demand-secondary-btn"
                    onClick={() =>
                      goTo(
                        `${BASE_PATH}/forecast`
                      )
                    }
                  >
                    View Forecast
                    <ArrowRight size={16} />
                  </button>
                }
              >
                <div
                  style={{
                    width: "100%",
                    height: 350,
                  }}
                >
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <LineChart
                      data={chartData}
                      margin={{
                        top: 10,
                        right: 22,
                        left: 10,
                        bottom: 12,
                      }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                      />

                      <XAxis dataKey="week" />

                      <YAxis
                        tickFormatter={(value) =>
                          `${formatNumber(
                            value / 1000,
                            1
                          )}k`
                        }
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
                          const date =
                            payload?.[0]
                              ?.payload?.date;

                          return date
                            ? `${label} — ${formatWeek(date)}`
                            : label;
                        }}
                      />

                      <Legend />

                      {EIGHT_INPUT_GRADES.map(
                        (grade) => (
                          <Line
                            key={grade}
                            type="monotone"
                            dataKey={grade}
                            stroke={
                              GRADE_COLORS[grade]
                            }
                            strokeWidth={2.5}
                            dot={{ r: 5 }}
                            activeDot={{ r: 7 }}
                            isAnimationActive={false}
                          />
                        )
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              <Panel
                title="Tea Grade Demand Overview"
                icon={Leaf}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(210px, 1fr))",
                    gap: 14,
                  }}
                >
                  {gradeSummaries.map(
                    (item) => (
                      <div
                        key={item.grade}
                        style={{
                          border:
                            `1px solid ${COLORS.border}`,
                          borderTop:
                            `4px solid ${GRADE_COLORS[item.grade]}`,
                          borderRadius: 12,
                          padding: 18,
                          background: COLORS.white,
                        }}
                      >
                        <h3
                          style={{
                            margin: "0 0 13px",
                            fontSize: 18,
                            color: COLORS.forest,
                          }}
                        >
                          {item.grade}
                        </h3>

                        <div
                          style={{
                            fontSize: 12,
                            color: COLORS.muted,
                            marginBottom: 7,
                          }}
                        >
                          Four-Week Expected Demand
                        </div>

                        <strong
                          style={{
                            display: "block",
                            fontSize: 21,
                            color: COLORS.forest,
                            marginBottom: 18,
                          }}
                        >
                          {formatKg(item.total)}
                        </strong>

                        {item.weeklyDemand.map(
                          (value, index) => (
                            <div
                              key={index}
                              style={{
                                display: "flex",
                                justifyContent:
                                  "space-between",
                                gap: 10,
                                padding: "9px 0",
                                borderTop:
                                  `1px solid ${COLORS.border}`,
                                fontSize: 13,
                              }}
                            >
                              <span
                                style={{
                                  color: COLORS.muted,
                                }}
                              >
                                Week {index + 1}
                              </span>

                              <strong
                                style={{
                                  color: COLORS.forest,
                                }}
                              >
                                {formatKg(value)}
                              </strong>
                            </div>
                          )
                        )}
                      </div>
                    )
                  )}
                </div>
              </Panel>

              <Panel
                title="Factory Alerts Overview"
                icon={Bell}
                action={
                  <button
                    type="button"
                    className="demand-secondary-btn"
                    onClick={() =>
                      goTo(
                        `${BASE_PATH}/alerts`
                      )
                    }
                  >
                    View Alerts
                    <ArrowRight size={16} />
                  </button>
                }
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(190px, 1fr))",
                    gap: 14,
                    marginBottom: 20,
                  }}
                >
                  <MetricCard
                    label="Grades Needing Attention"
                    value={alertSummary.attention}
                    icon={AlertTriangle}
                  />

                  <MetricCard
                    label="Demand Change Alerts"
                    value={
                      alertSummary.demandChanges.length
                    }
                    icon={TrendingUp}
                  />

                  <MetricCard
                    label="Stock Coverage Reviews"
                    value={
                      alertSummary.stockReviews.length
                    }
                    icon={Package}
                  />
                </div>

                {alertSummary.demandChanges.length > 0 && (
                  <div
                    style={{
                      marginBottom: 16,
                      lineHeight: 1.7,
                      color: COLORS.muted,
                    }}
                  >
                    <strong
                      style={{
                        color: COLORS.forest,
                      }}
                    >
                      Demand changes:
                    </strong>{" "}
                    {alertSummary.demandChanges
                      .map(
                        (item) =>
                          `${item.grade} (${item.status})`
                      )
                      .join(", ")}
                  </div>
                )}

                {alertSummary.stockReviews.length > 0 && (
                  <div
                    style={{
                      marginBottom: 16,
                      lineHeight: 1.7,
                      color: COLORS.muted,
                    }}
                  >
                    <strong
                      style={{
                        color: COLORS.forest,
                      }}
                    >
                      Stock reviews:
                    </strong>{" "}
                    {alertSummary.stockReviews
                      .map((item) => item.grade)
                      .join(", ")}
                  </div>
                )}

                {alertSummary.missingData.length > 0 && (
                  <p
                    style={{
                      color: COLORS.warning,
                      lineHeight: 1.6,
                    }}
                  >
                    Recorded demand or inventory
                    information is unavailable for:{" "}
                    {alertSummary.missingData
                      .map((item) => item.grade)
                      .join(", ")}.
                  </p>
                )}

                {alertSummary.attention === 0 &&
                  alertSummary.missingData.length === 0 && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        color: COLORS.green,
                      }}
                    >
                      <CheckCircle2 size={20} />
                      No significant demand changes
                      or immediate stock flags were
                      identified from the available data.
                    </div>
                  )}

                <p
                  style={{
                    color: COLORS.muted,
                    fontSize: 12,
                    marginBottom: 0,
                    lineHeight: 1.6,
                  }}
                >
                  Stock checks use recorded inventory
                  only. Planned production, incoming
                  deliveries, and confirmed orders
                  must also be considered.
                </p>
              </Panel>
            </>
          )}

          <Panel
            title="Quick Access"
            icon={ClipboardPenLine}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(245px, 1fr))",
                gap: 14,
              }}
            >
              {QUICK_ACTIONS.map(
                (action) => (
                  <QuickAction
                    key={action.path}
                    action={action}
                    onClick={() =>
                      goTo(action.path)
                    }
                  />
                )
              )}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
