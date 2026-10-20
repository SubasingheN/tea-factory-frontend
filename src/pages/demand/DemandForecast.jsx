
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useLocation } from "react-router-dom";

import {
  AlertCircle,
  ChartNoAxesCombined,
  CheckCircle2,
  TrendingUp,
  ClipboardList,
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
  getEightInputHistoricalWeek,
} from "../../services/eightInputDataService";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000"
).replace(/\/+$/, "");

const COLORS = {
  forest: "#153D2B",
  green: "#2E6B4E",
  muted: "#66786E",
  border: "#D8E2D3",
  white: "#FFFFFF",
  background: "#F6F8F4",
  success: "#24724B",
  warning: "#805C19",
  danger: "#B54747",
};

const GRADE_COLORS = {
  BOP: "#153D2B",
  BOPF: "#2E6B4E",
  Dust: "#C08B2C",
  OP: "#3E6FA3",
  Pekoe: "#8A5A91",
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
  fontSize: 14,
  whiteSpace: "nowrap",
};

const OBSERVATION_FIELDS = [
  {
    key: "demand_kg",
    label: "Demand",
    suffix: " kg",
  },
  {
    key: "production_kg",
    label: "Production",
    suffix: " kg",
  },
  {
    key: "inventory_kg",
    label: "Inventory",
    suffix: " kg",
  },
  {
    key: "usd_lkr_monday_rate",
    label: "USD/LKR Monday",
    digits: 4,
  },
  {
    key: "usd_lkr_sunday_rate",
    label: "USD/LKR Sunday",
    digits: 4,
  },
  {
    key: "festival_flag",
    label: "Festival Week",
  },
  {
    key: "auction_price_high_lkr",
    label: "High-Elevation Auction Price",
    prefix: "LKR ",
    digits: 2,
  },
  {
    key: "auction_price_medium_lkr",
    label: "Medium-Elevation Auction Price",
    prefix: "LKR ",
    digits: 2,
  },
  {
    key: "auction_price_low_lkr",
    label: "Low-Elevation Auction Price",
    prefix: "LKR ",
    digits: 2,
  },
];

