
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Package,
  Info,
  RefreshCw,
  Bell,
  ChartNoAxesCombined,
} from "lucide-react";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";

import {
  EIGHT_INPUT_GRADES,
  getEightInputHistoricalWeek,
} from "../../services/eightInputDataService";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000"
).replace(/\/+$/, "");

const CHANGE_THRESHOLD_PERCENT = 15;

const COLORS = {
  forest: "#153D2B",
  green: "#2E6B4E",
  muted: "#63756A",
  border: "#D8E2D3",
  ivory: "#F5F3E9",
  white: "#FFFFFF",
  danger: "#A73939",
  warning: "#805C19",
  blue: "#347DA1",
  lower: "#8FAE9A",
  upper: "#C08B2C",
};

const PANEL_STYLE = {
  padding: 24,
  background: COLORS.white,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 16,
  marginBottom: 20,
};

const CELL_STYLE = {
  padding: "12px 14px",
  borderBottom: `1px solid ${COLORS.border}`,
  fontSize: 13,
  whiteSpace: "nowrap",
};

function validNumber(value) {
  return (
    value !== null &&
    value !== undefined &&
    value !== "" &&
    Number.isFinite(Number(value))
  );
}

function formatNumber(value, digits = 0) {
  if (!validNumber(value)) {
    return "—";
  }

  return Number(value).toLocaleString(
    "en-GB",
    {
      maximumFractionDigits: digits,
    }
  );
}

function formatKg(value) {
  return validNumber(value)
    ? `${formatNumber(value)} kg`
    : "—";
}

function formatPercent(value) {
  if (!validNumber(value)) {
    return "—";
  }

  const number = Number(value);

  return `${
    number > 0 ? "+" : ""
  }${formatNumber(number, 1)}%`;
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

  return date.toLocaleDateString(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }
  );
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

function extractRecords(response) {
  if (Array.isArray(response?.records)) {
    return response.records;
  }

  if (Array.isArray(response?.observations)) {
    return response.observations;
  }

  if (Array.isArray(response?.data?.records)) {
    return response.data.records;
  }

  return [];
}

function validateForecast(
  record,
  origin,
  grade
) {
  if (
    !record ||
    record.finalized !== true ||
    record.forecast_origin !== origin ||
    record.tea_type !== grade ||
    !Array.isArray(record.forecasts) ||
    record.forecasts.length !== 4
  ) {
    return false;
  }

  return record.forecasts.every(
    (prediction, index) => {
      if (
        prediction?.week !==
          addDays(
            origin,
            (index + 1) * 7
          ) ||
        Number(prediction?.horizon) !==
          index + 1
      ) {
        return false;
      }

      const values = [
        prediction.lower_demand_kg,
        prediction.median_demand_kg,
        prediction.upper_demand_kg,
      ];

      if (!values.every(validNumber)) {
        return false;
      }

      const [lower, expected, upper] =
        values.map(Number);

      return (
        lower >= 0 &&
        lower <= expected &&
        expected <= upper
      );
    }
  );
}

async function getLatestSavedForecast(origin) {
  const params = new URLSearchParams({
    origin,
  });

  let response;

  try {
    response = await fetch(
      `${API_BASE}/research/eight-input/history/latest?${params.toString()}`,
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
        : "Unable to retrieve the latest forecast."
    );
  }

  if (
    result.status !== "success" ||
    result.available !== true ||
    result.forecast_origin !== origin
  ) {
    throw new Error(
      "No saved forecast is available for the latest completed week."
    );
  }

  if (
    !Number.isInteger(result.revision) ||
    result.revision < 0
  ) {
    throw new Error(
      "The saved forecast version is invalid."
    );
  }

  for (const grade of EIGHT_INPUT_GRADES) {
    if (
      !validateForecast(
        result.forecasts?.[grade],
        origin,
        grade
      )
    ) {
      throw new Error(
        `The latest ${grade} forecast is incomplete.`
      );
    }
  }

  return result;
}

function getDemandChange(predicted, baseline) {
  if (
    !validNumber(predicted) ||
    !validNumber(baseline) ||
    Number(baseline) <= 0
  ) {
    return null;
  }

  return (
    ((Number(predicted) -
      Number(baseline)) /
      Number(baseline)) *
    100
  );
}

