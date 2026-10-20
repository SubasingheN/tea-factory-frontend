
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Database,
  History,
  RefreshCw,
  Search,
  TrendingUp,
} from "lucide-react";

import {
  EIGHT_INPUT_GRADES,
  getEightInputForecastHistory,
} from "../../services/eightInputDataService";

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
  padding: "11px 12px",
  boxSizing: "border-box",
  background: COLORS.white,
  color: COLORS.forest,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 9,
  fontSize: 14,
};

const CELL_STYLE = {
  padding: "12px 13px",
  borderBottom: `1px solid ${COLORS.border}`,
  whiteSpace: "nowrap",
  fontSize: 13,
};

function formatDate(value) {
  if (!value) return "—";

  const text = String(value).slice(0, 10);
  const date = new Date(`${text}T12:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return text;
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatKg(value) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    !Number.isFinite(Number(value))
  ) {
    return "—";
  }

  return (
    Number(value).toLocaleString("en-GB", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " kg"
  );
}

function addDays(value, days) {
  if (!value) return "";

  const date = new Date(`${value}T12:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function getErrorMessage(error) {
  return (
    error?.message ||
    "Unable to load forecast history."
  );
}

function recordKey(record) {
  return `${record.forecast_origin}|${record.tea_type}`;
}

function recordCategory(record) {
  if (
    record.historical_backfill === true ||
    record.forecast_type === "historical_backfill"
  ) {
    return "historical";
  }

  if (
    record.operational_forecast === true &&
    record.model === "nine_input_tft" &&
    record.model_version === "production_v1"
  ) {
    return "operational";
  }

  return "earlier";
}

function categoryLabel(category) {
  if (category === "operational") {
    return "Factory Forecast";
  }

  if (category === "historical") {
    return "Historical Backfill";
  }

  return "Earlier Saved Forecast";
}

function categoryDescription(category) {
  if (category === "operational") {
    return (
      "This forecast was finalized through the " +
      "factory's current forecasting workflow."
    );
  }

  if (category === "historical") {
    return (
      "This forecast was created retrospectively " +
      "and saved for historical reference. " +
      "It was not issued during its reporting week."
    );
  }

  return "";
}

function validateForecastRecord(record) {
  if (
    !record ||
    record.finalized !== true ||
    !EIGHT_INPUT_GRADES.includes(record.tea_type) ||
    !record.forecast_origin ||
    !Array.isArray(record.forecasts) ||
    record.forecasts.length !== 4
  ) {
    return false;
  }

  return record.forecasts.every((prediction, index) => {
    const lower = prediction?.lower_demand_kg;
    const median = prediction?.median_demand_kg;
    const upper = prediction?.upper_demand_kg;

    if (
      lower === null ||
      lower === undefined ||
      median === null ||
      median === undefined ||
      upper === null ||
      upper === undefined
    ) {
      return false;
    }

    const values = [
      Number(lower),
      Number(median),
      Number(upper),
    ];

    return (
      prediction.horizon === index + 1 &&
      prediction.week === addDays(
        record.forecast_origin,
        (index + 1) * 7
      ) &&
      values.every(Number.isFinite) &&
      values[0] >= 0 &&
      values[0] <= values[1] &&
      values[1] <= values[2]
    );
  });
}

function Panel({ title, icon: Icon, children, action }) {
  return (
    <section style={PANEL_STYLE}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <h2
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            margin: 0,
            color: COLORS.forest,
            fontSize: "1.15rem",
          }}
        >
          {Icon && (
            <Icon size={21} color={COLORS.green} />
          )}
          {title}
        </h2>

        {action}
      </div>

      {children}
    </section>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div
      style={{
        padding: 17,
        background: COLORS.ivory,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 14,
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
      }}
    >
      <Icon
        size={22}
        color={COLORS.green}
        style={{ flexShrink: 0 }}
      />

      <div>
        <div
          style={{
            fontSize: 12,
            color: COLORS.muted,
            marginBottom: 7,
          }}
        >
          {label}
        </div>

        <strong
          style={{
            display: "block",
            fontSize: 18,
            color: COLORS.forest,
          }}
        >
          {value}
        </strong>
      </div>
    </div>
  );
}

