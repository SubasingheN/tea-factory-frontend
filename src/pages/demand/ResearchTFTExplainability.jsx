
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
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Database,
  Info,
  Leaf,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  EIGHT_INPUT_GRADES,
  EIGHT_INPUT_FIELDS,
  getEightInputFactoryStatus,
  getEightInputHistoricalWeek,
  explainEightInputForecast,
} from "../../services/eightInputDataService";

const BASE_PATH = "/tea-demand-forecasting";

const COLORS = {
  forest: "#153D2B",
  green: "#2E6B4E",
  gold: "#C8A45D",
  ivory: "#F5F3E9",
  white: "#FFFFFF",
  muted: "#63756A",
  border: "#D8E2D3",
  blue: "#347DA1",
  purple: "#8659A7",
};

const FEATURE_NAMES = {
  demand_kg: "Historical Demand",
  production_kg: "Historical Production",
  inventory_kg: "Historical Inventory",
  usd_lkr_rate: "USD/LKR Exchange Rate",
  festival_flag: "Festival Week",
  auction_price_high_lkr:
    "High-Elevation Auction Price",
  auction_price_medium_lkr:
    "Medium-Elevation Auction Price",
  auction_price_low_lkr:
    "Low-Elevation Auction Price",
  grade: "Tea Grade",
  relative_time_idx: "Relative Time Index",
  time_idx: "Time Index",
  week_sin: "Weekly Seasonality (Sine)",
  week_cos: "Weekly Seasonality (Cosine)",
  month_sin: "Monthly Seasonality (Sine)",
  month_cos: "Monthly Seasonality (Cosine)",
};

const INPUT_FEATURES = [
  {
    key: "demand_kg",
    category: "Factory Operations",
    description:
      "Previously observed weekly tea demand in kilograms.",
  },
  {
    key: "production_kg",
    category: "Factory Operations",
    description:
      "Tea quantity produced during historical reporting weeks.",
  },
  {
    key: "inventory_kg",
    category: "Factory Operations",
    description:
      "Previously recorded factory inventory quantities.",
  },
  {
    key: "usd_lkr_rate",
    category: "Economic Conditions",
    description:
      "Historical exchange-rate information associated with the reporting week.",
  },
  {
    key: "festival_flag",
    category: "Calendar Conditions",
    description:
      "Historical binary indicator identifying designated festival weeks.",
  },
  {
    key: "auction_price_high_lkr",
    category: "Tea Market Conditions",
    description:
      "Historical Colombo auction prices for high-elevation tea.",
  },
  {
    key: "auction_price_medium_lkr",
    category: "Tea Market Conditions",
    description:
      "Historical Colombo auction prices for medium-elevation tea.",
  },
  {
    key: "auction_price_low_lkr",
    category: "Tea Market Conditions",
    description:
      "Historical Colombo auction prices for low-elevation tea.",
  },
];

const PANEL_STYLE = {
  padding: 24,
  background: COLORS.white,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 18,
  marginBottom: 20,
  boxShadow: "0 4px 18px rgba(21,61,43,0.04)",
};

function formatFeature(name) {
  return (
    FEATURE_NAMES[name] ||
    String(name)
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      )
  );
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(`${value}T12:00:00Z`);

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

function formatNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    !Number.isFinite(Number(value))
  ) {
    return "—";
  }

  return Number(value).toLocaleString("en-GB", {
    maximumFractionDigits: 2,
  });
}

function formatPercent(value) {
  if (!Number.isFinite(Number(value))) {
    return "—";
  }

  return `${Number(value).toFixed(2)}%`;
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
  const offset = (today.getDay() + 6) % 7;

  return localDateString(
    new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - offset - 7
    )
  );
}

