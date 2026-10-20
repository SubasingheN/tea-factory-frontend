
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import {
  AlertCircle,
  CalendarDays,
  ChartNoAxesCombined,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  WandSparkles,
} from "lucide-react";

import {
  EIGHT_INPUT_GRADES,
  getEightInputFactoryStatus,
  getEightInputHistoricalWeek,
} from "../../services/eightInputDataService";

import {
  generateAndSaveEightInputForecasts,
} from "../../services/eightInputGenerateForecastService";

const FORECAST_ROUTE =
  "/tea-demand-forecasting/forecast";

const GRADE_FIELDS = [
  {
    key: "demand_kg",
    label: "Demand (kg)",
    min: 0.01,
    max: 100000,
  },
  {
    key: "production_kg",
    label: "Production (kg)",
    min: 0,
    max: 100000,
  },
  {
    key: "inventory_kg",
    label: "Inventory (kg)",
    min: 0,
    max: 100000,
  },
];

const EXCHANGE_FIELDS = [
  {
    key: "usd_lkr_monday_rate",
    label: "USD/LKR Monday Rate",
    min: 0.0001,
    max: 10000,
  },
  {
    key: "usd_lkr_sunday_rate",
    label: "USD/LKR Sunday Rate",
    min: 0.0001,
    max: 10000,
  },
];

const AUCTION_FIELDS = [
  {
    key: "auction_price_high_lkr",
    label: "High-Elevation Price (LKR)",
    min: 0.01,
    max: 100000,
  },
  {
    key: "auction_price_medium_lkr",
    label: "Medium-Elevation Price (LKR)",
    min: 0.01,
    max: 100000,
  },
  {
    key: "auction_price_low_lkr",
    label: "Low-Elevation Price (LKR)",
    min: 0.01,
    max: 100000,
  },
];

const SHARED_FIELDS = [
  ...EXCHANGE_FIELDS.map((field) => field.key),
  "festival_flag",
  ...AUCTION_FIELDS.map((field) => field.key),
];

const EMPTY_GRADE = {
  demand_kg: "",
  production_kg: "",
  inventory_kg: "",
};

const EMPTY_MARKET = {
  usd_lkr_monday_rate: "",
  usd_lkr_sunday_rate: "",
  festival_flag: "",
  auction_price_high_lkr: "",
  auction_price_medium_lkr: "",
  auction_price_low_lkr: "",
};

// Illustrative values for testing the user interface.
// These are NOT verified observations from a tea factory.
const SAMPLE_GRADES = {
  BOP: {
    demand_kg: "3850",
    production_kg: "4000",
    inventory_kg: "500",
  },
  BOPF: {
    demand_kg: "4450",
    production_kg: "4600",
    inventory_kg: "550",
  },
  Dust: {
    demand_kg: "6200",
    production_kg: "6350",
    inventory_kg: "700",
  },
  OP: {
    demand_kg: "2350",
    production_kg: "2450",
    inventory_kg: "350",
  },
  Pekoe: {
    demand_kg: "1550",
    production_kg: "1650",
    inventory_kg: "250",
  },
};

const SAMPLE_MARKET = {
  usd_lkr_monday_rate: "305.25",
  usd_lkr_sunday_rate: "306.10",
  festival_flag: "0",
  auction_price_high_lkr: "1750",
  auction_price_medium_lkr: "1550",
  auction_price_low_lkr: "1350",
};

