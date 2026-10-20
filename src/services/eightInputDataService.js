
/**
 * Tea Demand Forecasting Data Service
 *
 * Supports the production nine-input TFT model.
 *
 * The existing eightInputDataService filename and
 * exported function names are retained for
 * compatibility with current React components.
 *
 * Responsibilities:
 * - Factory observation status
 * - Historical and saved weekly observations
 * - Atomic weekly data submission
 * - Automatic four-week demand forecasting
 * - Forecast retry compatibility
 * - Finalized forecast history
 * - Consecutive-week forecast comparisons
 *
 * Historical backfills and operational forecasts
 * retain their separate model/provenance metadata.
 */

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000"
).replace(/\/+$/, "");

export const EIGHT_INPUT_GRADES = [
  "BOP",
  "BOPF",
  "Dust",
  "OP",
  "Pekoe",
];

export const EIGHT_INPUT_FIELDS = [
  "demand_kg",
  "production_kg",
  "inventory_kg",
  "usd_lkr_monday_rate",
  "usd_lkr_sunday_rate",
  "festival_flag",
  "auction_price_high_lkr",
  "auction_price_medium_lkr",
  "auction_price_low_lkr",
];

export const NINE_INPUT_FIELDS = [
  ...EIGHT_INPUT_FIELDS,
];

export const SHARED_WEEKLY_FIELDS = [
  "usd_lkr_monday_rate",
  "usd_lkr_sunday_rate",
  "festival_flag",
  "auction_price_high_lkr",
  "auction_price_medium_lkr",
  "auction_price_low_lkr",
];

export const PRODUCTION_MODEL = "nine_input_tft";

export const PRODUCTION_MODEL_VERSION =
  "production_v1";

const FIELD_LABELS = {
  demand_kg: "Demand",
  production_kg: "Production",
  inventory_kg: "Inventory",
  usd_lkr_monday_rate: "USD/LKR Monday Rate",
  usd_lkr_sunday_rate: "USD/LKR Sunday Rate",
  festival_flag: "Festival Week",
  auction_price_high_lkr:
    "High-Elevation Auction Price",
  auction_price_medium_lkr:
    "Medium-Elevation Auction Price",
  auction_price_low_lkr:
    "Low-Elevation Auction Price",
};

const MAX_VALUES = {
  demand_kg: 100000,
  production_kg: 100000,
  inventory_kg: 100000,
  usd_lkr_monday_rate: 10000,
  usd_lkr_sunday_rate: 10000,
  auction_price_high_lkr: 100000,
  auction_price_medium_lkr: 100000,
  auction_price_low_lkr: 100000,
};

const POSITIVE_FIELDS = new Set([
  "demand_kg",
  "usd_lkr_monday_rate",
  "usd_lkr_sunday_rate",
  "auction_price_high_lkr",
  "auction_price_medium_lkr",
  "auction_price_low_lkr",
]);

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function normalizedApiError(detail, status) {
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail.map((item) => {
      if (typeof item === "string") {
        return item;
      }

      if (isPlainObject(item)) {
        const location = Array.isArray(item.loc)
          ? item.loc
              .filter((part) => part !== "body")
              .join(".")
          : "";

        return [
          location,
          item.msg || "Invalid input value",
        ]
          .filter(Boolean)
          .join(": ");
      }

      return "Invalid input value";
    });

    return messages.join("; ");
  }

  if (isPlainObject(detail)) {
    return (
      detail.message ||
      detail.error ||
      JSON.stringify(detail)
    );
  }

  return `Request failed (${status}).`;
}

/**
 * Centralized FastAPI communication.
 *
 * The request method and body are passed through
 * without changing the existing backend contract.
 */
async function apiRequest(path, options = {}) {
  let response;

  try {
    response = await fetch(
      `${API_BASE}${path}`,
      {
        ...options,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
      }
    );
  } catch (error) {
    throw new Error(
      "Cannot connect to the factory backend. " +
      "Check that FastAPI is running and accessible."
    );
  }

  const result = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      normalizedApiError(
        result?.detail ?? result?.message,
        response.status
      )
    );

    error.status = response.status;
    error.response = result;

    throw error;
  }

  return result;
}