function getDemandStatus(change) {
  if (change === null) {
    return {
      type: "unknown",
      label: "Data Unavailable",
    };
  }

  if (change >= CHANGE_THRESHOLD_PERCENT) {
    return {
      type: "increase",
      label: "Demand Increase",
    };
  }

  if (change <= -CHANGE_THRESHOLD_PERCENT) {
    return {
      type: "decrease",
      label: "Demand Decrease",
    };
  }

  return {
    type: "normal",
    label: "No Major Change",
  };
}

function getStatusColor(type) {
  if (type === "increase") {
    return COLORS.danger;
  }

  if (type === "decrease") {
    return COLORS.blue;
  }

  if (type === "stock") {
    return COLORS.warning;
  }

  if (type === "normal") {
    return COLORS.green;
  }

  return COLORS.muted;
}

function getRecommendation(status) {
  switch (status.type) {
    case "increase":
      return (
        "Review production capacity, stock, and incoming " +
        "supplies. Prepare for higher demand after checking " +
        "confirmed customer orders."
      );

    case "decrease":
      return (
        "Review production schedules and planned purchases. " +
        "Avoid excess inventory after checking actual orders."
      );

    case "normal":
      return (
        "Maintain regular planning. Monitor stock, production, " +
        "and confirmed customer orders."
      );

    default:
      return (
        "Check the recorded weekly demand before making " +
        "demand-based planning decisions."
      );
  }
}

function buildGradeAnalysis(record, observation) {
  const baseline =
    validNumber(observation?.demand_kg) &&
    Number(observation.demand_kg) > 0
      ? Number(observation.demand_kg)
      : null;

  const inventory =
    validNumber(observation?.inventory_kg) &&
    Number(observation.inventory_kg) >= 0
      ? Number(observation.inventory_kg)
      : null;

  const production =
    validNumber(observation?.production_kg) &&
    Number(observation.production_kg) >= 0
      ? Number(observation.production_kg)
      : null;

  const weeks = record.forecasts.map(
    (prediction) => {
      const change = getDemandChange(
        prediction.median_demand_kg,
        baseline
      );

      const status = getDemandStatus(change);

      return {
        week: prediction.week,
        horizon: prediction.horizon,
        lower: Number(
          prediction.lower_demand_kg
        ),
        expected: Number(
          prediction.median_demand_kg
        ),
        upper: Number(
          prediction.upper_demand_kg
        ),
        change,
        status,
        recommendation:
          getRecommendation(status),
      };
    }
  );

  const increases = weeks.filter(
    (week) =>
      week.status.type === "increase"
  ).length;

  const decreases = weeks.filter(
    (week) =>
      week.status.type === "decrease"
  ).length;

  let overallStatus;

  if (baseline === null) {
    overallStatus = {
      type: "unknown",
      label: "Data Unavailable",
    };
  } else if (
    increases > 0 &&
    decreases > 0
  ) {
    overallStatus = {
      type: "unknown",
      label: "Mixed Demand Changes",
    };
  } else if (increases > 0) {
    overallStatus = {
      type: "increase",
      label: "Demand Increase",
    };
  } else if (decreases > 0) {
    overallStatus = {
      type: "decrease",
      label: "Demand Decrease",
    };
  } else {
    overallStatus = {
      type: "normal",
      label: "No Major Change",
    };
  }

  const nextWeek = weeks[0];

  const inventoryBelowNextWeek =
    inventory !== null &&
    inventory < nextWeek.expected;

  return {
    grade: record.tea_type,
    baseline,
    inventory,
    production,
    weeks,
    overallStatus,
    nextWeek,
    inventoryBelowNextWeek,
    requiresAttention:
      increases > 0 ||
      decreases > 0 ||
      inventoryBelowNextWeek,
  };
}

function Panel({
  title,
  icon: Icon,
  children,
}) {
  return (
    <section style={PANEL_STYLE}>
      <h2
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          margin: "0 0 20px",
          color: COLORS.forest,
          fontSize: 19,
        }}
      >
        {Icon && (
          <Icon
            size={21}
            color={COLORS.green}
          />
        )}

        {title}
      </h2>

      {children}
    </section>
  );
}

function StatusLabel({ status }) {
  const color = getStatusColor(
    status.type
  );

  const Icon =
    status.type === "increase"
      ? TrendingUp
      : status.type === "decrease"
        ? TrendingDown
        : status.type === "normal"
          ? CheckCircle2
          : Info;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "7px 10px",
        border: `1px solid ${color}50`,
        borderRadius: 9,
        color,
        fontWeight: 600,
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      <Icon size={15} />
      {status.label}
    </span>
  );
}

