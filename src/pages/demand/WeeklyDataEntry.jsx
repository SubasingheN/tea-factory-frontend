
import { useEffect, useRef, useState } from "react";

import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Database,
  Leaf,
  RefreshCcw,
  Save,
} from "lucide-react";

import {
  SIX_INPUT_TEA_GRADES,
  SIX_INPUT_FIELDS,
  SIX_INPUT_EMPTY_RECORD,
  validateSixInputWeeklyBatch,
  formatSixInputDate,
} from "../../services/sixInputForecastService";

import {
  getSixInputFactoryStatus,
  getSixInputHistoricalWeek,
  saveSixInputObservations,
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

const CSV_FIRST_WEEK = "2021-01-04";
const CSV_LATEST_WEEK = "2026-10-05";

function createEmptyRecords() {
  return Object.fromEntries(
    SIX_INPUT_TEA_GRADES.map((grade) => [
      grade,
      { ...SIX_INPUT_EMPTY_RECORD },
    ])
  );
}

function addDays(isoDate, days) {
  if (!isoDate) return "";

  const date = new Date(`${isoDate}T12:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function localDateString(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function latestCompletedMonday() {
  const today = new Date();

  const daysSinceMonday =
    (today.getDay() + 6) % 7;

  const monday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - daysSinceMonday - 7
  );

  return localDateString(monday);
}

function isMonday(isoDate) {
  if (!isoDate) return false;

  const date = new Date(`${isoDate}T12:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === isoDate &&
    date.getUTCDay() === 1
  );
}

function isCompletedWeek(isoDate) {
  const weekEnd = addDays(isoDate, 6);

  return Boolean(
    weekEnd &&
    weekEnd < localDateString(new Date())
  );
}

function convertHistoricalRecords(items) {
  const records = createEmptyRecords();

  for (const item of items) {
    if (
      !SIX_INPUT_TEA_GRADES.includes(item.tea_type)
    ) {
      continue;
    }

    const values = {};

    for (const field of SIX_INPUT_FIELDS) {
      const value = item[field.key];

      values[field.key] =
        value === null || value === undefined
          ? ""
          : String(value);
    }

    records[item.tea_type] = values;
  }

  return records;
}

function Panel({ children }) {
  return (
    <section
      style={{
        padding: 24,
        background: COLORS.white,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 18,
        boxShadow: "0 4px 18px rgba(21,61,43,0.04)",
      }}
    >
      {children}
    </section>
  );
}

function SectionHeading({ icon: Icon, children }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 18,
      }}
    >
      <Icon size={23} color={COLORS.green} />

      <h2
        style={{
          margin: 0,
          fontSize: "1.15rem",
          fontWeight: 700,
          color: COLORS.forest,
        }}
      >
        {children}
      </h2>
    </div>
  );
}

function StatusCard({ label, value }) {
  return (
    <div
      style={{
        padding: 15,
        background: COLORS.ivory,
        borderRadius: 12,
        border: `1px solid ${COLORS.border}`,
      }}
    >
      <div
        style={{
          color: COLORS.muted,
          fontSize: 12,
          marginBottom: 7,
        }}
      >
        {label}
      </div>

      <strong style={{ color: COLORS.forest }}>
        {value}
      </strong>
    </div>
  );
}