function validateWeekStartDate(weekStartDate) {
  if (
    typeof weekStartDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(weekStartDate)
  ) {
    throw new Error(
      "The reporting week must use YYYY-MM-DD."
    );
  }

  const parsed = new Date(
    `${weekStartDate}T12:00:00Z`
  );

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !==
      weekStartDate
  ) {
    throw new Error(
      "A valid reporting-week date is required."
    );
  }

  if (parsed.getUTCDay() !== 1) {
    throw new Error(
      "The reporting week must start on Monday."
    );
  }

  return weekStartDate;
}

function normalizeInputNumber(value, field) {
  const label = FIELD_LABELS[field] || field;

  if (
    value === "" ||
    value === null ||
    value === undefined ||
    typeof value === "boolean"
  ) {
    throw new Error(
      `${label} is required.`
    );
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(
      `${label} must be a valid number.`
    );
  }

  if (field === "festival_flag") {
    if (number !== 0 && number !== 1) {
      throw new Error(
        "Festival Week must be Yes or No."
      );
    }

    return number;
  }

  if (POSITIVE_FIELDS.has(field)) {
    if (number <= 0) {
      throw new Error(
        `${label} must be greater than zero.`
      );
    }
  } else if (number < 0) {
    throw new Error(
      `${label} cannot be negative.`
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      MAX_VALUES,
      field
    ) &&
    number > MAX_VALUES[field]
  ) {
    throw new Error(
      `${label} exceeds the allowed maximum.`
    );
  }

  return number;
}

function validateRecord(record) {
  if (!isPlainObject(record)) {
    throw new Error(
      "Each tea-grade observation must be an object."
    );
  }

  if (!EIGHT_INPUT_GRADES.includes(record.tea_type)) {
    throw new Error(
      "Unsupported tea grade."
    );
  }

  const normalized = {
    tea_type: record.tea_type,
  };

  for (const field of EIGHT_INPUT_FIELDS) {
    try {
      normalized[field] = normalizeInputNumber(
        record[field],
        field
      );
    } catch (error) {
      throw new Error(
        `${record.tea_type}: ${error.message}`
      );
    }
  }

  // Only the nine model inputs are sent.
  // usd_lkr_exchange_rate_range is derived
  // by the backend from Monday/Sunday rates.
  return normalized;
}

function sharedValuesMatch(left, right, field) {
  if (field === "festival_flag") {
    return left === right;
  }

  return Math.abs(left - right) <= 0.001;
}

function validateCompleteWeeklyRecords(records) {
  if (
    !Array.isArray(records) ||
    records.length !== EIGHT_INPUT_GRADES.length
  ) {
    throw new Error(
      "Weekly data must include all five tea grades."
    );
  }

  const normalized = records.map(validateRecord);

  const byGrade = new Map();

  for (const record of normalized) {
    if (byGrade.has(record.tea_type)) {
      throw new Error(
        `Duplicate tea grade: ${record.tea_type}.`
      );
    }

    byGrade.set(record.tea_type, record);
  }

  for (const grade of EIGHT_INPUT_GRADES) {
    if (!byGrade.has(grade)) {
      throw new Error(
        `Missing tea-grade observation: ${grade}.`
      );
    }
  }

  const ordered = EIGHT_INPUT_GRADES.map(
    (grade) => byGrade.get(grade)
  );

  const reference = ordered[0];

  for (const record of ordered.slice(1)) {
    for (const field of SHARED_WEEKLY_FIELDS) {
      if (
        !sharedValuesMatch(
          reference[field],
          record[field],
          field
        )
      ) {
        throw new Error(
          `${FIELD_LABELS[field]} must be ` +
          "identical across all five tea grades."
        );
      }
    }
  }

  return ordered;
}

