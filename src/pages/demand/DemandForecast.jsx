
import { useEffect, useMemo, useRef, useState } from "react";

import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Database,
  Leaf,
  LineChart as LineChartIcon,
  RefreshCw,
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
  SIX_INPUT_TEA_GRADES,
  generateSixInputTFTForecast,
  formatSixInputDate,
  formatSixInputDemand,
} from "../../services/sixInputForecastService";

import {
  getSixInputFactoryStatus,
  getSixInputHistoricalWeek,
} from "../../services/sixInputObservationService";

const COLORS = {
  forest: "#153D2B",
  green: "#2E6B4E",
  gold: "#C8A45D",
  ivory: "#F5F3E9",
  white: "#FFFFFF",
  muted: "#63756A",
  border: "#D8E2D3",
};

const GRADE_COLORS = {
  BOP: "#215C43",
  BOPF: "#B38D42",
  Dust: "#347DA1",
  OP: "#8659A7",
  Pekoe: "#C36D45",
};

const DEFAULT_WEEK = "2026-10-05";

function getTodayString() {
  const today = new Date();

  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

function addDays(value, days) {
  if (!value) return "";

  const date = new Date(`${value}T12:00:00Z`);

  if (Number.isNaN(date.getTime())) return "";

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function latestCompletedMonday() {
  const today = new Date();

  const daysSinceMonday = (today.getDay() + 6) % 7;

  const lastMonday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - daysSinceMonday - 7
  );

  return [
    lastMonday.getFullYear(),
    String(lastMonday.getMonth() + 1).padStart(2, "0"),
    String(lastMonday.getDate()).padStart(2, "0"),
  ].join("-");
}

function isValidCompletedWeek(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(`${value}T12:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    date.getUTCDay() === 1 &&
    addDays(value, 6) < getTodayString()
  );
}

function Panel({ title, icon: Icon, children }) {
  return (
    <section
      style={{
        background: COLORS.white,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 18,
        padding: 24,
        marginBottom: 20,
        boxShadow: "0 4px 18px rgba(21,61,43,0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <Icon size={22} color={COLORS.green} />

        <h2
          style={{
            margin: 0,
            color: COLORS.forest,
            fontSize: "1.15rem",
          }}
        >
          {title}
        </h2>
      </div>

      {children}
    </section>
  );
}

function StatCard({ label, value }) {
  return (
    <div
      style={{
        background: COLORS.ivory,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div
        style={{
          color: COLORS.muted,
          fontSize: 12,
          marginBottom: 8,
        }}
      >
        {label}
      </div>

      <strong
        style={{
          color: COLORS.forest,
          fontSize: 18,
        }}
      >
        {value}
      </strong>
    </div>
  );
}

export default function DemandForecast() {
  const [factoryStatus, setFactoryStatus] =
    useState(null);

  const [weekStartDate, setWeekStartDate] =
    useState(DEFAULT_WEEK);

  const [historicalRecords, setHistoricalRecords] =
    useState([]);

  const [selectedGrades, setSelectedGrades] =
    useState(["BOP"]);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [error, setError] = useState("");
  const [forecast, setForecast] = useState(null);

  const requestId = useRef(0);

  const firstWeek =
    factoryStatus?.csv_first_week || "2021-01-04";

  const maximumWeek = latestCompletedMonday();

  const availableGrades = useMemo(
    () =>
      historicalRecords.map(
        (record) => record.tea_type
      ),
    [historicalRecords]
  );

  const selectedAvailableGrades = useMemo(
    () =>
      selectedGrades.filter((grade) =>
        availableGrades.includes(grade)
      ),
    [selectedGrades, availableGrades]
  );

  const chartData = useMemo(() => {
    if (!forecast) return [];

    return [0, 1, 2, 3].map((index) => {
      const firstGrade = forecast.selected_grades[0];

      const firstWeekForecast =
        forecast.forecasts[firstGrade][index];

      const point = {
        week: `Week ${index + 1}`,
        date: firstWeekForecast.week,
      };

      for (const grade of forecast.selected_grades) {
        point[grade] =
          forecast.forecasts[grade][index]
            .median_demand_kg;
      }

      return point;
    });
  }, [forecast]);

  async function loadHistoricalWeek(
    selectedWeek,
    currentRequest
  ) {
    const result = await getSixInputHistoricalWeek(
      selectedWeek
    );

    if (currentRequest !== requestId.current) {
      return;
    }

    setHistoricalRecords(result.records);

    setSelectedGrades((current) => {
      const supported = current.filter((grade) =>
        result.selected_grades.includes(grade)
      );

      if (supported.length > 0) return supported;

      const preferred = result.selected_grades.includes(
        "BOP"
      )
        ? "BOP"
        : result.selected_grades[0];

      return preferred ? [preferred] : [];
    });
  }

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      const currentRequest = ++requestId.current;

      try {
        const status = await getSixInputFactoryStatus();

        if (
          !mounted ||
          currentRequest !== requestId.current
        ) {
          return;
        }

        setFactoryStatus(status);

        const initialWeek =
          status.latest_saved_week ||
          status.csv_latest_week ||
          DEFAULT_WEEK;

        setWeekStartDate(initialWeek);

        await loadHistoricalWeek(
          initialWeek,
          currentRequest
        );
      } catch (err) {
        if (
          mounted &&
          currentRequest === requestId.current
        ) {
          setError(
            err.message ||
              "Unable to load recorded factory data."
          );
        }
      } finally {
        if (
          mounted &&
          currentRequest === requestId.current
        ) {
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      mounted = false;
      requestId.current += 1;
    };
  }, []);

  async function changeWeek(nextWeek) {
    const currentRequest = ++requestId.current;

    setWeekStartDate(nextWeek);
    setHistoricalRecords([]);
    setForecast(null);
    setError("");

    if (
      !isValidCompletedWeek(nextWeek) ||
      nextWeek < firstWeek
    ) {
      setError(
        "Select a completed reporting week starting on Monday."
      );
      return;
    }

    setLoading(true);

    try {
      await loadHistoricalWeek(
        nextWeek,
        currentRequest
      );
    } catch (err) {
      if (currentRequest === requestId.current) {
        setError(
          err.message ||
            "Unable to retrieve factory observations."
        );
      }
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
      }
    }
  }

  function toggleGrade(grade) {
    if (!availableGrades.includes(grade)) return;

    setSelectedGrades((current) =>
      current.includes(grade)
        ? current.filter((item) => item !== grade)
        : SIX_INPUT_TEA_GRADES.filter(
            (item) =>
              item === grade || current.includes(item)
          )
    );

    setForecast(null);
    setError("");
  }

  async function generateForecast() {
    setError("");
    setForecast(null);

    if (!isValidCompletedWeek(weekStartDate)) {
      setError(
        "Choose a completed Monday-to-Sunday reporting week."
      );
      return;
    }

    if (selectedAvailableGrades.length === 0) {
      setError(
        "Select at least one grade with recorded observations."
      );
      return;
    }

    const records = selectedAvailableGrades.map(
      (grade) => {
        const historical = historicalRecords.find(
          (record) => record.tea_type === grade
        );

        return {
          ...historical,
        };
      }
    );

    const payload = {
      week_start_date: weekStartDate,
      records,
    };

    setGenerating(true);

    try {
      const result =
        await generateSixInputTFTForecast(payload);

      setForecast(result);
    } catch (err) {
      setError(
        err.message ||
          "Unable to generate the demand forecast."
      );
    } finally {
      setGenerating(false);
    }
  }

  const controlsDisabled = loading || generating;

  return (
    <div
      className="demand-page"
      style={{
        background: COLORS.ivory,
        minHeight: "100vh",
        paddingBottom: 32,
      }}
    >
      <div className="demand-page-header">
        <span className="demand-page-label">
          PREMIUM CEYLON TEA
        </span>

        <h1>Demand Forecast</h1>

        <p>
          Generate four-week tea demand forecasts using
          recorded factory observations and the frozen
          six-input Temporal Fusion Transformer.
        </p>
      </div>

      {error && (
        <div
          className="demand-error-message"
          role="alert"
          style={{ marginBottom: 20 }}
        >
          <AlertTriangle
            size={17}
            style={{ marginRight: 8 }}
          />
          {error}
        </div>
      )}

      <div style={{ maxWidth: 1150 }}>
        <Panel
          title="1. Select Forecast Origin"
          icon={CalendarDays}
        >
          <label
            htmlFor="forecast-week"
            style={{
              display: "block",
              color: COLORS.forest,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Recorded reporting week
          </label>

          <input
            id="forecast-week"
            type="date"
            className="demand-input"
            value={weekStartDate}
            min={firstWeek}
            max={maximumWeek}
            disabled={controlsDisabled}
            onChange={(event) =>
              changeWeek(event.target.value)
            }
            style={{ maxWidth: 300 }}
          />

          <p
            style={{
              marginTop: 12,
              color: COLORS.muted,
              fontSize: 13,
              lineHeight: 1.7,
            }}
          >
            Only completed reporting weeks with
            recorded observations can be used.
            Future values are predicted by the model,
            not entered manually.
          </p>

          {loading ? (
            <p style={{ color: COLORS.muted }}>
              Loading factory observations...
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(190px, 1fr))",
                gap: 12,
                marginTop: 18,
              }}
            >
              <StatCard
                label="Forecast Origin"
                value={formatSixInputDate(
                  weekStartDate
                )}
              />

              <StatCard
                label="Recorded Grades"
                value={availableGrades.length}
              />

              <StatCard
                label="Forecast Horizon"
                value="4 Weeks"
              />
            </div>
          )}
        </Panel>

        <Panel title="2. Select Tea Grades" icon={Leaf}>
          <p
            style={{
              color: COLORS.muted,
              marginTop: 0,
            }}
          >
            Select the tea grades you want to forecast.
            Only grades with recorded values for the
            selected week are available.
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            {SIX_INPUT_TEA_GRADES.map((grade) => {
              const available =
                availableGrades.includes(grade);

              const selected =
                selectedGrades.includes(grade);

              return (
                <label
                  key={grade}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    padding: "12px 17px",
                    borderRadius: 12,
                    border: `1px solid ${
                      selected
                        ? COLORS.forest
                        : COLORS.border
                    }`,
                    background: selected
                      ? COLORS.forest
                      : COLORS.white,
                    color: selected
                      ? COLORS.white
                      : COLORS.forest,
                    fontWeight: 600,
                    cursor: available
                      ? "pointer"
                      : "not-allowed",
                    opacity: available ? 1 : 0.45,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected && available}
                    disabled={
                      controlsDisabled || !available
                    }
                    onChange={() =>
                      toggleGrade(grade)
                    }
                    style={{
                      accentColor: COLORS.gold,
                    }}
                  />
                  {grade}

                  {available && (
                    <CheckCircle2
                      size={15}
                      color={
                        selected
                          ? COLORS.gold
                          : COLORS.green
                      }
                    />
                  )}
                </label>
              );
            })}
          </div>

          {!loading && availableGrades.length === 0 && (
            <p
              style={{
                color: COLORS.muted,
                marginTop: 16,
              }}
            >
              No observations are recorded for this
              week. Enter and save actual factory
              values on the Weekly Data Entry page
              before generating forecasts.
            </p>
          )}
        </Panel>

        <Panel
          title="3. Generate Four-Week Forecast"
          icon={LineChartIcon}
        >
          <p
            style={{
              color: COLORS.muted,
              lineHeight: 1.7,
            }}
          >
            The model uses the latest 52 consecutive
            historical weeks for each selected grade,
            including saved MongoDB observations when
            available. Predictions are generated for
            the following four weeks.
          </p>

          <button
            type="button"
            className="demand-save-btn"
            disabled={
              controlsDisabled ||
              selectedAvailableGrades.length === 0 ||
              !isValidCompletedWeek(weekStartDate)
            }
            onClick={generateForecast}
          >
            {generating ? (
              <RefreshCw size={18} />
            ) : (
              <LineChartIcon size={18} />
            )}

            {generating
              ? "Generating Forecast..."
              : "Generate TFT Forecast"}
          </button>

          <p
            style={{
              color: COLORS.muted,
              fontSize: 12,
              marginTop: 14,
            }}
          >
            Forecast generation does not save
            predictions or retrain the model.
          </p>
        </Panel>

        {forecast && (
          <>
            <Panel
              title="4. Forecast Overview"
              icon={CheckCircle2}
            >
              <div
                className="demand-success-message"
                role="status"
                style={{ marginBottom: 18 }}
              >
                Forecasts generated successfully for{" "}
                {forecast.selected_grades.join(", ")}.
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(190px, 1fr))",
                  gap: 12,
                }}
              >
                <StatCard
                  label="Forecast Origin"
                  value={formatSixInputDate(
                    forecast.forecast_origin
                  )}
                />

                <StatCard
                  label="Tea Grades"
                  value={
                    forecast.selected_grades.length
                  }
                />

                <StatCard
                  label="Forecast Predictions"
                  value={forecast.forecast_count}
                />

                <StatCard
                  label="Forecast Type"
                  value={
                    forecast.forecast_type ===
                    "historical_replay"
                      ? "Historical Replay"
                      : "Latest Recorded Week"
                  }
                />
              </div>
            </Panel>

            <Panel
              title="5. Predicted Demand Chart"
              icon={LineChartIcon}
            >
              <p
                style={{
                  color: COLORS.muted,
                  marginTop: 0,
                }}
              >
                Median predicted weekly tea demand
                (P50), measured in kilograms.
              </p>

              <div style={{ height: 350 }}>
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
                      bottom: 10,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                    />

                    <XAxis dataKey="week" />

                    <YAxis
                      tickFormatter={(value) =>
                        Number(value).toLocaleString()
                      }
                    />

                    <Tooltip
                      formatter={(value) => [
                        `${formatSixInputDemand(
                          value
                        )} kg`,
                        "Predicted Demand",
                      ]}
                      labelFormatter={(label, payload) => {
                        const date =
                          payload?.[0]?.payload?.date;

                        return date
                          ? `${label} — ${formatSixInputDate(
                              date
                            )}`
                          : label;
                      }}
                    />

                    <Legend />

                    {forecast.selected_grades.map(
                      (grade) => (
                        <Line
                          key={grade}
                          type="monotone"
                          dataKey={grade}
                          name={grade}
                          stroke={GRADE_COLORS[grade]}
                          strokeWidth={3}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      )
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel
              title="6. Four-Week Demand Predictions"
              icon={Database}
            >
              {forecast.selected_grades.map(
                (grade) => (
                  <div
                    key={grade}
                    style={{ marginBottom: 28 }}
                  >
                    <h3
                      style={{
                        color: COLORS.forest,
                        marginBottom: 14,
                      }}
                    >
                      {grade} — Predicted Demand
                    </h3>

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
                        }}
                      >
                        <thead>
                          <tr
                            style={{
                              background:
                                COLORS.forest,
                              color: COLORS.white,
                            }}
                          >
                            {[
                              "Forecast Week",
                              "P10 (kg)",
                              "P50 (kg)",
                              "P90 (kg)",
                            ].map((heading) => (
                              <th
                                key={heading}
                                style={{
                                  padding: 13,
                                }}
                              >
                                {heading}
                              </th>
                            ))}
                          </tr>
                        </thead>

                        <tbody>
                          {forecast.forecasts[
                            grade
                          ].map((week) => (
                            <tr
                              key={week.week}
                              style={{
                                borderBottom:
                                  `1px solid ${COLORS.border}`,
                              }}
                            >
                              <td
                                style={{
                                  padding: 13,
                                }}
                              >
                                {formatSixInputDate(
                                  week.week
                                )}
                              </td>

                              <td
                                style={{
                                  padding: 13,
                                }}
                              >
                                {formatSixInputDemand(
                                  week.lower_demand_kg
                                )}
                              </td>

                              <td
                                style={{
                                  padding: 13,
                                  fontWeight: 700,
                                  color:
                                    COLORS.forest,
                                }}
                              >
                                {formatSixInputDemand(
                                  week.median_demand_kg
                                )}
                              </td>

                              <td
                                style={{
                                  padding: 13,
                                }}
                              >
                                {formatSixInputDemand(
                                  week.upper_demand_kg
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              )}

              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  background: COLORS.ivory,
                  color: COLORS.muted,
                  fontSize: 13,
                  lineHeight: 1.7,
                }}
              >
                <strong>Understanding the forecast:</strong>{" "}
                P50 is the median predicted demand.
                P10 and P90 represent the lower and
                upper model prediction quantiles.
                The P10–P90 interval is intended as
                an 80% prediction interval, but
                actual coverage is not guaranteed.
                Predictions are not actual factory
                observations.
              </div>
            </Panel>
          </>
        )}
      </div>
    </div>
  );
}