function formatDate(value) {
  if (!value) return "—";

  const text = String(value).slice(0, 10);
  const parsed = new Date(`${text}T12:00:00Z`);

  if (Number.isNaN(parsed.getTime())) {
    return text;
  }

  return parsed.toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function addDays(value, days) {
  if (!value) return null;

  const parsed = new Date(
    `${value}T12:00:00Z`
  );

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  parsed.setUTCDate(
    parsed.getUTCDate() + days
  );

  return parsed.toISOString().slice(0, 10);
}

function formatNumber(value, digits = 0) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return number.toLocaleString("en-GB", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function formatKg(value) {
  const formatted = formatNumber(value);

  return formatted === "—"
    ? "—"
    : `${formatted} kg`;
}

function getErrorMessage(error) {
  return (
    error?.message ||
    "Unable to retrieve saved demand forecasts."
  );
}

function formatObservation(field, value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  if (field.key === "festival_flag") {
    return Number(value) === 1
      ? "Yes"
      : "No";
  }

  const formatted = formatNumber(
    value,
    field.digits ?? 0
  );

  if (formatted === "—") {
    return "—";
  }

  return (
    `${field.prefix || ""}` +
    formatted +
    `${field.suffix || ""}`
  );
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

function isValidWeeklyForecast(record, origin) {
  if (
    !record ||
    record.finalized !== true ||
    record.forecast_origin !== origin ||
    !EIGHT_INPUT_GRADES.includes(
      record.tea_type
    ) ||
    !Array.isArray(record.forecasts) ||
    record.forecasts.length !== 4
  ) {
    return false;
  }

  return record.forecasts.every(
    (item, index) => {
      const lower = Number(
        item?.lower_demand_kg
      );

      const median = Number(
        item?.median_demand_kg
      );

      const upper = Number(
        item?.upper_demand_kg
      );

      const expectedWeek = addDays(
        origin,
        (index + 1) * 7
      );

      return (
        item?.week === expectedWeek &&
        item?.horizon === index + 1 &&
        Number.isFinite(lower) &&
        Number.isFinite(median) &&
        Number.isFinite(upper) &&
        lower >= 0 &&
        lower <= median &&
        median <= upper
      );
    }
  );
}

function validateLatestForecastSet(response) {
  if (response?.status !== "success") {
    throw new Error(
      "The forecast response is invalid."
    );
  }

  if (response.available === false) {
    return null;
  }

  const origin = response.forecast_origin;
  const forecasts = response.forecasts;

  if (
    !origin ||
    !forecasts ||
    typeof forecasts !== "object"
  ) {
    throw new Error(
      "The latest saved forecast is incomplete."
    );
  }

  const byGrade = {};

  for (const grade of EIGHT_INPUT_GRADES) {
    const record = forecasts[grade];

    if (!isValidWeeklyForecast(record, origin)) {
      throw new Error(
        `The forecast for ${grade} is incomplete. ` +
        "Please review Forecast History."
      );
    }

    byGrade[grade] = record;
  }

  const first =
    byGrade[EIGHT_INPUT_GRADES[0]];

  for (const grade of EIGHT_INPUT_GRADES) {
    const record = byGrade[grade];

    if (
      record.model !== first.model ||
      record.model_version !==
        first.model_version ||
      record.historical_backfill !==
        first.historical_backfill ||
      record.operational_forecast !==
        first.operational_forecast
    ) {
      throw new Error(
        "The saved forecast records are inconsistent."
      );
    }
  }

  if (
    !Number.isInteger(response.revision) ||
    response.revision < 0
  ) {
    throw new Error(
      "The saved forecast revision is invalid."
    );
  }

  return {
    origin,
    revision: response.revision,
    source: response.source,
    byGrade,
    historical:
      first.historical_backfill === true ||
      first.forecast_type ===
        "historical_backfill",
    forecastStart: addDays(origin, 7),
    forecastEnd: addDays(origin, 28),
  };
}

async function getLatestSavedForecast(
  origin = null
) {
  const params = new URLSearchParams();

  if (origin) {
    params.set("origin", origin);
  }

  const query = params.toString();

  let response;

  try {
    response = await fetch(
      `${API_BASE}/research/eight-input/history/latest` +
        (query ? `?${query}` : ""),
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

  return result;
}

function Panel({
  title,
  icon: Icon,
  children,
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
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: COLORS.forest,
            fontSize: 19,
          }}
        >
          {Icon && <Icon size={20} />}
          {title}
        </h2>
      </div>

      {children}
    </section>
  );
}

function StatusMessage({
  type = "success",
  children,
}) {
  const success = type === "success";
  const warning = type === "warning";

  const background = success
    ? "#EDF8F1"
    : warning
      ? "#FFF9EB"
      : "#FFF1F1";

  const color = success
    ? COLORS.success
    : warning
      ? COLORS.warning
      : COLORS.danger;

  const Icon = success
    ? CheckCircle2
    : AlertCircle;

  return (
    <div
      role={success ? "status" : "alert"}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "13px 15px",
        borderRadius: 10,
        marginBottom: 18,
        background,
        color,
        lineHeight: 1.5,
      }}
    >
      <Icon
        size={19}
        style={{ flexShrink: 0 }}
      />
      <span>{children}</span>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  description,
}) {
  return (
    <div
      style={{
        padding: 18,
        background: COLORS.white,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 13,
      }}
    >
      <div
        style={{
          color: COLORS.muted,
          fontSize: 12,
          fontWeight: 600,
          marginBottom: 9,
        }}
      >
        {label}
      </div>

      <div
        style={{
          color: COLORS.forest,
          fontSize: 23,
          fontWeight: 700,
          lineHeight: 1.3,
        }}
      >
        {value}
      </div>

      {description && (
        <div
          style={{
            color: COLORS.muted,
            fontSize: 12,
            marginTop: 7,
            lineHeight: 1.5,
          }}
        >
          {description}
        </div>
      )}
    </div>
  );
}

function GradeTabs({
  selected,
  onChange,
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 9,
        marginBottom: 22,
      }}
    >
      {EIGHT_INPUT_GRADES.map((grade) => {
        const active = grade === selected;

        return (
          <button
            key={grade}
            type="button"
            onClick={() => onChange(grade)}
            aria-pressed={active}
            style={{
              border: active
                ? `1px solid ${COLORS.forest}`
                : `1px solid ${COLORS.border}`,
              borderRadius: 9,
              background: active
                ? COLORS.forest
                : COLORS.white,
              color: active
                ? COLORS.white
                : COLORS.forest,
              fontWeight: 700,
              padding: "10px 18px",
              cursor: "pointer",
            }}
          >
            {grade}
          </button>
        );
      })}
    </div>
  );
}

