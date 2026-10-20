
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AlertTriangle,
  CalendarDays,
  History,
  TrendingUp,
} from "lucide-react";

import {
  EIGHT_INPUT_GRADES,
} from "../../services/eightInputDataService";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000"
).replace(/\/+$/, "");

const COLORS = {
  forest: "#153D2B",
  green: "#2E6B4E",
  ivory: "#F5F3E9",
  white: "#FFFFFF",
  muted: "#63756A",
  border: "#D8E2D3",
  danger: "#A73939",
};

const PANEL_STYLE = {
  padding: 24,
  background: COLORS.white,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 18,
  marginBottom: 20,
  boxShadow: "0 4px 18px rgba(21,61,43,0.04)",
};

const INPUT_STYLE = {
  width: "100%",
  padding: "12px 14px",
  boxSizing: "border-box",
  background: COLORS.white,
  color: COLORS.forest,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 9,
  fontSize: 14,
};

const CELL_STYLE = {
  padding: "12px 14px",
  borderBottom: `1px solid ${COLORS.border}`,
  whiteSpace: "nowrap",
  fontSize: 14,
};

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
  const number = formatNumber(value);

  return number === "—"
    ? "—"
    : `${number} kg`;
}

function revisionLabel(revision) {
  return revision === 0
    ? "Original Forecast"
    : `Revision ${revision}`;
}

function getLatestCompletedWeek() {
  const today = new Date();

  const localDate = new Date(
    Date.UTC(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    )
  );

  const day = localDate.getUTCDay();

  const daysSinceMonday =
    (day + 6) % 7;

  localDate.setUTCDate(
    localDate.getUTCDate() -
      daysSinceMonday -
      7
  );

  return localDate
    .toISOString()
    .slice(0, 10);
}

function getReportingWeeks() {
  const latestCompleted =
    getLatestCompletedWeek();

  return Array.from(
    { length: 4 },
    (_, index) =>
      addDays(
        latestCompleted,
        index * -7
      )
  );
}

function validateForecastRecord(
  record,
  origin,
  grade
) {
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
        !prediction ||
        prediction.week !==
          addDays(
            origin,
            (index + 1) * 7
          ) ||
        Number(prediction.horizon) !==
          index + 1
      ) {
        return false;
      }

      const values = [
        prediction.lower_demand_kg,
        prediction.median_demand_kg,
        prediction.upper_demand_kg,
      ];

      if (
        values.some(
          (value) =>
            value === null ||
            value === undefined ||
            value === ""
        )
      ) {
        return false;
      }

      const [
        lower,
        expected,
        upper,
      ] = values.map(Number);

      return (
        Number.isFinite(lower) &&
        Number.isFinite(expected) &&
        Number.isFinite(upper) &&
        lower >= 0 &&
        lower <= expected &&
        expected <= upper
      );
    }
  );
}

function getErrorMessage(error) {
  return (
    error?.message ||
    "Unable to retrieve saved forecasts."
  );
}

async function getForecastRevisions(origin) {
  const params = new URLSearchParams({
    origin,
  });

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
      typeof result?.detail === "string"
        ? result.detail
        : "Unable to retrieve saved forecast versions."
    );
  }

  if (
    result?.status !== "success" ||
    result.forecast_origin !== origin ||
    !Array.isArray(result.revisions)
  ) {
    throw new Error(
      "The saved forecast history response is invalid."
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
      <h2
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: 0,
          marginBottom: 20,
          fontSize: 19,
          color: COLORS.forest,
        }}
      >
        {Icon && (
          <Icon
            size={20}
            color={COLORS.green}
          />
        )}

        {title}
      </h2>

      {children}
    </section>
  );
}