const styles = {
  page: {
    minHeight: "100vh",
    background: "#F6F8F4",
    paddingBottom: 40,
  },
  section: {
    background: "#FFFFFF",
    border: "1px solid #DBE5DD",
    borderRadius: 14,
    padding: 22,
    marginBottom: 18,
  },
  sectionTitle: {
    margin: 0,
    color: "#193C2B",
    fontSize: 18,
    fontWeight: 700,
  },
  label: {
    display: "grid",
    gap: 8,
    color: "#193C2B",
    fontSize: 13,
    fontWeight: 600,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 12px",
    background: "#FFFFFF",
    border: "1px solid #CFDCD2",
    borderRadius: 9,
    color: "#193C2B",
    fontSize: 14,
  },
  grid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 16,
  },
  muted: {
    color: "#607369",
    fontSize: 13,
    lineHeight: 1.6,
  },
  buttonRow: {
    display: "flex",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 20,
  },
  table: {
    width: "100%",
    minWidth: 680,
    borderCollapse: "collapse",
    textAlign: "left",
  },
  tableHeading: {
    padding: "13px 14px",
    background: "#193C2B",
    color: "#FFFFFF",
    fontWeight: 700,
    fontSize: 13,
    whiteSpace: "nowrap",
  },
  tableCell: {
    padding: "11px 12px",
    borderBottom: "1px solid #E1E9E2",
  },
};

function emptyGrades() {
  return Object.fromEntries(
    EIGHT_INPUT_GRADES.map((grade) => [
      grade,
      { ...EMPTY_GRADE },
    ])
  );
}

function getSriLankaDate() {
  const parts = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Asia/Colombo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [
      part.type,
      part.value,
    ])
  );

  return [
    values.year,
    values.month,
    values.day,
  ].join("-");
}

function latestCompletedMonday() {
  const today = new Date(
    `${getSriLankaDate()}T12:00:00Z`
  );

  const daysSinceMonday =
    (today.getUTCDay() + 6) % 7;

  today.setUTCDate(
    today.getUTCDate() - daysSinceMonday - 7
  );

  return today.toISOString().slice(0, 10);
}

function addDays(isoDate, days) {
  const parsed = new Date(
    `${isoDate}T12:00:00Z`
  );

  parsed.setUTCDate(
    parsed.getUTCDate() + days
  );

  return parsed.toISOString().slice(0, 10);
}

function displayDate(value) {
  if (!value) return "—";

  const parsed = new Date(
    `${value}T12:00:00Z`
  );

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(
    "en-GB",
    {
      timeZone: "UTC",
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
}

function textValue(value) {
  return value === null ||
    value === undefined
    ? ""
    : String(value);
}

function getErrorMessage(error) {
  const detail = error?.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (typeof error?.message === "string") {
    return error.message;
  }

  return "Unable to complete the operation.";
}

function isMissingWeek(error) {
  const message = getErrorMessage(
    error
  ).toLowerCase();

  return [
    "no factory observations found",
    "no observations found",
    "week not found",
    "404 not found",
    "404",
  ].some((phrase) =>
    message.includes(phrase)
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

  throw new Error(
    "Unable to read the weekly data response."
  );
}

function numericInput(value, field) {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    throw new Error(
      `${field.label} is required.`
    );
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(
      `${field.label} must be a valid number.`
    );
  }

  if (
    field.min !== undefined &&
    number < field.min
  ) {
    throw new Error(
      `${field.label} is below the allowed minimum.`
    );
  }

  if (
    field.max !== undefined &&
    number > field.max
  ) {
    throw new Error(
      `${field.label} exceeds the allowed maximum.`
    );
  }

  return number;
}

function Section({
  title,
  action,
  children,
}) {
  return (
    <section style={styles.section}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <h2 style={styles.sectionTitle}>
          {title}
        </h2>

        {action}
      </div>

      {children}
    </section>
  );
}

function NumberField({
  field,
  value,
  disabled,
  onChange,
}) {
  return (
    <label style={styles.label}>
      {field.label}

      <input
        type="number"
        min={field.min}
        max={field.max}
        step="any"
        value={value}
        disabled={disabled}
        placeholder="Enter value"
        onChange={(event) =>
          onChange(event.target.value)
        }
        style={{
          ...styles.input,
          background: disabled
            ? "#F1F5F1"
            : "#FFFFFF",
        }}
      />
    </label>
  );
}

function ActionButton({
  children,
  onClick,
  disabled = false,
  background = "#2E6B4E",
  icon: Icon,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 9,
        padding: "13px 20px",
        border: 0,
        borderRadius: 10,
        background: disabled
          ? "#A5B7AB"
          : background,
        color: "#FFFFFF",
        fontWeight: 700,
        cursor: disabled
          ? "not-allowed"
          : "pointer",
      }}
    >
      {Icon && <Icon size={18} />}
      {children}
    </button>
  );
}