function SummaryCard({
  label,
  value,
}) {
  return (
    <div
      style={{
        padding: 18,
        background: COLORS.ivory,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
      }}
    >
      <div
        style={{
          color: COLORS.muted,
          fontSize: 12,
          marginBottom: 9,
        }}
      >
        {label}
      </div>

      <strong
        style={{
          color: COLORS.forest,
          fontSize: 21,
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function DataTable({
  headings,
  children,
  minWidth = 720,
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          minWidth,
          borderCollapse: "collapse",
          textAlign: "left",
        }}
      >
        <thead>
          <tr
            style={{
              background: COLORS.forest,
              color: COLORS.white,
            }}
          >
            {headings.map((heading) => (
              <th
                key={heading}
                style={{
                  padding: "13px 14px",
                  fontSize: 13,
                  whiteSpace: "nowrap",
                }}
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function ForecastTooltip({
  active,
  payload,
}) {
  if (
    !active ||
    !Array.isArray(payload) ||
    !payload.length
  ) {
    return null;
  }

  const data = payload[0]?.payload;

  if (!data) {
    return null;
  }

  return (
    <div
      style={{
        width: 290,
        maxWidth: "80vw",
        padding: 15,
        borderRadius: 12,
        border: `1px solid ${COLORS.border}`,
        background: COLORS.white,
        boxShadow:
          "0 6px 24px rgba(21,61,43,0.13)",
        lineHeight: 1.55,
        fontSize: 12,
      }}
    >
      <strong
        style={{
          display: "block",
          color: COLORS.forest,
          fontSize: 14,
          marginBottom: 9,
        }}
      >
        Week {data.horizon}
        {" — "}
        {formatWeek(data.date)}
      </strong>

      <div>
        Lower: {formatKg(data.Lower)}
      </div>

      <div>
        <strong>
          Expected: {formatKg(data.Expected)}
        </strong>
      </div>

      <div>
        Upper: {formatKg(data.Upper)}
      </div>

      {validNumber(data.Recorded) && (
        <div>
          Recorded demand:{" "}
          {formatKg(data.Recorded)}
        </div>
      )}

      <div
        style={{
          marginTop: 10,
          paddingTop: 9,
          borderTop:
            `1px solid ${COLORS.border}`,
        }}
      >
        <strong
          style={{
            color: getStatusColor(
              data.status.type
            ),
          }}
        >
          {data.status.label}
          {" — "}
          {formatPercent(data.change)}
        </strong>
      </div>

      <div
        style={{
          marginTop: 10,
        }}
      >
        <strong
          style={{
            color: COLORS.forest,
          }}
        >
          Recommended Action
        </strong>

        <div
          style={{
            color: COLORS.muted,
            marginTop: 4,
          }}
        >
          {data.recommendation}
        </div>
      </div>
    </div>
  );
}

function GradeForecastChart({
  analysis,
}) {
  const data = analysis.weeks.map(
    (week) => ({
      name: `Week ${week.horizon}`,
      date: week.week,
      horizon: week.horizon,
      Lower: week.lower,
      Expected: week.expected,
      Upper: week.upper,
      Recorded: analysis.baseline,
      change: week.change,
      status: week.status,
      recommendation:
        week.recommendation,
    })
  );

  return (
    <div
      style={{
        padding: 20,
        border:
          `1px solid ${COLORS.border}`,
        borderRadius: 13,
        marginBottom: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent:
            "space-between",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 18,
            color: COLORS.forest,
          }}
        >
          {analysis.grade}
        </h3>

        <StatusLabel
          status={analysis.overallStatus}
        />
      </div>

      <div
        style={{
          color: COLORS.muted,
          fontSize: 12,
          marginBottom: 16,
        }}
      >
        Recorded demand:{" "}
        {formatKg(analysis.baseline)}
        {" · "}
        Recorded production:{" "}
        {formatKg(analysis.production)}
        {" · "}
        Inventory:{" "}
        {formatKg(analysis.inventory)}
      </div>

      <div
        style={{
          width: "100%",
          height: 300,
        }}
      >
        <ResponsiveContainer
          width="100%"
          height="100%"
        >
          <LineChart
            data={data}
            margin={{
              top: 10,
              right: 22,
              left: 10,
              bottom: 5,
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
            />

            <XAxis dataKey="name" />

            <YAxis
              tickFormatter={(value) =>
                `${formatNumber(
                  value / 1000,
                  1
                )}k`
              }
            />

            <Tooltip
              content={
                <ForecastTooltip />
              }
            />

            <Legend />

            {validNumber(
              analysis.baseline
            ) && (
              <ReferenceLine
                y={analysis.baseline}
                stroke={COLORS.blue}
                strokeDasharray="3 3"
                label={{
                  value:
                    "Recorded Demand",
                  position: "insideTopRight",
                  fontSize: 10,
                  fill: COLORS.blue,
                }}
              />
            )}

            <Line
              type="monotone"
              dataKey="Lower"
              stroke={COLORS.lower}
              strokeDasharray="5 4"
              strokeWidth={2}
              dot={{ r: 3 }}
            />

            <Line
              type="monotone"
              dataKey="Expected"
              stroke={COLORS.forest}
              strokeWidth={3}
              dot={{
                r: 5,
              }}
              activeDot={{
                r: 7,
              }}
            />

            <Line
              type="monotone"
              dataKey="Upper"
              stroke={COLORS.upper}
              strokeDasharray="5 4"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 10,
          marginTop: 18,
        }}
      >
        {analysis.weeks.map(
          (week) => (
            <div
              key={week.week}
              style={{
                border:
                  `1px solid ${COLORS.border}`,
                borderRadius: 10,
                padding: 13,
                background:
                  COLORS.ivory,
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  color: COLORS.forest,
                  marginBottom: 6,
                  fontSize: 13,
                }}
              >
                Week {week.horizon}
              </div>

              <div
                style={{
                  color: COLORS.muted,
                  fontSize: 11,
                  marginBottom: 9,
                }}
              >
                {formatWeek(
                  week.week
                )}
              </div>

              <div
                style={{
                  color:
                    getStatusColor(
                      week.status.type
                    ),
                  fontSize: 12,
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                {week.status.label}
                {" "}
                {formatPercent(
                  week.change
                )}
              </div>

              <div
                style={{
                  color: COLORS.muted,
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                {week.recommendation}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default function DemandAlerts() {
  const [origin, setOrigin] = useState(
    () => getLatestCompletedWeek()
  );

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

  const loadAlerts = useCallback(
    async () => {
      const request =
        ++requestId.current;

      const latestWeek =
        getLatestCompletedWeek();

      setOrigin(latestWeek);
      setLoading(true);
      setError("");
      setObservationWarning("");
      setForecast(null);
      setObservations([]);

      try {
        const latest =
          await getLatestSavedForecast(
            latestWeek
          );

        if (
          request !== requestId.current
        ) {
          return;
        }

        setForecast(latest);

        try {
          const response =
            await getEightInputHistoricalWeek(
              latestWeek
            );

          if (
            request !== requestId.current
          ) {
            return;
          }

          const records =
            extractRecords(response);

          setObservations(records);

          if (
            !EIGHT_INPUT_GRADES.every(
              (grade) =>
                records.some(
                  (item) =>
                    (
                      item.tea_type ||
                      item.grade
                    ) === grade
                )
            )
          ) {
            setObservationWarning(
              "Some factory records are unavailable. " +
              "Demand and inventory checks may be limited."
            );
          }
        } catch {
          if (
            request !== requestId.current
          ) {
            return;
          }

          setObservations([]);

          setObservationWarning(
            "Recorded demand, production, or inventory " +
            "could not be loaded for this reporting week."
          );
        }
      } catch (caughtError) {
        if (
          request !== requestId.current
        ) {
          return;
        }

        setForecast(null);

        setError(
          caughtError?.message ||
          "Unable to load factory alerts."
        );
      } finally {
        if (
          request === requestId.current
        ) {
          setLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    loadAlerts();

    return () => {
      requestId.current += 1;
    };
  }, [loadAlerts]);

  const analyses = useMemo(() => {
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
              (
                item.tea_type ||
                item.grade
              ) === grade
          ) || null;

        return buildGradeAnalysis(
          record,
          observation
        );
      }
    );
  }, [forecast, observations]);

  const summary = useMemo(
    () => ({
      monitored: analyses.length,
      attention: analyses.filter(
        (item) =>
          item.requiresAttention
      ).length,
      stable: analyses.filter(
        (item) =>
          item.overallStatus.type ===
          "normal"
      ).length,
      stockReviews: analyses.filter(
        (item) =>
          item.inventoryBelowNextWeek
      ).length,
    }),
    [analyses]
  );

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
          alignItems: "center",
          justifyContent:
            "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div>
          <h1>
            Alerts & Recommendations
          </h1>

          <p
            style={{
              color: COLORS.muted,
              margin: "7px 0 0",
            }}
          >
            Reporting Week:{" "}
            {formatWeek(origin)}
            {forecast &&
              ` · ${
                forecast.revision === 0
                  ? "Original Forecast"
                  : `Revision ${forecast.revision}`
              }`}
          </p>
        </div>

        <button
          type="button"
          onClick={loadAlerts}
          disabled={loading}
          className="demand-secondary-btn"
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      {loading && (
        <p
          style={{
            color: COLORS.muted,
          }}
        >
          Loading latest factory forecasts
          and records...
        </p>
      )}

      {!loading && error && (
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

      {!loading &&
        !error &&
        forecast && (
          <>
            {observationWarning && (
              <div
                role="alert"
                style={{
                  display: "flex",
                  gap: 10,
                  padding: 15,
                  marginBottom: 20,
                  borderRadius: 10,
                  background: "#FFF8EB",
                  color: COLORS.warning,
                }}
              >
                <AlertTriangle size={18} />
                {observationWarning}
              </div>
            )}

            <Panel
              title="Demand Alert Overview"
              icon={Bell}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 14,
                  marginBottom: 24,
                }}
              >
                <SummaryCard
                  label="Tea Grades"
                  value={
                    summary.monitored
                  }
                />

                <SummaryCard
                  label="Grades Requiring Attention"
                  value={
                    summary.attention
                  }
                />

                <SummaryCard
                  label="Grades Without Major Changes"
                  value={
                    summary.stable
                  }
                />

                <SummaryCard
                  label="Stock Reviews"
                  value={
                    summary.stockReviews
                  }
                />
              </div>

              <DataTable
                headings={[
                  "Tea Grade",
                  "Recorded Demand",
                  "Demand Status",
                  "Stock Check",
                ]}
                minWidth={750}
              >
                {analyses.map((item) => (
                  <tr key={item.grade}>
                    <td
                      style={{
                        ...CELL_STYLE,
                        color: COLORS.forest,
                        fontWeight: 700,
                      }}
                    >
                      {item.grade}
                    </td>

                    <td style={CELL_STYLE}>
                      {formatKg(
                        item.baseline
                      )}
                    </td>

                    <td style={CELL_STYLE}>
                      <StatusLabel
                        status={
                          item.overallStatus
                        }
                      />
                    </td>

                    <td style={CELL_STYLE}>
                      {item.inventory === null
                        ? "Inventory unavailable"
                        : item.inventoryBelowNextWeek
                          ? "Review stock coverage"
                          : "No immediate stock flag"}
                    </td>
                  </tr>
                ))}
              </DataTable>
            </Panel>

            <Panel
              title="Demand Forecast & Recommendations"
              icon={ChartNoAxesCombined}
            >
              {analyses.map(
                (analysis) => (
                  <GradeForecastChart
                    key={analysis.grade}
                    analysis={analysis}
                  />
                )
              )}
            </Panel>

            <Panel
              title="Inventory Planning Checks"
              icon={Package}
            >
              <DataTable
                headings={[
                  "Tea Grade",
                  "Recorded Inventory",
                  "Next-Week Expected Demand",
                  "Planning Status",
                ]}
                minWidth={760}
              >
                {analyses.map((item) => (
                  <tr key={item.grade}>
                    <td
                      style={{
                        ...CELL_STYLE,
                        fontWeight: 700,
                        color: COLORS.forest,
                      }}
                    >
                      {item.grade}
                    </td>

                    <td style={CELL_STYLE}>
                      {formatKg(
                        item.inventory
                      )}
                    </td>

                    <td style={CELL_STYLE}>
                      {formatKg(
                        item.nextWeek.expected
                      )}
                    </td>

                    <td style={CELL_STYLE}>
                      {item.inventory === null
                        ? "Check inventory records"
                        : item.inventoryBelowNextWeek
                          ? "Review stock and incoming supply"
                          : "Check planned stock coverage"}
                    </td>
                  </tr>
                ))}
              </DataTable>

              <p
                style={{
                  marginBottom: 0,
                  marginTop: 15,
                  color: COLORS.muted,
                  fontSize: 12,
                  lineHeight: 1.6,
                }}
              >
                Inventory checks use recorded
                stock only. Planned production,
                deliveries, and dispatches
                must also be considered.
              </p>
            </Panel>
          </>
        )}
    </div>
  );
}