export default function DemandForecast() {
  const location = useLocation();

  const requestedOrigin =
    location.state?.forecastOrigin || null;

  const [selectedGrade, setSelectedGrade] =
    useState(EIGHT_INPUT_GRADES[0]);

  const [forecastSet, setForecastSet] =
    useState(null);

  const [observations, setObservations] =
    useState({});

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [
    observationWarning,
    setObservationWarning,
  ] = useState("");

  const requestId = useRef(0);

  const loadForecasts = useCallback(
    async (origin = null) => {
      const request = ++requestId.current;

      setLoading(true);
      setError("");
      setObservationWarning("");

      try {
        const latestResponse =
          await getLatestSavedForecast(origin);

        if (request !== requestId.current) {
          return;
        }

        const parsed =
          validateLatestForecastSet(
            latestResponse
          );

        setForecastSet(parsed);

        if (!parsed) {
          setObservations({});
          return;
        }

        try {
          const weeklyResponse =
            await getEightInputHistoricalWeek(
              parsed.origin
            );

          if (request !== requestId.current) {
            return;
          }

          const records =
            extractRecords(weeklyResponse);

          const byGrade = {};

          for (const record of records) {
            if (
              EIGHT_INPUT_GRADES.includes(
                record.tea_type
              )
            ) {
              byGrade[record.tea_type] =
                record;
            }
          }

          setObservations(byGrade);

          if (
            !EIGHT_INPUT_GRADES.every(
              (grade) => Boolean(byGrade[grade])
            )
          ) {
            setObservationWarning(
              "Complete saved weekly observations " +
              "are unavailable for this reporting week."
            );
          }
        } catch {
          if (request !== requestId.current) {
            return;
          }

          setObservations({});

          setObservationWarning(
            "Saved weekly observations could not be loaded."
          );
        }
      } catch (caughtError) {
        if (request !== requestId.current) {
          return;
        }

        setForecastSet(null);
        setObservations({});
        setError(
          getErrorMessage(caughtError)
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
    loadForecasts(requestedOrigin);

    return () => {
      requestId.current += 1;
    };
  }, [loadForecasts, requestedOrigin]);

  const selectedRecord =
    forecastSet?.byGrade?.[selectedGrade] ||
    null;

  const selectedPredictions =
    selectedRecord?.forecasts || [];

  const selectedTotals = useMemo(() => {
    if (selectedPredictions.length !== 4) {
      return null;
    }

    return selectedPredictions.reduce(
      (totals, item) => ({
        lower:
          totals.lower +
          Number(item.lower_demand_kg),

        median:
          totals.median +
          Number(item.median_demand_kg),

        upper:
          totals.upper +
          Number(item.upper_demand_kg),
      }),
      {
        lower: 0,
        median: 0,
        upper: 0,
      }
    );
  }, [selectedPredictions]);

  const nextWeek =
    selectedPredictions[0] || null;

  const chartData = useMemo(() => {
    if (!forecastSet) {
      return [];
    }

    return [0, 1, 2, 3].map(
      (index) => {
        const result = {
          week: `Week ${index + 1}`,
        };

        for (const grade of EIGHT_INPUT_GRADES) {
          const item =
            forecastSet.byGrade[grade]
              ?.forecasts?.[index];

          result[grade] = item
            ? Number(item.median_demand_kg)
            : null;
        }

        return result;
      }
    );
  }, [forecastSet]);

  const rangeChartData = useMemo(
    () =>
      selectedPredictions.map(
        (item, index) => ({
          week: `Week ${index + 1}`,
          Lower: Number(
            item.lower_demand_kg
          ),
          Expected: Number(
            item.median_demand_kg
          ),
          Upper: Number(
            item.upper_demand_kg
          ),
        })
      ),
    [selectedPredictions]
  );

  const savedObservation =
    observations[selectedGrade] || null;

  return (
    <div
      className="demand-page"
      style={{
        background: COLORS.background,
        minHeight: "100vh",
        paddingBottom: 40,
      }}
    >
      <div
        className="demand-page-header"
        style={{ marginBottom: 20 }}
      >
        <h1>4-Week Demand Forecast</h1>
      </div>

      {error && (
        <StatusMessage type="error">
          {error}
        </StatusMessage>
      )}

      {loading && (
        <p style={{ color: COLORS.muted }}>
          Loading saved forecasts...
        </p>
      )}

      {!loading &&
        !error &&
        !forecastSet && (
          <StatusMessage type="warning">
            No complete four-week demand
            forecasts are available yet.
          </StatusMessage>
        )}

      {forecastSet?.historical && (
        <StatusMessage type="warning">
          This is a retrospectively saved
          historical forecast record, not
          a forecast issued during that
          reporting week.
        </StatusMessage>
      )}

      {forecastSet &&
        !forecastSet.historical && (
          <StatusMessage type="success">
            The latest saved forecast is
            available for all five tea grades.
            {forecastSet.revision > 0 &&
              ` Revision ${forecastSet.revision} is displayed.`}
          </StatusMessage>
        )}

      {forecastSet && (
        <>
          <Panel
            title="Saved Weekly Data"
            icon={ClipboardList}
          >
            <GradeTabs
              selected={selectedGrade}
              onChange={setSelectedGrade}
            />

            {observationWarning && (
              <StatusMessage type="warning">
                {observationWarning}
              </StatusMessage>
            )}

            {savedObservation ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(190px, 1fr))",
                  gap: 14,
                }}
              >
                {OBSERVATION_FIELDS.map(
                  (field) => (
                    <SummaryCard
                      key={field.key}
                      label={field.label}
                      value={formatObservation(
                        field,
                        savedObservation[field.key]
                      )}
                    />
                  )
                )}
              </div>
            ) : (
              <p
                style={{
                  color: COLORS.muted,
                }}
              >
                Saved weekly observations
                are unavailable for this
                reporting week.
              </p>
            )}
          </Panel>

          <Panel
            title="Demand Summary"
            icon={TrendingUp}
          >
            <GradeTabs
              selected={selectedGrade}
              onChange={setSelectedGrade}
            />

            {selectedTotals && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(185px, 1fr))",
                  gap: 14,
                }}
              >
                <SummaryCard
                  label={`${selectedGrade} — Next Week`}
                  value={formatKg(
                    nextWeek?.median_demand_kg
                  )}
                  description={
                    nextWeek
                      ? formatDate(
                          nextWeek.week
                        )
                      : ""
                  }
                />

                <SummaryCard
                  label="Four-Week Expected Demand"
                  value={formatKg(
                    selectedTotals.median
                  )}
                />

                <SummaryCard
                  label="Four-Week Lower Estimate"
                  value={formatKg(
                    selectedTotals.lower
                  )}
                />

                <SummaryCard
                  label="Four-Week Upper Estimate"
                  value={formatKg(
                    selectedTotals.upper
                  )}
                />
              </div>
            )}
          </Panel>

          <Panel
            title={`${selectedGrade} — Weekly Demand Range`}
            icon={ChartNoAxesCombined}
          >
            <div
              style={{
                width: "100%",
                height: 300,
                marginBottom: 22,
              }}
            >
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <LineChart
                  data={rangeChartData}
                  margin={{
                    top: 10,
                    right: 20,
                    left: 10,
                    bottom: 5,
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
                  />

                  <Legend />

                  <Line
                    type="monotone"
                    dataKey="Lower"
                    stroke="#8FAE9A"
                    strokeDasharray="5 4"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />

                  <Line
                    type="monotone"
                    dataKey="Expected"
                    stroke={COLORS.forest}
                    strokeWidth={3}
                    dot={{ r: 5 }}
                  />

                  <Line
                    type="monotone"
                    dataKey="Upper"
                    stroke="#C08B2C"
                    strokeDasharray="5 4"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div
              style={{
                overflowX: "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  minWidth: 680,
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: COLORS.forest,
                      color: COLORS.white,
                      textAlign: "left",
                    }}
                  >
                    {[
                      "Week",
                      "Starting Date",
                      "Lower Demand",
                      "Expected Demand",
                      "Upper Demand",
                    ].map((heading) => (
                      <th
                        key={heading}
                        style={{
                          padding: "13px 14px",
                        }}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {selectedPredictions.map(
                    (prediction, index) => (
                      <tr
                        key={prediction.week}
                      >
                        <td style={CELL_STYLE}>
                          Week {index + 1}
                        </td>

                        <td style={CELL_STYLE}>
                          {formatDate(
                            prediction.week
                          )}
                        </td>

                        <td style={CELL_STYLE}>
                          {formatKg(
                            prediction.lower_demand_kg
                          )}
                        </td>

                        <td
                          style={{
                            ...CELL_STYLE,
                            fontWeight: 700,
                            color: COLORS.forest,
                          }}
                        >
                          {formatKg(
                            prediction.median_demand_kg
                          )}
                        </td>

                        <td style={CELL_STYLE}>
                          {formatKg(
                            prediction.upper_demand_kg
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel
            title="All Tea Grades — Expected Demand"
            icon={ChartNoAxesCombined}
          >
            <div
              style={{
                width: "100%",
                height: 320,
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
                    right: 25,
                    left: 10,
                    bottom: 5,
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
                  />

                  <Legend />

                  {EIGHT_INPUT_GRADES.map(
                    (grade) => (
                      <Line
                        key={grade}
                        type="monotone"
                        dataKey={grade}
                        name={grade}
                        stroke={
                          GRADE_COLORS[grade]
                        }
                        strokeWidth={
                          grade === selectedGrade
                            ? 3
                            : 2
                        }
                        strokeOpacity={
                          grade === selectedGrade
                            ? 1
                            : 0.6
                        }
                        dot={{ r: 4 }}
                      />
                    )
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div
              style={{
                overflowX: "auto",
                marginTop: 18,
              }}
            >
              <table
                style={{
                  width: "100%",
                  minWidth: 550,
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: COLORS.forest,
                      color: COLORS.white,
                      textAlign: "left",
                    }}
                  >
                    <th style={CELL_STYLE}>
                      Tea Grade
                    </th>

                    <th style={CELL_STYLE}>
                      Four-Week Expected Demand
                    </th>

                    <th style={CELL_STYLE}>
                      Average Weekly Demand
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {EIGHT_INPUT_GRADES.map(
                    (grade) => {
                      const predictions =
                        forecastSet.byGrade[
                          grade
                        ].forecasts;

                      const total =
                        predictions.reduce(
                          (sum, item) =>
                            sum +
                            Number(
                              item.median_demand_kg
                            ),
                          0
                        );

                      return (
                        <tr key={grade}>
                          <td
                            style={{
                              ...CELL_STYLE,
                              fontWeight: 700,
                              color: COLORS.forest,
                            }}
                          >
                            {grade}
                          </td>

                          <td
                            style={CELL_STYLE}
                          >
                            {formatKg(total)}
                          </td>

                          <td
                            style={CELL_STYLE}
                          >
                            {formatKg(
                              total / 4
                            )}
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