function validateSelectedRecords(records) {
  if (
    !Array.isArray(records) ||
    records.length === 0
  ) {
    throw new Error(
      "At least one tea-grade observation is required."
    );
  }

  const normalized = records.map(validateRecord);
  const submitted = new Set();

  for (const record of normalized) {
    if (submitted.has(record.tea_type)) {
      throw new Error(
        `Duplicate tea grade: ${record.tea_type}.`
      );
    }

    submitted.add(record.tea_type);
  }

  return normalized;
}

/**
 * Retrieve factory dataset and MongoDB status.
 *
 * Includes the backend's latest-completed-week
 * entry restriction and input-field metadata.
 */
export async function getEightInputFactoryStatus() {
  return apiRequest(
    "/factory/eight-input/status"
  );
}

/**
 * Retrieve a historical or factory-entered
 * reporting week.
 *
 * This is read-only and does not permit
 * historical Weekly Data Entry.
 */
export async function getEightInputHistoricalWeek(
  weekStartDate
) {
  validateWeekStartDate(weekStartDate);

  return apiRequest(
    `/factory/eight-input/history/${encodeURIComponent(
      weekStartDate
    )}`
  );
}

/**
 * Retrieve observations saved to MongoDB.
 */
export async function getEightInputObservations(
  grade = null,
  limit = 100
) {
  const params = new URLSearchParams({
    limit: String(limit),
  });

  if (grade) {
    if (!EIGHT_INPUT_GRADES.includes(grade)) {
      throw new Error(
        "Unsupported tea grade."
      );
    }

    params.set("grade", grade);
  }

  return apiRequest(
    `/factory/eight-input/observations?${params.toString()}`
  );
}

/**
 * Save one observation through the existing
 * compatibility endpoint.
 *
 * The complete five-grade batch endpoint should
 * be used for normal factory weekly submissions.
 */
export async function saveEightInputObservation(
  weekStartDate,
  record
) {
  validateWeekStartDate(weekStartDate);

  const normalized = validateRecord(record);

  return apiRequest(
    "/factory/eight-input/observations",
    {
      method: "POST",
      body: JSON.stringify({
        week_start_date: weekStartDate,
        records: [normalized],
      }),
    }
  );
}

/**
 * Generate a forecast preview.
 *
 * The backend is responsible for verifying
 * input history and production model artifacts.
 *
 * This function does not save predictions.
 */
export async function generateEightInputForecast(
  weekStartDate,
  records
) {
  validateWeekStartDate(weekStartDate);

  const normalized = validateSelectedRecords(
    records
  );

  return apiRequest(
    "/research/eight-input/forecast",
    {
      method: "POST",
      body: JSON.stringify({
        week_start_date: weekStartDate,
        records: normalized,
      }),
    }
  );
}

/**
 * Finalize a forecast using already saved
 * factory observations.
 *
 * Existing finalized forecasts are preserved
 * by the backend.
 */
export async function finalizeEightInputForecast(
  weekStartDate,
  records
) {
  validateWeekStartDate(weekStartDate);

  const normalized =
    validateCompleteWeeklyRecords(records);

  return apiRequest(
    "/research/eight-input/finalize",
    {
      method: "POST",
      body: JSON.stringify({
        week_start_date: weekStartDate,
        records: normalized,
      }),
    }
  );
}

/**
 * Retrieve finalized forecasts from MongoDB.
 *
 * Returns both historical backfilled forecasts
 * and operational forecasts, with original
 * model identity retained for every document.
 */
export async function getEightInputForecastHistory(
  grade = null,
  limit = 100
) {
  const params = new URLSearchParams({
    limit: String(limit),
  });

  if (grade) {
    if (!EIGHT_INPUT_GRADES.includes(grade)) {
      throw new Error(
        "Unsupported tea grade."
      );
    }

    params.set("grade", grade);
  }

  return apiRequest(
    `/research/eight-input/history?${params.toString()}`
  );
}

/**
 * Retrieve the finalized forecast from
 * exactly one week before beforeOrigin.
 */
export async function getPreviousEightInputForecast(
  grade,
  beforeOrigin
) {
  if (!EIGHT_INPUT_GRADES.includes(grade)) {
    throw new Error(
      "Unsupported tea grade."
    );
  }

  validateWeekStartDate(beforeOrigin);

  const params = new URLSearchParams({
    before_origin: beforeOrigin,
  });

  return apiRequest(
    `/research/eight-input/history/previous/${encodeURIComponent(
      grade
    )}?${params.toString()}`
  );
}

