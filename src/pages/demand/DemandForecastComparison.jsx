
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  ChartNoAxesCombined,
  CheckCircle2,
  RefreshCw,
  TrendingUp,
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
} from "recharts";

import {
  EIGHT_INPUT_GRADES,
} from "../../services/eightInputDataService";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000"
).replace(/\/+$/, "");

const PREVIOUS_ORIGIN = "2026-10-05";
const LATEST_ORIGIN = "2026-10-12";

const COMPARISON_WEEKS = [
  "2026-10-26",
  "2026-11-02",
];

const COLORS = {
  forest: "#153D2B",
  green: "#2E6B4E",
  muted: "#66786E",
  border: "#D8E2D3",
  background: "#F6F8F4",
  white: "#FFFFFF",
  previous: "#3E6FA3",
  latest: "#2E6B4E",
  danger: "#B54747",
};

const PANEL_STYLE = {
  background: COLORS.white,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 16,
  padding: 24,
  marginBottom: 20,
};

const CELL_STYLE = {
  padding: "13px 14px",
  borderBottom: `1px solid ${COLORS.border}`,
  fontSize: 14,
  whiteSpace: "nowrap",
};

const TABLE_STYLE = {
  width: "100%",
  borderCollapse: "collapse",
};

const HEADING_STYLE = {
  padding: "13px 14px",
  background: COLORS.forest,
  color: COLORS.white,
  textAlign: "left",
  fontSize: 13,
  whiteSpace: "nowrap",
};

function addDays(isoDate, days) {
  if (!isoDate) return null;

  const date = new Date(
    `${isoDate}T12:00:00Z`
  );

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setUTCDate(
    date.getUTCDate() + days
  );

  return date.toISOString().slice(0, 10);
}

function formatDate(isoDate) {
  if (!isoDate) return "—";

  const date = new Date(
    `${isoDate}T12:00:00Z`
  );

  if (Number.isNaN(date.getTime())) {
    return String(isoDate);
  }

  return date.toLocaleDateString(
    "en-GB",
    {
      timeZone: "UTC",
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
}

function formatWeek(weekStart) {
  return (
    `${formatDate(weekStart)} – ` +
    formatDate(addDays(weekStart, 6))
  );
}

function formatNumber(value, digits = 2) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    !Number.isFinite(Number(value))
  ) {
    return "—";
  }

  return Number(value).toLocaleString(
    "en-GB",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    }
  );
}

function formatKg(value) {
  const formatted = formatNumber(value);

  return formatted === "—"
    ? "—"
    : `${formatted} kg`;
}

function formatSignedKg(value) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return (
    `${value > 0 ? "+" : ""}` +
    formatKg(value)
  );
}

function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return (
    `${value > 0 ? "+" : ""}` +
    `${formatNumber(value)}%`
  );
}

function percentageChange(previous, latest) {
  if (
    !Number.isFinite(previous) ||
    !Number.isFinite(latest) ||
    previous === 0
  ) {
    return null;
  }

  return (
    ((latest - previous) / previous) * 100
  );
}

function getErrorMessage(error) {
  return (
    error?.message ||
    "Unable to retrieve forecast comparison data."
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
        : `Unable to retrieve forecasts for ${formatDate(origin)}.`
    );
  }

  if (
    result.status !== "success" ||
    result.available !== true
  ) {
    throw new Error(
      `No saved forecast is available for ${formatDate(origin)}.`
    );
  }

  if (result.forecast_origin !== origin) {
    throw new Error(
      "The backend returned forecasts for an incorrect reporting week."
    );
  }

  if (
    !Number.isInteger(result.revision) ||
    result.revision < 0
  ) {
    throw new Error(
      "The saved forecast revision is invalid."
    );
  }

  if (
    !result.forecasts ||
    typeof result.forecasts !== "object"
  ) {
    throw new Error(
      "The forecast response is incomplete."
    );
  }

  for (const grade of EIGHT_INPUT_GRADES) {
    const record = result.forecasts[grade];

    if (
      !record ||
      record.finalized !== true ||
      record.tea_type !== grade ||
      record.forecast_origin !== origin ||
      !Array.isArray(record.forecasts) ||
      record.forecasts.length !== 4
    ) {
      throw new Error(
        `The saved ${grade} forecast for ` +
        `${formatDate(origin)} is incomplete.`
      );
    }

    for (
      let index = 0;
      index < 4;
      index += 1
    ) {
      const prediction =
        record.forecasts[index];

      const expectedDate = addDays(
        origin,
        (index + 1) * 7
      );

      if (
        prediction?.week !== expectedDate ||
        Number(prediction?.horizon) !==
          index + 1
      ) {
        throw new Error(
          `The ${grade} forecast dates do not match the reporting week.`
        );
      }

      const lower =
        prediction.lower_demand_kg;

      const median =
        prediction.median_demand_kg;

      const upper =
        prediction.upper_demand_kg;

      if (
        lower === null ||
        lower === undefined ||
        median === null ||
        median === undefined ||
        upper === null ||
        upper === undefined
      ) {
        throw new Error(
          `The ${grade} forecast contains missing demand values.`
        );
      }

      const values = [
        Number(lower),
        Number(median),
        Number(upper),
      ];

      if (
        !values.every(Number.isFinite) ||
        values[0] < 0 ||
        values[0] > values[1] ||
        values[1] > values[2]
      ) {
        throw new Error(
          `The ${grade} forecast contains invalid demand estimates.`
        );
      }
    }
  }

  return result;
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
            fontSize: 19,
            color: COLORS.forest,
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