function Message({
  children,
  type = "error",
}) {
  const isSuccess = type === "success";
  const isWarning = type === "warning";

  const background = isSuccess
    ? "#EFFAF2"
    : isWarning
      ? "#FFF9EB"
      : "#FFF4F4";

  const color = isSuccess
    ? "#215A3C"
    : isWarning
      ? "#805C19"
      : "#9C2727";

  const Icon = isSuccess
    ? CheckCircle2
    : AlertCircle;

  return (
    <div
      role={isSuccess ? "status" : "alert"}
      style={{
        ...styles.section,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        background,
        color,
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

export default function WeeklyDataEntry() {
  const navigate = useNavigate();

  const [week, setWeek] = useState(
    latestCompletedMonday
  );

  const [grades, setGrades] = useState(
    emptyGrades
  );

  const [market, setMarket] = useState({
    ...EMPTY_MARKET,
  });

  const [savedRecords, setSavedRecords] =
    useState({});

  const [
    historicalBoundary,
    setHistoricalBoundary,
  ] = useState(null);

  const [
    serverLatestWeek,
    setServerLatestWeek,
  ] = useState(null);

  const [loading, setLoading] =
    useState(true);

  const [generating, setGenerating] =
    useState(false);

  const [loadFailed, setLoadFailed] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [sampleDataLoaded, setSampleDataLoaded] =
    useState(false);

  const requestId = useRef(0);
  const generationLock = useRef(false);

  const allGradesSaved =
    EIGHT_INPUT_GRADES.every(
      (grade) =>
        Boolean(savedRecords[grade])
    );

  const isProtectedWeek =
    historicalBoundary === null ||
    week <= historicalBoundary;

  const matchesServerWeek =
    Boolean(serverLatestWeek) &&
    week === serverLatestWeek;

  const busy = loading || generating;

  const canEdit =
    !busy &&
    !loadFailed &&
    !isProtectedWeek &&
    matchesServerWeek;

  const canGenerate = canEdit;

  const reportingWeekEnd = addDays(
    week,
    6
  );

  const loadPage = useCallback(
    async (currentWeek) => {
      const request = ++requestId.current;

      setLoading(true);
      setLoadFailed(false);
      setError("");
      setSampleDataLoaded(false);

      try {
        const status =
          await getEightInputFactoryStatus();

        if (request !== requestId.current) {
          return false;
        }

        const protectedUntil =
          status.source_dataset?.latest_week;

        if (!protectedUntil) {
          throw new Error(
            "Factory history information is unavailable."
          );
        }

        const serverWeek =
          status.latest_completed_week ||
          latestCompletedMonday();

        if (serverWeek !== currentWeek) {
          throw new Error(
            "The reporting week has changed. " +
            "Refresh the page to use the latest completed week."
          );
        }

        let records = [];

        try {
          const response =
            await getEightInputHistoricalWeek(
              currentWeek
            );

          records = extractRecords(response);
        } catch (caughtError) {
          if (!isMissingWeek(caughtError)) {
            throw caughtError;
          }
        }

        if (request !== requestId.current) {
          return false;
        }

        const nextGrades = emptyGrades();
        const nextMarket = {
          ...EMPTY_MARKET,
        };
        const nextSaved = {};

        for (const record of records) {
          if (
            !EIGHT_INPUT_GRADES.includes(
              record.tea_type
            )
          ) {
            continue;
          }

          nextSaved[record.tea_type] = record;

          for (const field of GRADE_FIELDS) {
            nextGrades[
              record.tea_type
            ][field.key] = textValue(
              record[field.key]
            );
          }
        }

        const firstRecord =
          EIGHT_INPUT_GRADES
            .map((grade) =>
              nextSaved[grade]
            )
            .find(Boolean);

        if (firstRecord) {
          for (const key of SHARED_FIELDS) {
            nextMarket[key] = textValue(
              firstRecord[key]
            );
          }
        }

        setHistoricalBoundary(
          protectedUntil
        );

        setServerLatestWeek(
          serverWeek
        );

        setGrades(nextGrades);
        setMarket(nextMarket);
        setSavedRecords(nextSaved);

        return true;
      } catch (caughtError) {
        if (request === requestId.current) {
          setLoadFailed(true);
          setError(
            getErrorMessage(caughtError)
          );
        }

        return false;
      } finally {
        if (request === requestId.current) {
          setLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    setSuccess("");
    loadPage(week);

    return () => {
      requestId.current += 1;
    };
  }, [week, loadPage]);

  useEffect(() => {
    const interval = window.setInterval(
      () => {
        const latest =
          latestCompletedMonday();

        if (!generationLock.current) {
          setWeek((previous) =>
            previous === latest
              ? previous
              : latest
          );
        }
      },
      60000
    );

    return () =>
      window.clearInterval(interval);
  }, []);

  function updateGrade(
    grade,
    field,
    value
  ) {
    if (!canEdit) return;

    setGrades((previous) => ({
      ...previous,
      [grade]: {
        ...previous[grade],
        [field]: value,
      },
    }));

    setSampleDataLoaded(false);
    setError("");
    setSuccess("");
  }

  function updateMarket(field, value) {
    if (!canEdit) return;

    setMarket((previous) => ({
      ...previous,
      [field]: value,
    }));

    setSampleDataLoaded(false);
    setError("");
    setSuccess("");
  }

  function handleAutoFill() {
    if (!canEdit) {
      return;
    }

    const hasEnteredValues =
      EIGHT_INPUT_GRADES.some(
        (grade) =>
          GRADE_FIELDS.some(
            (field) =>
              grades[grade]?.[field.key] !== ""
          )
      ) ||
      SHARED_FIELDS.some(
        (field) => market[field] !== ""
      );

    if (hasEnteredValues) {
      const confirmed = window.confirm(
        "Auto-fill will replace the values currently " +
        "shown in this form with illustrative test data.\n\n" +
        "Any previously saved MongoDB records will " +
        "remain unchanged unless you later choose " +
        "Generate Forecasts.\n\n" +
        "Continue?"
      );

      if (!confirmed) {
        return;
      }
    }

    setGrades(
      Object.fromEntries(
        EIGHT_INPUT_GRADES.map((grade) => [
          grade,
          { ...SAMPLE_GRADES[grade] },
        ])
      )
    );

    setMarket({
      ...SAMPLE_MARKET,
    });

    setSampleDataLoaded(true);
    setError("");
    setSuccess("");
  }

  function validatedMarket() {
    const result = {};

    for (const field of [
      ...EXCHANGE_FIELDS,
      ...AUCTION_FIELDS,
    ]) {
      result[field.key] = numericInput(
        market[field.key],
        field
      );
    }

    if (
      market.festival_flag !== "0" &&
      market.festival_flag !== "1"
    ) {
      throw new Error(
        "Select Festival Week."
      );
    }

    result.festival_flag = Number(
      market.festival_flag
    );

    return result;
  }

  function validatedGrade(grade) {
    const result = {
      tea_type: grade,
    };

    for (const field of GRADE_FIELDS) {
      try {
        result[field.key] = numericInput(
          grades[grade][field.key],
          field
        );
      } catch (caughtError) {
        throw new Error(
          `${grade}: ${getErrorMessage(caughtError)}`
        );
      }
    }

    return result;
  }

  function buildValidatedRecords() {
    const shared = validatedMarket();

    return EIGHT_INPUT_GRADES.map(
      (grade) => ({
        ...validatedGrade(grade),
        ...shared,
      })
    );
  }

  async function handleGenerateForecasts() {
    if (
      !canGenerate ||
      generationLock.current
    ) {
      return;
    }

    setError("");
    setSuccess("");

    if (
      week !== latestCompletedMonday() ||
      week !== serverLatestWeek
    ) {
      setError(
        "The reporting week has changed. " +
        "Refresh the page before generating forecasts."
      );
      return;
    }

    let records;

    try {
      records = buildValidatedRecords();
    } catch (caughtError) {
      setError(
        getErrorMessage(caughtError)
      );
      return;
    }

    const sampleWarning = sampleDataLoaded
      ? "\n\nWARNING: This form was auto-filled " +
        "with illustrative test data. " +
        "Generating forecasts will permanently " +
        "save these values and forecasts to " +
        "the configured factory database."
      : "";

    const confirmed = window.confirm(
      "Generate the four-week demand forecasts " +
      "using the weekly observations for " +
      `${displayDate(week)} to ` +
      `${displayDate(reportingWeekEnd)}?\n\n` +
      "The entered values will be saved. " +
      "If forecasts already exist, a new revision " +
      "will be retained in Forecast History." +
      sampleWarning
    );

    if (!confirmed) return;

    generationLock.current = true;
    setGenerating(true);

    try {
      const response =
        await generateAndSaveEightInputForecasts(
          week,
          records
        );

      const forecast = response.forecast;

      if (
        response.weekly_data?.saved !== true ||
        forecast?.finalized !== true ||
        forecast?.forecast_generated !== true
      ) {
        throw new Error(
          "Forecast saving could not be confirmed. " +
          "Check Forecast History before retrying."
        );
      }

      setSuccess(
        "Weekly data and forecasts saved successfully."
      );

      navigate(
        FORECAST_ROUTE,
        {
          state: {
            forecastOrigin: week,
            revision: response.revision,
            newlyGenerated: true,
          },
        }
      );
    } catch (caughtError) {
      setError(
        getErrorMessage(caughtError)
      );
    } finally {
      generationLock.current = false;
      setGenerating(false);
    }
  }

  function handleRefresh() {
    if (busy) return;

    setSuccess("");
    setError("");

    const latest =
      latestCompletedMonday();

    if (latest !== week) {
      setWeek(latest);
    } else {
      loadPage(week);
    }
  }

  return (
    <div
      className="demand-page"
      style={styles.page}
    >
      <div className="demand-page-header">
        <h1>Weekly Data Entry</h1>
      </div>

      <div style={{ maxWidth: 1200 }}>
        {error && (
          <Message type="error">
            {error}
          </Message>
        )}

        {success && (
          <Message type="success">
            {success}
          </Message>
        )}

        <Section title="Latest Completed Week">
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 12,
            }}
          >
            <CalendarDays
              size={22}
              color="#2E6B4E"
            />

            <input
              type="text"
              readOnly
              value={
                `${displayDate(week)} – ` +
                displayDate(reportingWeekEnd)
              }
              aria-label="Latest Completed Reporting Week"
              style={{
                ...styles.input,
                maxWidth: 350,
                fontWeight: 600,
                background: "#F1F5F1",
              }}
            />

            <button
              type="button"
              disabled={busy}
              title="Refresh"
              aria-label="Refresh weekly data"
              onClick={handleRefresh}
              style={{
                padding: 10,
                border: "1px solid #CFDCD2",
                borderRadius: 9,
                background: "#FFFFFF",
                cursor: busy
                  ? "not-allowed"
                  : "pointer",
              }}
            >
              <RefreshCw size={18} />
            </button>
          </div>

          {isProtectedWeek && !loading && (
            <p
              style={{
                ...styles.muted,
                color: "#805C19",
                marginTop: 15,
                marginBottom: 0,
              }}
            >
              This reporting week belongs to
              the protected historical dataset.
              New observations cannot be saved
              for this week.
            </p>
          )}

          {allGradesSaved && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                marginTop: 14,
                color: "#215A3C",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <ShieldCheck size={18} />

              All five tea-grade observations
              have been previously saved.
              Values remain editable.
            </div>
          )}
        </Section>

        <Section
          title="Tea Grade Data"
          action={
            <ActionButton
              icon={WandSparkles}
              background="#2E6B4E"
              disabled={!canEdit}
              onClick={handleAutoFill}
            >
              Auto-Fill Test Data
            </ActionButton>
          }
        >
          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.tableHeading}>
                    Tea Grade
                  </th>

                  {GRADE_FIELDS.map((field) => (
                    <th
                      key={field.key}
                      style={styles.tableHeading}
                    >
                      {field.label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {EIGHT_INPUT_GRADES.map(
                  (grade, index) => {
                    const saved = Boolean(
                      savedRecords[grade]
                    );

                    return (
                      <tr
                        key={grade}
                        style={{
                          background:
                            index % 2 === 0
                              ? "#FFFFFF"
                              : "#F8FAF7",
                        }}
                      >
                        <td
                          style={{
                            ...styles.tableCell,
                            color: "#193C2B",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            {grade}

                            {saved && (
                              <CheckCircle2
                                size={16}
                                color="#2E6B4E"
                                aria-label="Previously saved"
                              />
                            )}
                          </span>
                        </td>

                        {GRADE_FIELDS.map(
                          (field) => (
                            <td
                              key={
                                `${grade}-${field.key}`
                              }
                              style={styles.tableCell}
                            >
                              <input
                                type="number"
                                min={field.min}
                                max={field.max}
                                step="any"
                                aria-label={
                                  `${grade} ${field.label}`
                                }
                                value={
                                  grades[grade]?.[
                                    field.key
                                  ] ?? ""
                                }
                                disabled={!canEdit}
                                placeholder="Enter value"
                                onChange={(event) =>
                                  updateGrade(
                                    grade,
                                    field.key,
                                    event.target.value
                                  )
                                }
                                style={{
                                  ...styles.input,
                                  minWidth: 145,
                                  background: canEdit
                                    ? "#FFFFFF"
                                    : "#F1F5F1",
                                }}
                              />
                            </td>
                          )
                        )}
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>

          {sampleDataLoaded && (
            <div
              style={{
                marginTop: 14,
                padding: "12px 14px",
                background: "#FFF9EB",
                border: "1px solid #E8D6A9",
                borderRadius: 9,
                color: "#805C19",
                fontSize: 13,
                lineHeight: 1.6,
              }}
              role="status"
            >
              <strong>
                Illustrative test data loaded.
              </strong>
              {" "}
              These values are not verified
              factory observations. Nothing
              has been saved to MongoDB.
            </div>
          )}
        </Section>

        <Section title="Weekly Market Information">
          <div style={styles.grid}>
            {EXCHANGE_FIELDS.map(
              (field) => (
                <NumberField
                  key={field.key}
                  field={field}
                  value={market[field.key]}
                  disabled={!canEdit}
                  onChange={(value) =>
                    updateMarket(
                      field.key,
                      value
                    )
                  }
                />
              )
            )}

            <label style={styles.label}>
              Festival Week

              <select
                value={market.festival_flag}
                disabled={!canEdit}
                onChange={(event) =>
                  updateMarket(
                    "festival_flag",
                    event.target.value
                  )
                }
                style={{
                  ...styles.input,
                  background: !canEdit
                    ? "#F1F5F1"
                    : "#FFFFFF",
                }}
              >
                <option value="">
                  Select
                </option>

                <option value="0">
                  No
                </option>

                <option value="1">
                  Yes
                </option>
              </select>
            </label>
          </div>
        </Section>

        <Section title="Auction Prices">
          <div style={styles.grid}>
            {AUCTION_FIELDS.map(
              (field) => (
                <NumberField
                  key={field.key}
                  field={field}
                  value={market[field.key]}
                  disabled={!canEdit}
                  onChange={(value) =>
                    updateMarket(
                      field.key,
                      value
                    )
                  }
                />
              )
            )}
          </div>
        </Section>

        <div style={styles.buttonRow}>
          <ActionButton
            icon={ChartNoAxesCombined}
            background="#193C2B"
            disabled={!canGenerate}
            onClick={handleGenerateForecasts}
          >
            {generating
              ? "Generating Forecasts..."
              : "Generate Forecasts"}
          </ActionButton>
        </div>

        {allGradesSaved && (
          <p
            style={{
              ...styles.muted,
              textAlign: "right",
              marginTop: 12,
            }}
          >
            Generating again will save
            the current values and retain
            a new forecast revision.
          </p>
        )}
      </div>
    </div>
  );
}