function dateDifferenceDays(start, end) {
  const first = Date.parse(
    `${start}T12:00:00Z`
  );

  const second = Date.parse(
    `${end}T12:00:00Z`
  );

  if (
    !Number.isFinite(first) ||
    !Number.isFinite(second)
  ) {
    return null;
  }

  return Math.round(
    (second - first) / 86400000
  );
}

/**
 * Compare matching P50 forecast target weeks.
 *
 * Prevents inappropriate comparisons between:
 * - Different tea grades
 * - Nonconsecutive forecast origins
 * - Different forecasting model versions
 * - Historical backfills and operational forecasts
 *
 * Legacy forecasts without matching model metadata
 * are not compared with production forecasts.
 */
export function compareEightInputForecasts(
  previous,
  current
) {
  if (!previous || !current) {
    return [];
  }

  if (
    previous.finalized !== true ||
    current.finalized !== true
  ) {
    return [];
  }

  if (
    previous.tea_type !== current.tea_type ||
    previous.model !== current.model ||
    previous.model_version !== current.model_version
  ) {
    return [];
  }

  if (
    previous.historical_backfill !==
    current.historical_backfill
  ) {
    return [];
  }

  if (
    dateDifferenceDays(
      previous.forecast_origin,
      current.forecast_origin
    ) !== 7
  ) {
    return [];
  }

  if (
    !Array.isArray(previous.forecasts) ||
    !Array.isArray(current.forecasts)
  ) {
    return [];
  }

  const previousWeeks = new Map(
    previous.forecasts.map((item) => [
      item.week,
      item,
    ])
  );

  const comparisons = [];

  for (const currentWeek of current.forecasts) {
    const previousWeek = previousWeeks.get(
      currentWeek.week
    );

    if (!previousWeek) {
      continue;
    }

    const previousDemand = Number(
      previousWeek.median_demand_kg
    );

    const currentDemand = Number(
      currentWeek.median_demand_kg
    );

    if (
      !Number.isFinite(previousDemand) ||
      !Number.isFinite(currentDemand)
    ) {
      continue;
    }

    const difference =
      currentDemand - previousDemand;

    comparisons.push({
      tea_type: current.tea_type,
      target_week: currentWeek.week,
      previous_forecast_origin:
        previous.forecast_origin,
      current_forecast_origin:
        current.forecast_origin,
      previous_demand_kg: previousDemand,
      current_demand_kg: currentDemand,
      difference_kg: difference,
      change_percent:
        previousDemand !== 0
          ? (difference / previousDemand) * 100
          : null,
    });
  }

  return comparisons;
}

/**
 * Preserve the existing explanation-service export
 * for compatibility with components importing it.
 *
 * This is not used by the factory-facing Weekly
 * Data Entry page. Runtime compatibility with
 * the production model is not yet verified.
 */
export async function explainEightInputForecast(
  weekStartDate,
  records
) {
  validateWeekStartDate(weekStartDate);

  const normalized = validateSelectedRecords(
    records
  );

  return apiRequest(
    "/research/eight-input/explain",
    {
      method: "POST",
      body: JSON.stringify({
        week_start_date: weekStartDate,
        records: normalized,
      }),
    }
  );
}

/**
 * Save all five tea grades atomically.
 *
 * The backend saves observations before
 * attempting automatic four-week forecasting.
 *
 * Successful observation saving and forecast
 * finalization are separate outcomes.
 */
export async function saveEightInputWeeklyBatch(
  weekStartDate,
  records
) {
  validateWeekStartDate(weekStartDate);

  const normalized =
    validateCompleteWeeklyRecords(records);

  return apiRequest(
    "/factory/eight-input/observations/batch",
    {
      method: "POST",
      body: JSON.stringify({
        week_start_date: weekStartDate,
        records: normalized,
      }),
    }
  );
}