function StatusMessage({
  type = "warning",
  children,
}) {
  const success = type === "success";

  return (
    <div
      role={success ? "status" : "alert"}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "13px 15px",
        marginBottom: 20,
        borderRadius: 10,
        color: success
          ? COLORS.green
          : COLORS.danger,
        background: success
          ? "#EDF8F1"
          : "#FFF1F1",
      }}
    >
      {success ? (
        <CheckCircle2
          size={19}
          style={{ flexShrink: 0 }}
        />
      ) : (
        <AlertCircle
          size={19}
          style={{ flexShrink: 0 }}
        />
      )}

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
        background: COLORS.white,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
        padding: 18,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: COLORS.muted,
          marginBottom: 10,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: COLORS.forest,
        }}
      >
        {value}
      </div>

      {description && (
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: COLORS.muted,
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
        marginBottom: 20,
      }}
    >
      {EIGHT_INPUT_GRADES.map(
        (grade) => {
          const active =
            grade === selected;

          return (
            <button
              key={grade}
              type="button"
              onClick={() =>
                onChange(grade)
              }
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
        }
      )}
    </div>
  );
}

function ComparisonTable({
  headings,
  children,
  minWidth = 760,
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          ...TABLE_STYLE,
          minWidth,
        }}
      >
        <thead>
          <tr>
            {headings.map(
              (heading) => (
                <th
                  key={heading}
                  style={HEADING_STYLE}
                >
                  {heading}
                </th>
              )
            )}
          </tr>
        </thead>

        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function getWeeklyComparison(
  previousRecord,
  latestRecord,
  week
) {
  const previousPrediction =
    previousRecord?.forecasts?.find(
      (item) => item.week === week
    );

  const latestPrediction =
    latestRecord?.forecasts?.find(
      (item) => item.week === week
    );

  if (
    !previousPrediction ||
    !latestPrediction
  ) {
    return null;
  }

  const previous = Number(
    previousPrediction.median_demand_kg
  );

  const latest = Number(
    latestPrediction.median_demand_kg
  );

  return {
    week,
    previousHorizon:
      previousPrediction.horizon,
    latestHorizon:
      latestPrediction.horizon,
    previous,
    latest,
    previousLower: Number(
      previousPrediction.lower_demand_kg
    ),
    previousUpper: Number(
      previousPrediction.upper_demand_kg
    ),
    latestLower: Number(
      latestPrediction.lower_demand_kg
    ),
    latestUpper: Number(
      latestPrediction.upper_demand_kg
    ),
    difference: latest - previous,
    percentage: percentageChange(
      previous,
      latest
    ),
  };
}