function isValidCompletedWeek(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
    return false;
  }

  const date = new Date(`${value}T12:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    date.getUTCDay() === 1 &&
    value <= latestCompletedMonday()
  );
}

function Panel({ title, icon: Icon, children }) {
  return (
    <section
      className="demand-panel"
      style={PANEL_STYLE}
    >
      <h2
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          margin: "0 0 18px",
          color: COLORS.forest,
          fontSize: "1.15rem",
        }}
      >
        <Icon size={22} color={COLORS.green} />
        {title}
      </h2>

      {children}
    </section>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <article
      style={{
        padding: 17,
        background: COLORS.ivory,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
          color: COLORS.green,
          fontSize: 13,
        }}
      >
        <Icon size={18} />
        {label}
      </div>

      <strong
        style={{
          color: COLORS.forest,
          fontSize: 17,
        }}
      >
        {value}
      </strong>
    </article>
  );
}

function EmptyExplanation({ message }) {
  return (
    <div
      style={{
        padding: 22,
        borderRadius: 12,
        border: `1px solid ${COLORS.border}`,
        background: COLORS.ivory,
        color: COLORS.muted,
        lineHeight: 1.7,
      }}
    >
      <Info
        size={19}
        style={{
          verticalAlign: "middle",
          marginRight: 9,
        }}
      />
      {message}
    </div>
  );
}

function ImportanceChart({
  title,
  description,
  items,
  color,
}) {
  const chartData = useMemo(() => {
    if (!Array.isArray(items)) return [];

    return items
      .filter(
        (item) =>
          item.feature &&
          Number.isFinite(
            Number(
              item.relative_importance_percent
            )
          )
      )
      .map((item) => ({
        name: formatFeature(item.feature),
        feature: item.feature,
        importance: Number(
          item.relative_importance_percent
        ),
        isHistoricalInput:
          item.is_eight_input_feature === true,
      }))
      .sort(
        (a, b) =>
          b.importance - a.importance
      );
  }, [items]);

  return (
    <Panel title={title} icon={BarChart3}>
      <p
        style={{
          color: COLORS.muted,
          lineHeight: 1.8,
        }}
      >
        {description}
      </p>

      {!chartData.length ? (
        <EmptyExplanation
          message={
            "The backend did not return usable " +
            "variable-selection weights for this group."
          }
        />
      ) : (
        <>
          <div
            style={{
              height: Math.max(
                250,
                chartData.length * 46 + 65
              ),
              width: "100%",
            }}
          >
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{
                  top: 10,
                  right: 30,
                  bottom: 10,
                  left: 15,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                />

                <XAxis
                  type="number"
                  tickFormatter={(value) =>
                    `${value}%`
                  }
                />

                <YAxis
                  type="category"
                  dataKey="name"
                  width={190}
                  tick={{ fontSize: 11 }}
                />

                <Tooltip
                  formatter={(value) => [
                    formatPercent(value),
                    "Relative model weight",
                  ]}
                />

                <Bar
                  dataKey="importance"
                  fill={color}
                  radius={[0, 5, 5, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div
            style={{
              display: "grid",
              gap: 9,
              marginTop: 20,
            }}
          >
            {chartData.map((item) => (
              <div
                key={item.feature}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  padding: "9px 0",
                  borderBottom:
                    `1px solid ${COLORS.border}`,
                }}
              >
                <span
                  style={{
                    color: COLORS.forest,
                  }}
                >
                  {item.name}
                  {item.isHistoricalInput && (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 11,
                        color: COLORS.green,
                      }}
                    >
                      Historical input
                    </span>
                  )}
                </span>

                <strong
                  style={{
                    color: COLORS.forest,
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatPercent(
                    item.importance
                  )}
                </strong>
              </div>
            ))}
          </div>
        </>
      )}

      <p
        style={{
          marginTop: 18,
          fontSize: 12,
          color: COLORS.muted,
          lineHeight: 1.7,
        }}
      >
        Values are normalized within this
        variable group. They represent learned
        model-selection weights, not causal
        effects on tea demand.
      </p>
    </Panel>
  );
}

function AttentionChart({ items }) {
  const chartData = useMemo(() => {
    if (!Array.isArray(items)) return [];

    return items
      .filter(
        (item) =>
          Number.isFinite(
            Number(
              item.relative_attention_percent
            )
          ) &&
          Number.isFinite(
            Number(
              item.weeks_before_latest_observation
            )
          )
      )
      .map((item) => ({
        position: Number(
          item.weeks_before_latest_observation
        ),
        label: String(
          item.weeks_before_latest_observation
        ),
        attention: Number(
          item.relative_attention_percent
        ),
      }))
      .sort(
        (a, b) =>
          b.position - a.position
      );
  }, [items]);

  const highestAttention = useMemo(() => {
    if (!chartData.length) return null;

    return [...chartData].sort(
      (a, b) =>
        b.attention - a.attention
    )[0];
  }, [chartData]);

  return (
    <Panel
      title="Historical Temporal Attention"
      icon={Clock3}
    >
      <p
        style={{
          color: COLORS.muted,
          lineHeight: 1.8,
        }}
      >
        This chart displays model-derived
        attention over the 52-week historical
        encoder for the first forecast horizon,
        where the backend returned a valid
        reduced attention vector.
      </p>

      {!chartData.length ? (
        <EmptyExplanation
          message={
            "No compatible temporal-attention " +
            "vector was returned by the backend."
          }
        />
      ) : (
        <>
          {highestAttention && (
            <div
              style={{
                padding: 15,
                background: COLORS.ivory,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 12,
                marginBottom: 20,
                color: COLORS.forest,
              }}
            >
              <strong>
                Highest observed attention:
              </strong>{" "}
              {highestAttention.position}{" "}
              week(s) before the latest
              historical observation —{" "}
              {formatPercent(
                highestAttention.attention
              )}
            </div>
          )}

          <div
            style={{
              width: "100%",
              height: 340,
            }}
          >
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <BarChart
                data={chartData}
                margin={{
                  top: 10,
                  right: 15,
                  bottom: 25,
                  left: 5,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                />

                <XAxis
                  dataKey="label"
                  interval={5}
                  tick={{ fontSize: 11 }}
                />

                <YAxis
                  tickFormatter={(value) =>
                    `${value}%`
                  }
                />

                <Tooltip
                  labelFormatter={(value) =>
                    `${value} week(s) before latest observation`
                  }
                  formatter={(value) => [
                    formatPercent(value),
                    "Relative attention",
                  ]}
                />

                <Bar
                  dataKey="attention"
                  fill={COLORS.gold}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <p
            style={{
              fontSize: 12,
              color: COLORS.muted,
              lineHeight: 1.8,
              marginTop: 16,
            }}
          >
            The chart runs from older history
            on the left to more recent history
            on the right. Zero weeks before
            the latest observation represents
            the most recent encoder week.
            These attention values describe
            model behavior; they do not
            establish causal importance.
          </p>
        </>
      )}
    </Panel>
  );
}

export default function ResearchTFTExplainability() {
  const navigate = useNavigate();

  const [factoryStatus, setFactoryStatus] =
    useState(null);

  const [week, setWeek] = useState("");
  const [selectedGrades, setSelectedGrades] =
    useState(["BOP"]);

  const [records, setRecords] = useState([]);
  const [historySource, setHistorySource] =
    useState(null);

  const [explanation, setExplanation] =
    useState(null);

  const [initialLoading, setInitialLoading] =
    useState(true);

  const [weekLoading, setWeekLoading] =
    useState(false);

  const [explaining, setExplaining] =
    useState(false);

  const [error, setError] = useState("");
  const [explanationError, setExplanationError] =
    useState("");

  const weekRequestId = useRef(0);
  const explanationRequestId = useRef(0);
  const currentWeekRef = useRef("");

  const refreshFactoryStatus = useCallback(
    async () => {
      return getEightInputFactoryStatus();
    },
    []
  );

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        const result =
          await refreshFactoryStatus();

        if (!active) return;

        setFactoryStatus(result);

        setWeek(
          result.mongodb?.latest_saved_week ||
          result.source_dataset?.latest_week ||
          ""
        );
      } catch (caughtError) {
        if (active) {
          setError(
            caughtError.message ||
            "Unable to retrieve factory status."
          );
        }
      } finally {
        if (active) {
          setInitialLoading(false);
        }
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, [refreshFactoryStatus]);

  useEffect(() => {
    const currentRequest =
      ++weekRequestId.current;

    currentWeekRef.current = week;

    ++explanationRequestId.current;

    setExplanation(null);
    setExplanationError("");
    setRecords([]);
    setHistorySource(null);

    if (!week) {
      setWeekLoading(false);
      return;
    }

    if (!isValidCompletedWeek(week)) {
      setWeekLoading(false);
      setError(
        "Select a completed Monday-starting reporting week."
      );
      return;
    }

    let active = true;

    async function loadWeek() {
      setWeekLoading(true);
      setError("");

      try {
        const result =
          await getEightInputHistoricalWeek(
            week
          );

        if (
          !active ||
          currentRequest !==
            weekRequestId.current
        ) {
          return;
        }

        const loadedRecords =
          result.records || [];

        setRecords(loadedRecords);
        setHistorySource(result.source);

        const available =
          loadedRecords.map(
            (record) => record.tea_type
          );

        setSelectedGrades((current) => {
          const matching =
            current.filter((grade) =>
              available.includes(grade)
            );

          return matching.length
            ? matching
            : available.length
              ? [available[0]]
              : [];
        });
      } catch (caughtError) {
        if (
          active &&
          currentRequest ===
            weekRequestId.current
        ) {
          setError(
            caughtError.message ||
            "Unable to load the selected reporting week."
          );
        }
      } finally {
        if (
          active &&
          currentRequest ===
            weekRequestId.current
        ) {
          setWeekLoading(false);
        }
      }
    }

    loadWeek();

    return () => {
      active = false;
      weekRequestId.current += 1;
    };
  }, [week]);

  const availableGrades = useMemo(
    () =>
      EIGHT_INPUT_GRADES.filter(
        (grade) =>
          records.some(
            (record) =>
              record.tea_type === grade
          )
      ),
    [records]
  );

  const activeGrades = useMemo(
    () =>
      selectedGrades.filter(
        (grade) =>
          availableGrades.includes(grade)
      ),
    [selectedGrades, availableGrades]
  );

  function changeWeek(value) {
    setWeek(value);
    setExplanation(null);
    setExplanationError("");
    setError("");
  }

  function toggleGrade(grade) {
    if (
      weekLoading ||
      explaining ||
      !availableGrades.includes(grade)
    ) {
      return;
    }

    ++explanationRequestId.current;

    setSelectedGrades((current) =>
      current.includes(grade)
        ? current.filter(
            (item) => item !== grade
          )
        : EIGHT_INPUT_GRADES.filter(
            (item) =>
              item === grade ||
              current.includes(item)
          )
    );

    setExplanation(null);
    setExplanationError("");
  }

  function buildExplanationRecords() {
    return activeGrades.map((grade) => {
      const record = records.find(
        (item) =>
          item.tea_type === grade
      );

      if (!record) {
        throw new Error(
          `${grade}: Recorded data not found.`
        );
      }

      const values = {};

      for (const key of EIGHT_INPUT_FIELDS) {
        const value = record[key];

        if (
          value === null ||
          value === undefined ||
          value === "" ||
          !Number.isFinite(Number(value))
        ) {
          throw new Error(
            `${grade}: Invalid ${key}.`
          );
        }

        values[key] = Number(value);
      }

      return {
        tea_type: grade,
        ...values,
      };
    });
  }

  async function generateExplanation() {
    setExplanationError("");
    setError("");
    setExplanation(null);

    if (!isValidCompletedWeek(week)) {
      setExplanationError(
        "Choose a completed reporting week."
      );
      return;
    }

    if (!activeGrades.length) {
      setExplanationError(
        "Select at least one tea grade with recorded factory observations."
      );
      return;
    }

    let selectedRecords;

    try {
      selectedRecords =
        buildExplanationRecords();
    } catch (caughtError) {
      setExplanationError(
        caughtError.message
      );
      return;
    }

    const requestedWeek = week;
    const request =
      ++explanationRequestId.current;

    setExplaining(true);

    try {
      const result =
        await explainEightInputForecast(
          requestedWeek,
          selectedRecords
        );

      if (
        request !==
          explanationRequestId.current ||
        requestedWeek !==
          currentWeekRef.current
      ) {
        return;
      }

      if (
        result.model !== "eight_input_tft" ||
        result.explanation_source !==
          "frozen_checkpoint_raw_output"
      ) {
        throw new Error(
          "The explanation did not identify the expected eight-input TFT checkpoint output."
        );
      }

      if (
        result.forecast_origin !==
        requestedWeek
      ) {
        throw new Error(
          "The explanation reporting week does not match the selected inputs."
        );
      }

      const groups = [
        result.encoder_feature_importance,
        result.decoder_feature_importance,
        result.static_feature_importance,
        result.historical_attention,
      ];

      if (
        !groups.some(
          (group) =>
            Array.isArray(group) &&
            group.length > 0
        )
      ) {
        throw new Error(
          "No usable model interpretation results were returned."
        );
      }

      setExplanation(result);
    } catch (caughtError) {
      if (
        request ===
          explanationRequestId.current
      ) {
        setExplanationError(
          caughtError.message ||
          "Unable to extract model explanations."
        );
      }
    } finally {
      if (
        request ===
          explanationRequestId.current
      ) {
        setExplaining(false);
      }
    }
  }

  const sourceLabel =
    historySource === "protected_factory_csv"
      ? "Protected Historical Dataset"
      : historySource ===
          "mongodb_factory_observations"
        ? "MongoDB Factory Observations"
        : "Not Loaded";

  const controlsDisabled =
    initialLoading ||
    weekLoading ||
    explaining;

  const historicalFields =
    INPUT_FEATURES.length;

  return (
    <div
      className="demand-page"
      style={{
        minHeight: "100vh",
        background: COLORS.ivory,
        paddingBottom: 40,
      }}
    >
      <div className="demand-page-header-row">
        <div className="demand-page-header">
          <span className="demand-page-label">
            EIGHT-INPUT TFT INTERPRETABILITY
          </span>

          <h1>Model Explainability</h1>

          <p>
            Inspect model-derived variable-selection
            weights and historical attention from
            the frozen eight-input Temporal Fusion
            Transformer.
          </p>
        </div>
      </div>

      {error && (
        <div
          className="dashboard-warning-box"
          role="alert"
          style={{ marginBottom: 20 }}
        >
          <AlertTriangle size={21} />

          <div>
            <h3>
              Unable to load factory information
            </h3>
            <p>{error}</p>
          </div>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <StatCard
          icon={BrainCircuit}
          label="Selected Model"
          value="Eight-Input TFT"
        />

        <StatCard
          icon={Database}
          label="Historical Features"
          value={historicalFields}
        />

        <StatCard
          icon={Clock3}
          label="Encoder Window"
          value="52 Weeks"
        />

        <StatCard
          icon={CalendarDays}
          label="Forecast Horizon"
          value="4 Weeks"
        />
      </div>

      <Panel
        title="1. Select Reporting Week"
        icon={CalendarDays}
      >
        <p
          style={{
            color: COLORS.muted,
            lineHeight: 1.8,
          }}
        >
          Select a completed factory reporting
          week. The page will retrieve recorded
          observations before running any
          model interpretation.
        </p>

        <label
          htmlFor="explain-reporting-week"
          style={{
            display: "block",
            fontWeight: 600,
            color: COLORS.forest,
            marginBottom: 8,
          }}
        >
          Completed Reporting Week
        </label>

        <input
          id="explain-reporting-week"
          type="date"
          className="demand-input"
          value={week}
          min={
            factoryStatus?.source_dataset
              ?.first_week ||
            "2021-01-11"
          }
          max={latestCompletedMonday()}
          disabled={controlsDisabled}
          onChange={(event) =>
            changeWeek(event.target.value)
          }
          style={{
            maxWidth: 300,
          }}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 12,
            marginTop: 20,
          }}
        >
          <StatCard
            icon={CalendarDays}
            label="Selected Week"
            value={formatDate(week)}
          />

          <StatCard
            icon={Database}
            label="Historical Source"
            value={sourceLabel}
          />

          <StatCard
            icon={Leaf}
            label="Recorded Tea Grades"
            value={
              availableGrades.length
            }
          />
        </div>

        {weekLoading && (
          <p
            role="status"
            style={{
              marginTop: 16,
              color: COLORS.muted,
            }}
          >
            <RefreshCw
              size={16}
              style={{
                verticalAlign: "middle",
                marginRight: 8,
              }}
            />
            Loading recorded observations...
          </p>
        )}
      </Panel>

      <Panel
        title="2. Select Tea Grades"
        icon={Leaf}
      >
        <p
          style={{
            color: COLORS.muted,
            lineHeight: 1.8,
          }}
        >
          Select the tea grades to include
          in this explanation. The backend
          will aggregate variable-selection
          weights across the selected
          inference windows.
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          {EIGHT_INPUT_GRADES.map(
            (grade) => {
              const available =
                availableGrades.includes(
                  grade
                );

              const selected =
                activeGrades.includes(
                  grade
                );

              return (
                <label
                  key={grade}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    padding: "12px 17px",
                    border: `1px solid ${
                      selected
                        ? COLORS.forest
                        : COLORS.border
                    }`,
                    borderRadius: 12,
                    background: selected
                      ? COLORS.forest
                      : COLORS.white,
                    color: selected
                      ? COLORS.white
                      : COLORS.forest,
                    opacity: available
                      ? 1
                      : 0.5,
                    fontWeight: 600,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={
                      controlsDisabled ||
                      !available
                    }
                    onChange={() =>
                      toggleGrade(grade)
                    }
                  />

                  {grade}

                  {available && (
                    <CheckCircle2
                      size={15}
                      color={COLORS.gold}
                    />
                  )}
                </label>
              );
            }
          )}
        </div>
      </Panel>

      {records.length > 0 && (
        <Panel
          title="3. Recorded Model Inputs"
          icon={Database}
        >
          <p
            style={{
              color: COLORS.muted,
              lineHeight: 1.8,
            }}
          >
            These values come from the
            selected reporting week.
            The backend also loads
            the preceding historical
            weeks required for its
            52-week encoder.
          </p>

          {activeGrades.length ? (
            <div
              style={{
                overflowX: "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse:
                    "collapse",
                  textAlign: "left",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background:
                        COLORS.forest,
                      color:
                        COLORS.white,
                    }}
                  >
                    <th
                      style={{ padding: 12 }}
                    >
                      Input Feature
                    </th>

                    {activeGrades.map(
                      (grade) => (
                        <th
                          key={grade}
                          style={{
                            padding: 12,
                          }}
                        >
                          {grade}
                        </th>
                      )
                    )}
                  </tr>
                </thead>

                <tbody>
                  {INPUT_FEATURES.map(
                    (feature) => (
                      <tr
                        key={feature.key}
                        style={{
                          borderBottom:
                            `1px solid ${COLORS.border}`,
                        }}
                      >
                        <td
                          style={{
                            padding: 12,
                          }}
                        >
                          {formatFeature(
                            feature.key
                          )}
                        </td>

                        {activeGrades.map(
                          (grade) => {
                            const record =
                              records.find(
                                (item) =>
                                  item.tea_type ===
                                  grade
                              );

                            return (
                              <td
                                key={grade}
                                style={{
                                  padding: 12,
                                }}
                              >
                                {feature.key ===
                                "festival_flag"
                                  ? Number(
                                      record?.[feature.key]
                                    ) === 1
                                    ? "Yes"
                                    : "No"
                                  : formatNumber(
                                      record?.[feature.key]
                                    )}
                              </td>
                            );
                          }
                        )}
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyExplanation
              message={
                "Select at least one available " +
                "tea grade to review its inputs."
              }
            />
          )}
        </Panel>
      )}

      <Panel
        title="4. Generate Model Explanation"
        icon={BrainCircuit}
      >
        <p
          style={{
            color: COLORS.muted,
            lineHeight: 1.8,
          }}
        >
          The frozen TFT checkpoint
          will be used for raw inference
          and interpretation. This
          operation does not retrain
          the model or save changes to
          factory observations.
        </p>

        <button
          type="button"
          className="demand-save-btn"
          disabled={
            controlsDisabled ||
            activeGrades.length === 0 ||
            !isValidCompletedWeek(week)
          }
          onClick={generateExplanation}
        >
          {explaining ? (
            <RefreshCw size={18} />
          ) : (
            <BrainCircuit size={18} />
          )}

          {explaining
            ? "Extracting Explanation..."
            : "Generate TFT Explanation"}
        </button>

        {explanationError && (
          <div
            className="dashboard-warning-box"
            role="alert"
            style={{
              marginTop: 20,
            }}
          >
            <AlertTriangle size={21} />

            <div>
              <h3>
                Explanation Unavailable
              </h3>

              <p>
                {explanationError}
              </p>

              <p>
                No replacement scores
                have been generated.
                The backend interpretation
                output may require
                compatibility adjustments.
              </p>
            </div>
          </div>
        )}
      </Panel>

      {explanation && (
        <>
          <div
            className="demand-success-message"
            role="status"
            style={{
              marginBottom: 20,
            }}
          >
            <CheckCircle2 size={19} />

            Model-derived explanation
            data received for{" "}
            {explanation.selected_grades.join(
              ", "
            )}.
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(190px, 1fr))",
              gap: 14,
              marginBottom: 20,
            }}
          >
            <StatCard
              icon={CalendarDays}
              label="Explained Forecast Origin"
              value={formatDate(
                explanation.forecast_origin
              )}
            />

            <StatCard
              icon={Leaf}
              label="Selected Grades"
              value={
                explanation.selected_grades.length
              }
            />

            <StatCard
              icon={Clock3}
              label="Historical Window"
              value={
                `${explanation.encoder_history_weeks} Weeks`
              }
            />

            <StatCard
              icon={BrainCircuit}
              label="Interpretation Source"
              value="Frozen TFT Checkpoint"
            />
          </div>

          <ImportanceChart
            title="5. Historical Encoder Feature Importance"
            description={
              "Relative variable-selection weights " +
              "from the historical encoder. This " +
              "group may include both the eight " +
              "factory/market inputs and additional " +
              "trained model variables."
            }
            items={
              explanation.encoder_feature_importance
            }
            color={COLORS.green}
          />

          <ImportanceChart
            title="6. Future-Known Decoder Feature Importance"
            description={
              "Relative variable-selection weights " +
              "for features available to the decoder. " +
              "Historical-only factory demand and " +
              "auction prices are not supplied as " +
              "future-known observations."
            }
            items={
              explanation.decoder_feature_importance
            }
            color={COLORS.blue}
          />

          <ImportanceChart
            title="7. Static Feature Importance"
            description={
              "Learned variable-selection weights " +
              "for available static model information, " +
              "such as series-level characteristics."
            }
            items={
              explanation.static_feature_importance
            }
            color={COLORS.purple}
          />

          <AttentionChart
            items={
              explanation.historical_attention
            }
          />

          <Panel
            title="Explanation Scope and Limitations"
            icon={ShieldAlert}
          >
            <p
              style={{
                lineHeight: 1.8,
              }}
            >
              These explanation outputs were
              requested for the selected
              reporting week and tea grades.
              They are not necessarily
              representative of every
              historical forecasting window.
            </p>

            {Array.isArray(
              explanation.limitations
            ) &&
              explanation.limitations.length >
                0 && (
                <ul
                  style={{
                    paddingLeft: 22,
                    lineHeight: 1.9,
                  }}
                >
                  {explanation.limitations.map(
                    (item, index) => (
                      <li
                        key={`${index}-${item}`}
                      >
                        {item}
                      </li>
                    )
                  )}
                </ul>
              )}

            <p
              style={{
                color: COLORS.muted,
                fontSize: 13,
                lineHeight: 1.8,
              }}
            >
              Attribution weights
              describe the model's
              internal calculations.
              They do not establish
              causal relationships.
            </p>
          </Panel>
        </>
      )}

      <Panel
        title="Understanding the Eight Inputs"
        icon={Info}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(230px, 1fr))",
            gap: 14,
          }}
        >
          {INPUT_FEATURES.map(
            (feature) => (
              <article
                key={feature.key}
                style={{
                  padding: 16,
                  border:
                    `1px solid ${COLORS.border}`,
                  borderRadius: 12,
                  background: COLORS.ivory,
                }}
              >
                <span
                  style={{
                    color: COLORS.green,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {feature.category}
                </span>

                <h3
                  style={{
                    color: COLORS.forest,
                    fontSize: 16,
                  }}
                >
                  {formatFeature(
                    feature.key
                  )}
                </h3>

                <p
                  style={{
                    color: COLORS.muted,
                    fontSize: 13,
                    lineHeight: 1.7,
                  }}
                >
                  {feature.description}
                </p>
              </article>
            )
          )}
        </div>

        <p
          style={{
            marginTop: 18,
            fontSize: 13,
            color: COLORS.muted,
            lineHeight: 1.8,
          }}
        >
          High-, medium-, and low-elevation
          auction prices describe tea
          market elevation categories,
          not the five tea grade labels.
        </p>
      </Panel>

      <Panel
        title="Demand Prediction Interpretation"
        icon={TrendingUp}
      >
        <p style={{ lineHeight: 1.8 }}>
          For each future week, the TFT
          predicts three demand quantiles:
          P10, P50 and P90.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(205px, 1fr))",
            gap: 14,
            marginTop: 20,
          }}
        >
          {[
            {
              name:
                "Lower Demand Estimate",
              quantile: "P10",
            },
            {
              name:
                "Predicted Demand",
              quantile: "P50",
            },
            {
              name:
                "Upper Demand Estimate",
              quantile: "P90",
            },
          ].map((item) => (
            <div
              key={item.quantile}
              style={{
                padding: 18,
                background: COLORS.ivory,
                border:
                  `1px solid ${COLORS.border}`,
                borderRadius: 12,
              }}
            >
              <h3
                style={{
                  marginTop: 0,
                  color: COLORS.forest,
                  fontSize: 16,
                }}
              >
                {item.name}
              </h3>

              <strong
                style={{
                  color: COLORS.green,
                }}
              >
                {item.quantile}
              </strong>
            </div>
          ))}
        </div>

        <p
          style={{
            marginTop: 20,
            color: COLORS.muted,
            lineHeight: 1.8,
          }}
        >
          The P10–P90 interval is a nominal
          80% prediction interval. Its
          observed held-out coverage was
          approximately 67.46%, so the
          uncertainty estimates require
          further calibration.
        </p>

        <button
          type="button"
          className="demand-secondary-btn"
          onClick={() =>
            navigate(
              `${BASE_PATH}/forecast`
            )
          }
          style={{ marginTop: 12 }}
        >
          <TrendingUp size={17} />
          Open Demand Forecast
          <ArrowRight size={16} />
        </button>
      </Panel>

      <Panel
        title="Research Limitations"
        icon={ShieldAlert}
      >
        <p
          style={{
            lineHeight: 1.8,
          }}
        >
          The selected eight-input TFT
          achieved a held-out MAE of
          approximately <strong>705.41 kg</strong>,
          while the evaluated simple
          historical baseline achieved
          approximately <strong>559.80 kg</strong>.
          The TFT did not outperform
          that baseline on the reported
          test metric.
        </p>

        <p
          style={{
            lineHeight: 1.8,
          }}
        >
          Some historical input records
          remain provisional. Historical
          auction publication times have
          not been fully verified, so
          availability of all historical
          auction-price observations at
          their prediction origins is
          not established.
        </p>

        <p
          style={{
            lineHeight: 1.8,
          }}
        >
          Explainability is intended
          to improve transparency,
          not to imply that model
          forecasts are guaranteed
          or operationally validated.
        </p>
      </Panel>
    </div>
  );
}