export default function WeeklyDataEntry() {
  const [selectedGrades, setSelectedGrades] =
    useState(["BOP"]);

  const [activeGrade, setActiveGrade] =
    useState("BOP");

  const [records, setRecords] =
    useState(createEmptyRecords);

  const [weekStartDate, setWeekStartDate] =
    useState(CSV_LATEST_WEEK);

  const [factoryStatus, setFactoryStatus] =
    useState(null);

  const [recordedGrades, setRecordedGrades] =
    useState([]);

  const [historySource, setHistorySource] =
    useState(null);

  const [loadedWeek, setLoadedWeek] =
    useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const requestId = useRef(0);

  const busy = loading || saving;

  const csvFirstWeek =
    factoryStatus?.csv_first_week ||
    CSV_FIRST_WEEK;

  const csvLatestWeek =
    factoryStatus?.csv_latest_week ||
    CSV_LATEST_WEEK;

  const latestSavedWeek =
    factoryStatus?.latest_saved_week || null;

  const maximumWeek = latestCompletedMonday();

  const isNewWeek =
    weekStartDate > csvLatestWeek;

  const validWeek =
    isMonday(weekStartDate) &&
    isCompletedWeek(weekStartDate);

  const activeRecord =
    records[activeGrade] ||
    SIX_INPUT_EMPTY_RECORD;

  const activeIsRecorded =
    recordedGrades.includes(activeGrade);

  const activeIndex =
    selectedGrades.indexOf(activeGrade);

  const anySelectedRecorded =
    selectedGrades.some((grade) =>
      recordedGrades.includes(grade)
    );

  const completedCount =
    selectedGrades.filter((grade) =>
      SIX_INPUT_FIELDS.every(({ key }) => {
        const value = records[grade]?.[key];

        return (
          value !== "" &&
          value !== null &&
          value !== undefined &&
          Number.isFinite(Number(value))
        );
      })
    ).length;

  const allInputsComplete =
    selectedGrades.length > 0 &&
    completedCount === selectedGrades.length;

  function clearFeedback() {
    setError("");
    setMessage("");
  }

  async function loadHistoryForWeek(
    selectedWeek,
    currentRequest
  ) {
    if (
      !selectedWeek ||
      !isMonday(selectedWeek) ||
      !isCompletedWeek(selectedWeek)
    ) {
      if (currentRequest !== requestId.current) {
        return;
      }

      setRecords(createEmptyRecords());
      setRecordedGrades([]);
      setHistorySource(null);
      setLoadedWeek(selectedWeek);

      return;
    }

    const result =
      await getSixInputHistoricalWeek(
        selectedWeek
      );

    if (currentRequest !== requestId.current) {
      return;
    }

    setRecords(
      convertHistoricalRecords(result.records)
    );

    setRecordedGrades(
      result.selected_grades
    );

    setHistorySource(result.source);
    setLoadedWeek(selectedWeek);
  }

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      const currentRequest =
        ++requestId.current;

      try {
        const status =
          await getSixInputFactoryStatus();

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
          CSV_LATEST_WEEK;

        setWeekStartDate(initialWeek);

        await loadHistoryForWeek(
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
            "Unable to load factory observations."
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
    const currentRequest =
      ++requestId.current;

    setWeekStartDate(nextWeek);
    setLoading(true);

    setRecords(createEmptyRecords());
    setRecordedGrades([]);
    setHistorySource(null);
    setLoadedWeek(null);

    clearFeedback();

    try {
      await loadHistoryForWeek(
        nextWeek,
        currentRequest
      );
    } catch (err) {
      if (
        currentRequest === requestId.current
      ) {
        setError(
          err.message ||
          "Unable to retrieve factory observations."
        );
      }
    } finally {
      if (
        currentRequest === requestId.current
      ) {
        setLoading(false);
      }
    }
  }

  function toggleGrade(grade) {
    if (busy) return;

    const next =
      selectedGrades.includes(grade)
        ? selectedGrades.filter(
            (item) => item !== grade
          )
        : SIX_INPUT_TEA_GRADES.filter(
            (item) =>
              item === grade ||
              selectedGrades.includes(item)
          );

    setSelectedGrades(next);

    if (!next.includes(activeGrade)) {
      setActiveGrade(next[0] || "");
    }

    clearFeedback();
  }

  function updateInput(field, value) {
    if (
      activeIsRecorded ||
      !isNewWeek ||
      busy
    ) {
      return;
    }

    setRecords((current) => {
      const next = {
        ...current,
        [activeGrade]: {
          ...current[activeGrade],
          [field]: value,
        },
      };

      // Exchange rate and festival flag must
      // agree across grades in the same week.
      if (
        field === "usd_lkr_rate" ||
        field === "festival_flag"
      ) {
        for (const grade of SIX_INPUT_TEA_GRADES) {
          if (recordedGrades.includes(grade)) {
            continue;
          }

          next[grade] = {
            ...next[grade],
            [field]: value,
          };
        }
      }

      return next;
    });

    clearFeedback();
  }

  function clearUnsavedInputs() {
    setRecords((current) => {
      const next = { ...current };

      for (const grade of selectedGrades) {
        if (!recordedGrades.includes(grade)) {
          next[grade] = {
            ...SIX_INPUT_EMPTY_RECORD,
          };
        }
      }

      return next;
    });

    clearFeedback();
  }

  function buildPayload() {
    return {
      week_start_date: weekStartDate,
      records: selectedGrades.map((grade) => ({
        tea_type: grade,
        ...records[grade],
      })),
    };
  }

  function validateEntry() {
    if (selectedGrades.length === 0) {
      throw new Error(
        "Select at least one tea grade."
      );
    }

    if (loadedWeek !== weekStartDate) {
      throw new Error(
        "Wait until factory history finishes loading."
      );
    }

    if (!validWeek) {
      throw new Error(
        "Select a completed reporting week " +
        "that starts on Monday."
      );
    }

    if (weekStartDate < csvFirstWeek) {
      throw new Error(
        "The selected reporting week precedes " +
        "the factory dataset."
      );
    }

    return validateSixInputWeeklyBatch(
      buildPayload()
    );
  }

  async function handleSave(event) {
    event.preventDefault();
    clearFeedback();

    if (!isNewWeek) {
      setError(
        "Original factory CSV observations " +
        "are protected. Only newer completed " +
        "weeks can be saved to MongoDB."
      );
      return;
    }

    if (anySelectedRecorded) {
      setError(
        "One or more selected grades already " +
        "have saved observations. Deselect " +
        "them before saving new records."
      );
      return;
    }

    let payload;

    try {
      payload = validateEntry();
    } catch (err) {
      setError(err.message);
      return;
    }

    setSaving(true);

    try {
      const result =
        await saveSixInputObservations(
          payload
        );

      const currentRequest =
        ++requestId.current;

      const status =
        await getSixInputFactoryStatus();

      setFactoryStatus(status);

      await loadHistoryForWeek(
        weekStartDate,
        currentRequest
      );

      setMessage(
        `${result.saved_count} ${
          result.saved_count === 1
            ? "observation was"
            : "observations were"
        } saved successfully to MongoDB.`
      );
    } catch (err) {
      setError(
        err.message ||
        "Unable to save factory observations. " +
        "Check stored records before retrying."
      );
    } finally {
      setSaving(false);
    }
  }

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

        <h1>Weekly Data Entry</h1>

        <p>
          Review recorded factory observations
          and enter actual weekly data for
          BOP, BOPF, Dust, OP and Pekoe.
          New completed-week records are saved
          securely through the backend to MongoDB.
        </p>
      </div>

      {error && (
        <div
          className="demand-error-message"
          role="alert"
          style={{ marginBottom: 18 }}
        >
          {error}
        </div>
      )}

      {message && (
        <div
          className="demand-success-message"
          role="status"
          style={{ marginBottom: 18 }}
        >
          {message}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gap: 20,
          maxWidth: 1150,
        }}
      >
        <Panel>
          <SectionHeading icon={Database}>
            Factory Observation Status
          </SectionHeading>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(190px, 1fr))",
              gap: 14,
            }}
          >
            <StatusCard
              label="Original Factory Records"
              value={
                factoryStatus?.csv_records ??
                "Loading..."
              }
            />

            <StatusCard
              label="Latest CSV Week"
              value={formatSixInputDate(
                csvLatestWeek
              )}
            />

            <StatusCard
              label="Saved MongoDB Observations"
              value={
                factoryStatus?.saved_observation_count ??
                "Loading..."
              }
            />

            <StatusCard
              label="Latest MongoDB Week"
              value={
                latestSavedWeek
                  ? formatSixInputDate(
                      latestSavedWeek
                    )
                  : "None recorded"
              }
            />
          </div>
        </Panel>

        <Panel>
          <SectionHeading icon={ClipboardList}>
            1. Select Completed Week
          </SectionHeading>

          <label
            htmlFor="six-input-week-start"
            style={{
              display: "block",
              color: COLORS.forest,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Reporting week starting Monday
          </label>

          <input
            id="six-input-week-start"
            type="date"
            className="demand-input"
            value={weekStartDate}
            min={csvFirstWeek}
            max={maximumWeek}
            disabled={busy}
            onChange={(event) =>
              changeWeek(event.target.value)
            }
            style={{ maxWidth: 290 }}
          />

          <div
            style={{
              background: COLORS.ivory,
              padding: 16,
              borderRadius: 12,
              marginTop: 14,
              color: COLORS.forest,
              lineHeight: 1.9,
            }}
          >
            <div>
              <strong>Reporting period: </strong>
              {formatSixInputDate(weekStartDate)}
              {" – "}
              {formatSixInputDate(
                addDays(weekStartDate, 6)
              )}
            </div>

            <div>
              <strong>Record source: </strong>
              {historySource === "protected_factory_csv"
                ? "Protected factory CSV"
                : historySource ===
                    "mongodb_factory_observations"
                  ? recordedGrades.length > 0
                    ? "MongoDB factory observations"
                    : "Not yet recorded"
                  : "Not yet recorded"}
            </div>

            <div>
              <strong>Entry status: </strong>
              {loading
                ? "Loading observations"
                : !validWeek
                  ? "Incomplete or invalid week"
                  : isNewWeek
                    ? "New-week entry permitted"
                    : "Historical records — read-only"}
            </div>
          </div>

          {loading && (
            <p style={{ color: COLORS.muted }}>
              Loading factory observations...
            </p>
          )}

          <p
            style={{
              color: COLORS.muted,
              fontSize: 13,
              marginBottom: 0,
              lineHeight: 1.7,
            }}
          >
            Weeks already included in the original
            factory CSV cannot be modified.
            New observations must be finalized
            and their reporting week completed
            before they can be saved.
          </p>
        </Panel>

        <Panel>
          <SectionHeading icon={Leaf}>
            2. Select Tea Grades
          </SectionHeading>

          <p
            style={{
              color: COLORS.muted,
              marginTop: 0,
            }}
          >
            Choose one or more grades to review
            or enter. A check mark indicates
            an existing recorded observation.
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            {SIX_INPUT_TEA_GRADES.map((grade) => {
              const selected =
                selectedGrades.includes(grade);

              const recorded =
                recordedGrades.includes(grade);

              return (
                <label
                  key={grade}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    padding: "12px 17px",
                    borderRadius: 12,
                    background: selected
                      ? COLORS.forest
                      : COLORS.white,
                    color: selected
                      ? COLORS.white
                      : COLORS.forest,
                    border: `1px solid ${
                      selected
                        ? COLORS.forest
                        : COLORS.border
                    }`,
                    fontWeight: 600,
                    cursor: busy
                      ? "not-allowed"
                      : "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={busy}
                    onChange={() =>
                      toggleGrade(grade)
                    }
                    style={{
                      accentColor: COLORS.gold,
                    }}
                  />

                  {grade}

                  {recorded && (
                    <CheckCircle2
                      size={16}
                      color={COLORS.gold}
                    />
                  )}
                </label>
              );
            })}
          </div>

          <div
            style={{
              marginTop: 16,
              padding: 14,
              borderRadius: 12,
              background: COLORS.ivory,
              color: COLORS.forest,
            }}
          >
            <strong>
              {selectedGrades.length}{" "}
              {selectedGrades.length === 1
                ? "grade selected"
                : "grades selected"}
            </strong>

            <span style={{ marginLeft: 12 }}>
              {completedCount} completed
            </span>

            <span style={{ marginLeft: 12 }}>
              {
                selectedGrades.filter((grade) =>
                  recordedGrades.includes(grade)
                ).length
              }{" "}
              recorded
            </span>
          </div>
        </Panel>

        {selectedGrades.length > 0 && (
          <form onSubmit={handleSave}>
            <Panel>
              <SectionHeading icon={Leaf}>
                3. Weekly Factory Inputs
              </SectionHeading>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 9,
                  marginBottom: 20,
                }}
              >
                {selectedGrades.map((grade) => {
                  const active =
                    activeGrade === grade;

                  return (
                    <button
                      key={grade}
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        setActiveGrade(grade)
                      }
                      style={{
                        padding: "10px 17px",
                        borderRadius: 10,
                        border: `1px solid ${
                          active
                            ? COLORS.forest
                            : COLORS.border
                        }`,
                        background: active
                          ? COLORS.forest
                          : COLORS.white,
                        color: active
                          ? COLORS.white
                          : COLORS.forest,
                        fontWeight: 650,
                        cursor: busy
                          ? "not-allowed"
                          : "pointer",
                      }}
                    >
                      {grade}
                    </button>
                  );
                })}
              </div>

              <div
                style={{
                  padding: 20,
                  background: COLORS.ivory,
                  borderRadius: 14,
                  border: `1px solid ${COLORS.border}`,
                }}
              >
                <h3
                  style={{
                    marginTop: 0,
                    color: COLORS.forest,
                  }}
                >
                  {activeGrade} — Weekly Data
                </h3>

                <p
                  style={{
                    color: activeIsRecorded
                      ? COLORS.green
                      : COLORS.muted,
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  {activeIsRecorded
                    ? "Recorded observation — read-only"
                    : isNewWeek
                      ? "New observation — not yet saved"
                      : "Historical records are read-only"}
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 18,
                  }}
                >
                  {SIX_INPUT_FIELDS.map((field) => {
                    const disabled =
                      busy ||
                      activeIsRecorded ||
                      !isNewWeek ||
                      !validWeek ||
                      loadedWeek !== weekStartDate;

                    return (
                      <div key={field.key}>
                        <label
                          htmlFor={`${activeGrade}-${field.key}`}
                          style={{
                            display: "block",
                            color: COLORS.forest,
                            fontWeight: 650,
                            marginBottom: 8,
                          }}
                        >
                          {field.label}

                          <span
                            style={{
                              display: "block",
                              fontSize: 12,
                              color: COLORS.muted,
                              fontWeight: 500,
                              marginTop: 3,
                            }}
                          >
                            {field.unit}
                          </span>
                        </label>

                        {field.key ===
                        "festival_flag" ? (
                          <select
                            id={`${activeGrade}-${field.key}`}
                            className="demand-input"
                            value={
                              activeRecord[field.key]
                            }
                            disabled={disabled}
                            onChange={(event) =>
                              updateInput(
                                field.key,
                                event.target.value
                              )
                            }
                          >
                            <option value="">
                              Select
                            </option>

                            <option value="0">
                              No (0)
                            </option>

                            <option value="1">
                              Yes (1)
                            </option>
                          </select>
                        ) : (
                          <input
                            id={`${activeGrade}-${field.key}`}
                            type="number"
                            className="demand-input"
                            min={field.min}
                            max={field.max}
                            step={field.step}
                            value={
                              activeRecord[field.key]
                            }
                            placeholder={
                              field.description
                            }
                            disabled={disabled}
                            onChange={(event) =>
                              updateInput(
                                field.key,
                                event.target.value
                              )
                            }
                          />
                        )}

                        <p
                          style={{
                            color: COLORS.muted,
                            fontSize: 12,
                            lineHeight: 1.55,
                            marginBottom: 0,
                          }}
                        >
                          {field.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <p
                style={{
                  color: COLORS.muted,
                  fontSize: 12,
                  lineHeight: 1.7,
                }}
              >
                USD/LKR exchange rate and festival
                classification are shared across
                tea grades for the same reporting week.
              </p>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                  marginTop: 18,
                }}
              >
                <button
                  type="button"
                  className="demand-secondary-btn"
                  disabled={
                    busy ||
                    activeIndex <= 0
                  }
                  onClick={() =>
                    setActiveGrade(
                      selectedGrades[activeIndex - 1]
                    )
                  }
                >
                  <ChevronLeft size={16} />
                  Previous Grade
                </button>

                <button
                  type="button"
                  className="demand-secondary-btn"
                  disabled={
                    busy ||
                    activeIndex >=
                      selectedGrades.length - 1
                  }
                  onClick={() =>
                    setActiveGrade(
                      selectedGrades[activeIndex + 1]
                    )
                  }
                >
                  Next Grade
                  <ChevronRight size={16} />
                </button>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  gap: 12,
                  marginTop: 22,
                  paddingTop: 20,
                  borderTop: `1px solid ${COLORS.border}`,
                }}
              >
                <button
                  type="button"
                  className="demand-secondary-btn"
                  disabled={busy}
                  onClick={clearUnsavedInputs}
                >
                  <RefreshCcw size={16} />
                  Clear Unsaved Inputs
                </button>

                <button
                  type="submit"
                  className="demand-save-btn"
                  disabled={
                    busy ||
                    !isNewWeek ||
                    !validWeek ||
                    !allInputsComplete ||
                    anySelectedRecorded ||
                    loadedWeek !== weekStartDate
                  }
                >
                  <Save size={18} />

                  {saving
                    ? "Saving..."
                    : "Save Weekly Observations"}
                </button>
              </div>

              <p
                style={{
                  marginTop: 14,
                  marginBottom: 0,
                  color: COLORS.muted,
                  fontSize: 12,
                  lineHeight: 1.7,
                }}
              >
                Saving stores actual completed-week
                factory observations in MongoDB.
                Existing observations cannot be
                overwritten. This page does not
                generate demand predictions.
              </p>
            </Panel>
          </form>
        )}
      </div>
    </div>
  );
}