function ForecastTable({ record }) {
  return (
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
            {[
              "Forecast Week",
              "Lower Demand",
              "Expected Demand",
              "Upper Demand",
            ].map((heading) => (
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

        <tbody>
          {record.forecasts.map(
            (prediction, index) => (
              <tr
                key={prediction.week}
              >
                <td style={CELL_STYLE}>
                  <strong>
                    Week {index + 1}
                  </strong>

                  <div
                    style={{
                      marginTop: 5,
                      fontSize: 12,
                      color: COLORS.muted,
                    }}
                  >
                    {formatWeek(
                      prediction.week
                    )}
                  </div>
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
  );
}

export default function DemandHistory() {
  const reportingWeeks = useMemo(
    () => getReportingWeeks(),
    []
  );

  const [
    selectedWeek,
    setSelectedWeek,
  ] = useState(
    reportingWeeks[0] || ""
  );

  const [
    revisionData,
    setRevisionData,
  ] = useState(null);

  const [
    selectedRevision,
    setSelectedRevision,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const requestId = useRef(0);

  useEffect(() => {
    const request =
      ++requestId.current;

    if (!selectedWeek) {
      setRevisionData(null);
      setSelectedRevision("");
      setLoading(false);
      return;
    }

    let active = true;

    async function loadRevisions() {
      setLoading(true);
      setError("");
      setRevisionData(null);
      setSelectedRevision("");

      try {
        const result =
          await getForecastRevisions(
            selectedWeek
          );

        if (
          !active ||
          request !== requestId.current
        ) {
          return;
        }

        const availableRevisions =
          result.revisions.filter(
            (revision) =>
              Number.isInteger(
                revision.revision
              ) &&
              revision.revision >= 0 &&
              revision.forecasts &&
              typeof revision.forecasts ===
                "object"
          );

        const cleanedResult = {
          ...result,
          revisions: availableRevisions,
        };

        setRevisionData(cleanedResult);

        if (
          availableRevisions.length > 0
        ) {
          const latest =
            availableRevisions.reduce(
              (max, item) =>
                Math.max(
                  max,
                  item.revision
                ),
              0
            );

          setSelectedRevision(
            String(latest)
          );
        }
      } catch (caughtError) {
        if (
          !active ||
          request !== requestId.current
        ) {
          return;
        }

        setRevisionData(null);
        setSelectedRevision("");

        setError(
          getErrorMessage(caughtError)
        );
      } finally {
        if (
          active &&
          request === requestId.current
        ) {
          setLoading(false);
        }
      }
    }

    loadRevisions();

    return () => {
      active = false;
      requestId.current += 1;
    };
  }, [selectedWeek]);

  const availableRevisions = useMemo(
    () =>
      [...(
        revisionData?.revisions || []
      )].sort(
        (left, right) =>
          right.revision - left.revision
      ),
    [revisionData]
  );

  const selectedRevisionGroup =
    useMemo(
      () =>
        availableRevisions.find(
          (item) =>
            String(item.revision) ===
            selectedRevision
        ) || null,
      [
        availableRevisions,
        selectedRevision,
      ]
    );

  const selectedForecasts =
    selectedRevisionGroup?.forecasts ||
    null;

  const hasCompleteForecast =
    Boolean(selectedForecasts) &&
    EIGHT_INPUT_GRADES.every(
      (grade) =>
        validateForecastRecord(
          selectedForecasts[grade],
          selectedWeek,
          grade
        )
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
          marginBottom: 20,
        }}
      >
        <h1>
          Demand Forecast History
        </h1>
      </div>

      <Panel
        title="Select Forecast"
        icon={History}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 18,
          }}
        >
          <label
            style={{
              display: "grid",
              gap: 9,
              fontSize: 13,
              fontWeight: 600,
              color: COLORS.forest,
            }}
          >
            Reporting Week

            <select
              value={selectedWeek}
              onChange={(event) =>
                setSelectedWeek(
                  event.target.value
                )
              }
              style={INPUT_STYLE}
            >
              {reportingWeeks.map(
                (week) => (
                  <option
                    key={week}
                    value={week}
                  >
                    {formatWeek(week)}
                  </option>
                )
              )}
            </select>
          </label>

          <label
            style={{
              display: "grid",
              gap: 9,
              fontSize: 13,
              fontWeight: 600,
              color: COLORS.forest,
            }}
          >
            Forecast Version

            <select
              value={selectedRevision}
              onChange={(event) =>
                setSelectedRevision(
                  event.target.value
                )
              }
              style={INPUT_STYLE}
              disabled={
                loading ||
                availableRevisions.length ===
                  0
              }
            >
              {loading ? (
                <option value="">
                  Loading versions...
                </option>
              ) : availableRevisions.length ===
                0 ? (
                <option value="">
                  No saved versions
                </option>
              ) : (
                availableRevisions.map(
                  (item, index) => (
                    <option
                      key={item.revision}
                      value={String(
                        item.revision
                      )}
                    >
                      {revisionLabel(
                        item.revision
                      )}
                      {index === 0
                        ? " — Latest"
                        : ""}
                    </option>
                  )
                )
              )}
            </select>
          </label>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              marginTop: 18,
              color: COLORS.danger,
              fontSize: 14,
            }}
          >
            <AlertTriangle
              size={18}
            />
            {error}
          </div>
        )}
      </Panel>

      <Panel
        title="Selected Forecast"
        icon={TrendingUp}
      >
        {loading ? (
          <p
            style={{
              color: COLORS.muted,
            }}
          >
            Loading saved forecast...
          </p>
        ) : !selectedRevisionGroup ? (
          <p
            style={{
              color: COLORS.muted,
            }}
          >
            No saved forecast is available
            for the selected reporting week.
          </p>
        ) : !hasCompleteForecast ? (
          <div
            role="alert"
            style={{
              display: "flex",
              gap: 9,
              color: COLORS.danger,
            }}
          >
            <AlertTriangle
              size={18}
            />
            The selected forecast is
            incomplete or unavailable.
          </div>
        ) : (
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
                marginBottom: 22,
                color: COLORS.muted,
                fontSize: 14,
              }}
            >
              <CalendarDays
                size={17}
              />

              <span>
                {formatWeek(
                  selectedWeek
                )}
              </span>

              <span>•</span>

              <strong
                style={{
                  color: COLORS.forest,
                }}
              >
                {revisionLabel(
                  selectedRevisionGroup.revision
                )}
              </strong>
            </div>

            {EIGHT_INPUT_GRADES.map(
              (grade) => {
                const record =
                  selectedForecasts[
                    grade
                  ];

                return (
                  <section
                    key={grade}
                    style={{
                      marginBottom: 26,
                    }}
                  >
                    <h3
                      style={{
                        color: COLORS.forest,
                        fontSize: 17,
                        marginTop: 0,
                        marginBottom: 13,
                      }}
                    >
                      {grade}
                    </h3>

                    <ForecastTable
                      record={record}
                    />
                  </section>
                );
              }
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