function DataTable({ headings, children }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          textAlign: "left",
          minWidth: 640,
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
                  padding: 13,
                  whiteSpace: "nowrap",
                  fontSize: 13,
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

export default function DemandHistory() {
  const [history, setHistory] = useState([]);
  const [selectedGrade, setSelectedGrade] = useState("All");
  const [selectedWeek, setSelectedWeek] = useState("");
  const [selectedType, setSelectedType] = useState("All");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response =
        await getEightInputForecastHistory(null, 500);

      if (!Array.isArray(response?.forecasts)) {
        throw new Error(
          "Forecast history returned an invalid response."
        );
      }

      const records = response.forecasts
        .filter(
          (record) =>
            record?.finalized === true &&
            EIGHT_INPUT_GRADES.includes(record.tea_type)
        )
        .sort((left, right) => {
          const dateOrder =
            right.forecast_origin.localeCompare(
              left.forecast_origin
            );

          if (dateOrder !== 0) {
            return dateOrder;
          }

          return (
            EIGHT_INPUT_GRADES.indexOf(left.tea_type) -
            EIGHT_INPUT_GRADES.indexOf(right.tea_type)
          );
        });

      setHistory(records);
    } catch (caughtError) {
      setHistory([]);
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const filteredHistory = useMemo(
    () =>
      history.filter((record) => {
        const matchesGrade =
          selectedGrade === "All" ||
          record.tea_type === selectedGrade;

        const matchesWeek =
          !selectedWeek ||
          record.forecast_origin === selectedWeek;

        const matchesType =
          selectedType === "All" ||
          recordCategory(record) === selectedType;

        return matchesGrade && matchesWeek && matchesType;
      }),
    [history, selectedGrade, selectedWeek, selectedType]
  );

  const selectedRecord = filteredHistory[0] || null;

  const selectedCategory = selectedRecord
    ? recordCategory(selectedRecord)
    : null;

  const selectedTotal = useMemo(() => {
    if (
      !selectedRecord ||
      !validateForecastRecord(selectedRecord)
    ) {
      return null;
    }

    return selectedRecord.forecasts.reduce(
      (total, prediction) =>
        total + Number(prediction.median_demand_kg),
      0
    );
  }, [selectedRecord]);

  function clearFilters() {
    setSelectedGrade("All");
    setSelectedWeek("");
    setSelectedType("All");
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
      <div className="demand-page-header">
        <h1>Forecast History</h1>
      </div>

      {error && (
        <div
          className="demand-error-message"
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 18,
          }}
        >
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      <div style={{ maxWidth: 1200 }}>
        <Panel
          title="Search Forecast History"
          icon={Search}
          action={
            <button
              type="button"
              className="demand-secondary-btn"
              disabled={loading}
              onClick={loadHistory}
            >
              <RefreshCw size={17} />
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          }
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-end",
              gap: 15,
            }}
          >
            <label
              style={{
                display: "grid",
                gap: 8,
                minWidth: 170,
                color: COLORS.forest,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Tea Grade

              <select
                value={selectedGrade}
                onChange={(event) =>
                  setSelectedGrade(event.target.value)
                }
                style={INPUT_STYLE}
              >
                <option value="All">All Tea Grades</option>

                {EIGHT_INPUT_GRADES.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </select>
            </label>

            <label
              style={{
                display: "grid",
                gap: 8,
                minWidth: 190,
                color: COLORS.forest,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Reporting Week

              <input
                type="date"
                value={selectedWeek}
                onChange={(event) =>
                  setSelectedWeek(event.target.value)
                }
                style={INPUT_STYLE}
              />
            </label>

            <label
              style={{
                display: "grid",
                gap: 8,
                minWidth: 200,
                color: COLORS.forest,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Forecast Type

              <select
                value={selectedType}
                onChange={(event) =>
                  setSelectedType(event.target.value)
                }
                style={INPUT_STYLE}
              >
                <option value="All">All Forecasts</option>
                <option value="operational">Factory Forecasts</option>
                <option value="historical">Historical Backfills</option>
                <option value="earlier">Earlier Saved Forecasts</option>
              </select>
            </label>

            <button
              type="button"
              className="demand-secondary-btn"
              onClick={clearFilters}
            >
              Clear Filters
            </button>
          </div>
        </Panel>

        {loading ? (
          <Panel title="Selected Forecast" icon={History}>
            <p style={{ color: COLORS.muted }}>
              Loading saved forecasts...
            </p>
          </Panel>
        ) : !selectedRecord ? (
          <Panel title="Selected Forecast" icon={History}>
            <p style={{ color: COLORS.muted }}>
              No matching forecast is available.
              Change the reporting week, tea grade,
              or forecast type to view another record.
            </p>
          </Panel>
        ) : (
          <Panel title="Selected Forecast" icon={TrendingUp}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
                marginBottom: 18,
                color: COLORS.forest,
                fontWeight: 600,
              }}
            >
              <CheckCircle2
                size={18}
                color={COLORS.green}
              />

              {selectedRecord.tea_type}

              {" — "}

              {formatDate(selectedRecord.forecast_origin)}

              {" — "}

              {categoryLabel(selectedCategory)}
            </div>

            {categoryDescription(selectedCategory) && (
              <p
                style={{
                  color: COLORS.muted,
                  fontSize: 13,
                  marginBottom: 18,
                }}
              >
                {categoryDescription(selectedCategory)}
              </p>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(185px, 1fr))",
                gap: 14,
                marginBottom: 22,
              }}
            >
              <StatCard
                icon={Database}
                label="Tea Grade"
                value={selectedRecord.tea_type}
              />

              <StatCard
                icon={CalendarDays}
                label="Reporting Week"
                value={formatDate(
                  selectedRecord.forecast_origin
                )}
              />

              <StatCard
                icon={CalendarDays}
                label="Forecast Start"
                value={formatDate(
                  addDays(selectedRecord.forecast_origin, 7)
                )}
              />

              <StatCard
                icon={TrendingUp}
                label="Four-Week Expected Demand"
                value={formatKg(selectedTotal)}
              />
            </div>

            {validateForecastRecord(selectedRecord) ? (
              <DataTable
                headings={[
                  "Forecast Week",
                  "Lower Demand",
                  "Expected Demand",
                  "Upper Demand",
                ]}
              >
                {selectedRecord.forecasts.map((prediction) => (
                  <tr key={prediction.week}>
                    <td style={CELL_STYLE}>
                      <strong>
                        Week {prediction.horizon}
                      </strong>

                      <div
                        style={{
                          fontSize: 12,
                          color: COLORS.muted,
                          marginTop: 4,
                        }}
                      >
                        {formatDate(prediction.week)}
                      </div>
                    </td>

                    <td style={CELL_STYLE}>
                      {formatKg(prediction.lower_demand_kg)}
                    </td>

                    <td
                      style={{
                        ...CELL_STYLE,
                        fontWeight: 700,
                        color: COLORS.forest,
                      }}
                    >
                      {formatKg(prediction.median_demand_kg)}
                    </td>

                    <td style={CELL_STYLE}>
                      {formatKg(prediction.upper_demand_kg)}
                    </td>
                  </tr>
                ))}
              </DataTable>
            ) : (
              <div
                role="alert"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  color: COLORS.danger,
                }}
              >
                <AlertTriangle size={18} />
                This forecast record is incomplete
                or invalid.
              </div>
            )}
          </Panel>
        )}
      </div>
    </div>
  );
}