export default function DemandForecastComparison() {
  const [
    selectedGrade,
    setSelectedGrade,
  ] = useState(EIGHT_INPUT_GRADES[0]);

  const [
    previousForecast,
    setPreviousForecast,
  ] = useState(null);

  const [
    latestForecast,
    setLatestForecast,
  ] = useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const requestId = useRef(0);

  const loadComparison = useCallback(
    async () => {
      const request =
        ++requestId.current;

      setLoading(true);
      setError("");

      try {
        const [previous, latest] =
          await Promise.all([
            getLatestSavedForecast(
              PREVIOUS_ORIGIN
            ),
            getLatestSavedForecast(
              LATEST_ORIGIN
            ),
          ]);

        if (
          request !== requestId.current
        ) {
          return;
        }

        setPreviousForecast(previous);
        setLatestForecast(latest);
      } catch (caughtError) {
        if (
          request !== requestId.current
        ) {
          return;
        }

        setPreviousForecast(null);
        setLatestForecast(null);

        setError(
          getErrorMessage(caughtError)
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
    loadComparison();

    return () => {
      requestId.current += 1;
    };
  }, [loadComparison]);

  const weeklyComparison = useMemo(() => {
    if (
      !previousForecast ||
      !latestForecast
    ) {
      return [];
    }

    const previousRecord =
      previousForecast.forecasts[
        selectedGrade
      ];

    const latestRecord =
      latestForecast.forecasts[
        selectedGrade
      ];

    return COMPARISON_WEEKS.map(
      (week) =>
        getWeeklyComparison(
          previousRecord,
          latestRecord,
          week
        )
    );
  }, [
    previousForecast,
    latestForecast,
    selectedGrade,
  ]);

  const chartData = useMemo(
    () =>
      weeklyComparison
        .filter(Boolean)
        .map((item) => ({
          week: formatWeek(item.week),
          Previous: item.previous,
          Latest: item.latest,
        })),
    [weeklyComparison]
  );

  const allGradeComparisons = useMemo(() => {
    if (
      !previousForecast ||
      !latestForecast
    ) {
      return {};
    }

    const result = {};

    for (
      const week of COMPARISON_WEEKS
    ) {
      result[week] =
        EIGHT_INPUT_GRADES.map(
          (grade) => {
            const previousRecord =
              previousForecast
                .forecasts[grade];

            const latestRecord =
              latestForecast
                .forecasts[grade];

            const comparison =
              getWeeklyComparison(
                previousRecord,
                latestRecord,
                week
              );

            return comparison
              ? {
                  grade,
                  ...comparison,
                }
              : null;
          }
        ).filter(Boolean);
    }

    return result;
  }, [
    previousForecast,
    latestForecast,
  ]);

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
        style={{
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          justifyContent:
            "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <h1>
          Demand Forecast Comparison
        </h1>

        <button
          type="button"
          onClick={loadComparison}
          disabled={loading}
          aria-label="Refresh comparison"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            background: COLORS.white,
            border:
              `1px solid ${COLORS.border}`,
            borderRadius: 9,
            color: COLORS.forest,
            cursor: loading
              ? "not-allowed"
              : "pointer",
          }}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && (
        <StatusMessage>
          {error}
        </StatusMessage>
      )}

      {loading && (
        <p
          style={{
            color: COLORS.muted,
          }}
        >
          Loading saved forecasts...
        </p>
      )}

      {!loading &&
        previousForecast &&
        latestForecast && (
          <>
            <Panel
              title="Demand Comparison"
              icon={TrendingUp}
            >
              <GradeTabs
                selected={selectedGrade}
                onChange={setSelectedGrade}
              />

              <div
                style={{
                  width: "100%",
                  height: 300,
                  marginBottom: 8,
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
                      left: 15,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                    />

                    <XAxis
                      dataKey="week"
                      tick={{
                        fontSize: 11,
                      }}
                    />

                    <YAxis
                      tickFormatter={(value) =>
                        `${formatNumber(
                          value / 1000,
                          1
                        )}k`
                      }
                    />

                    <Tooltip
                      formatter={(
                        value,
                        name
                      ) => [
                        formatKg(value),
                        name,
                      ]}
                    />

                    <Legend />

                    <Line
                      type="monotone"
                      dataKey="Previous"
                      name="Previous Forecast"
                      stroke={
                        COLORS.previous
                      }
                      strokeWidth={3}
                      dot={{ r: 6 }}
                    />

                    <Line
                      type="monotone"
                      dataKey="Latest"
                      name="Latest Forecast"
                      stroke={
                        COLORS.latest
                      }
                      strokeWidth={3}
                      dot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            {COMPARISON_WEEKS.map(
              (week, index) => {
                const comparison =
                  weeklyComparison[index];

                return (
                  <React.Fragment
                    key={week}
                  >
                    <Panel
                      title={
                        `Week ${index + 1} — ` +
                        formatWeek(week)
                      }
                      icon={CalendarDays}
                    >
                      {!comparison ? (
                        <StatusMessage>
                          Saved forecasts for
                          this week are
                          unavailable.
                        </StatusMessage>
                      ) : (
                        <>
                          <div
                            style={{
                              display:
                                "grid",
                              gridTemplateColumns:
                                "repeat(auto-fit, minmax(190px, 1fr))",
                              gap: 14,
                              marginBottom:
                                22,
                            }}
                          >
                            <SummaryCard
                              label="Previous Expected Demand"
                              value={formatKg(
                                comparison.previous
                              )}
                              description={
                                `Forecast Week ` +
                                comparison.previousHorizon
                              }
                            />

                            <SummaryCard
                              label="Latest Expected Demand"
                              value={formatKg(
                                comparison.latest
                              )}
                              description={
                                `Forecast Week ` +
                                comparison.latestHorizon
                              }
                            />

                            <SummaryCard
                              label="Demand Difference"
                              value={formatSignedKg(
                                comparison.difference
                              )}
                            />

                            <SummaryCard
                              label="Percentage Change"
                              value={formatPercent(
                                comparison.percentage
                              )}
                            />
                          </div>

                          <ComparisonTable
                            headings={[
                              "Forecast",
                              "Lower Demand",
                              "Expected Demand",
                              "Upper Demand",
                            ]}
                            minWidth={680}
                          >
                            <tr>
                              <td
                                style={
                                  CELL_STYLE
                                }
                              >
                                Previous Forecast
                              </td>

                              <td
                                style={
                                  CELL_STYLE
                                }
                              >
                                {formatKg(
                                  comparison.previousLower
                                )}
                              </td>

                              <td
                                style={
                                  CELL_STYLE
                                }
                              >
                                {formatKg(
                                  comparison.previous
                                )}
                              </td>

                              <td
                                style={
                                  CELL_STYLE
                                }
                              >
                                {formatKg(
                                  comparison.previousUpper
                                )}
                              </td>
                            </tr>

                            <tr>
                              <td
                                style={
                                  CELL_STYLE
                                }
                              >
                                Latest Forecast
                              </td>

                              <td
                                style={
                                  CELL_STYLE
                                }
                              >
                                {formatKg(
                                  comparison.latestLower
                                )}
                              </td>

                              <td
                                style={{
                                  ...CELL_STYLE,
                                  fontWeight:
                                    700,
                                  color:
                                    COLORS.forest,
                                }}
                              >
                                {formatKg(
                                  comparison.latest
                                )}
                              </td>

                              <td
                                style={
                                  CELL_STYLE
                                }
                              >
                                {formatKg(
                                  comparison.latestUpper
                                )}
                              </td>
                            </tr>
                          </ComparisonTable>
                        </>
                      )}
                    </Panel>
                  </React.Fragment>
                );
              }
            )}

            {COMPARISON_WEEKS.map(
              (week, index) => (
                <Panel
                  key={`all-${week}`}
                  title={
                    `All Tea Grades — ` +
                    formatWeek(week)
                  }
                  icon={ArrowRight}
                >
                  <ComparisonTable
                    headings={[
                      "Tea Grade",
                      "Previous Expected",
                      "Latest Expected",
                      "Difference (kg)",
                      "Change (%)",
                    ]}
                    minWidth={760}
                  >
                    {(
                      allGradeComparisons[
                        week
                      ] || []
                    ).map(
                      (item) => (
                        <tr
                          key={item.grade}
                        >
                          <td
                            style={{
                              ...CELL_STYLE,
                              fontWeight:
                                700,
                              color:
                                COLORS.forest,
                            }}
                          >
                            {item.grade}
                          </td>

                          <td
                            style={
                              CELL_STYLE
                            }
                          >
                            {formatKg(
                              item.previous
                            )}
                          </td>

                          <td
                            style={
                              CELL_STYLE
                            }
                          >
                            {formatKg(
                              item.latest
                            )}
                          </td>

                          <td
                            style={
                              CELL_STYLE
                            }
                          >
                            {formatSignedKg(
                              item.difference
                            )}
                          </td>

                          <td
                            style={
                              CELL_STYLE
                            }
                          >
                            {formatPercent(
                              item.percentage
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </ComparisonTable>
                </Panel>
              )
            )}
          </>
        )}
    </div>
  );
}
