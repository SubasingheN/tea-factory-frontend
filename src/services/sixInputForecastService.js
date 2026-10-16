
/**
 * Six-Input TFT Forecast Service
 *
 * Connects React to the frozen six-input TFT model.
 *
 * Backend:
 * POST /forecast/six-input/selected
 *
 * Historical input features:
 * 1. demand_kg
 * 2. production_kg
 * 3. inventory_kg
 * 4. usd_lkr_rate
 * 5. festival_flag
 * 6. colombo_auction_price_lkr
 *
 * Supports one to five selected tea grades.
 * Generates four-week P10/P50/P90 forecasts.
 *
 * Does not modify the existing no-price TFT service.
 */

const API_BASE_URL = (
  import.meta.env.VITE_DEMAND_API_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

export const SIX_INPUT_TEA_GRADES = [
  "BOP",
  "BOPF",
  "Dust",
  "OP",
  "Pekoe",
];

export const SIX_INPUT_FORECAST_WEEKS = 4;

export const SIX_INPUT_FIELDS = [
  {
    key: "demand_kg",
    label: "Observed Tea Demand",
    unit: "kg",
    min: 0.01,
    step: "0.01",
    description:
      "Actual demand recorded for the selected completed week.",
  },
  {
    key: "production_kg",
    label: "Tea Production",
    unit: "kg",
    min: 0,
    step: "0.01",
    description:
      "Actual tea production recorded during the week.",
  },
  {
    key: "inventory_kg",
    label: "Available Inventory",
    unit: "kg",
    min: 0,
    step: "0.01",
    description:
      "Recorded tea inventory for the selected week.",
  },
  {
    key: "usd_lkr_rate",
    label: "USD / LKR Exchange Rate",
    unit: "LKR per USD",
    min: 0.01,
    step: "0.01",
    description:
      "Recorded USD to LKR exchange rate for the week.",
  },
  {
    key: "festival_flag",
    label: "Festival Week",
    unit: "0 = No, 1 = Yes",
    min: 0,
    max: 1,
    step: 1,
    description:
      "Indicates whether the week was classified as a festival week.",
  },
  {
    key: "colombo_auction_price_lkr",
    label: "Colombo Auction Price",
    unit: "LKR per kg",
    min: 0.01,
    step: "0.01",
    description:
      "Recorded Colombo tea auction price for the selected grade.",
  },
];

export const SIX_INPUT_EMPTY_RECORD = {
  demand_kg: "",
  production_kg: "",
  inventory_kg: "",
  usd_lkr_rate: "",
  festival_flag: "",
  colombo_auction_price_lkr: "",
};

function getApiErrorMessage(data, fallback) {
  if (typeof data?.detail === "string") {
    return data.detail;
  }

  if (Array.isArray(data?.detail)) {
    return data.detail
      .map((error) => error.msg || "Invalid input")
      .join("; ");
  }

  if (typeof data?.message === "string") {
    return data.message;
  }

  return fallback;
}

function parseDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return null;
  }

  const date = new Date(`${value}T12:00:00Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return null;
  }

  return date;
}

function addWeeks(isoDate, weeks) {
  const date = parseDate(isoDate);

  if (!date) {
    throw new Error("Invalid forecast calendar date.");
  }

  date.setUTCDate(date.getUTCDate() + weeks * 7);

  return date.toISOString().slice(0, 10);
}

function validateNumericField(record, field, grade) {
  const rawValue = record[field.key];

  if (
    rawValue === "" ||
    rawValue === null ||
    rawValue === undefined ||
    typeof rawValue === "boolean"
  ) {
    throw new Error(
      `Enter ${field.label} for ${grade}.`
    );
  }

  const number = Number(rawValue);

  if (!Number.isFinite(number)) {
    throw new Error(
      `Invalid ${field.label} for ${grade}.`
    );
  }

  if (number < field.min) {
    throw new Error(
      `${field.label} for ${grade} must be at least ${field.min}.`
    );
  }

  if (
    field.max !== undefined &&
    number > field.max
  ) {
    throw new Error(
      `${field.label} for ${grade} must not exceed ${field.max}.`
    );
  }

  if (
    field.key === "festival_flag" &&
    ![0, 1].includes(number)
  ) {
    throw new Error(
      `Festival Week for ${grade} must be 0 or 1.`
    );
  }

  return number;
}

/**
 * Validate and normalize a weekly input batch.
 *
 * Current backend behavior:
 * Values must match an existing completed factory
 * observation. New week storage is not yet supported.
 */
export function validateSixInputWeeklyBatch(input) {
  if (!input || typeof input !== "object") {
    throw new Error(
      "Six-input weekly data is required."
    );
  }

  const weekStart = parseDate(
    input.week_start_date
  );

  if (!weekStart) {
    throw new Error(
      "Select a valid weekly start date."
    );
  }

  if (weekStart.getUTCDay() !== 1) {
    throw new Error(
      "The selected week must start on a Monday."
    );
  }

  if (
    !Array.isArray(input.records) ||
    input.records.length < 1 ||
    input.records.length > 5
  ) {
    throw new Error(
      "Select between one and five tea grades."
    );
  }

  const uniqueGrades = new Set();

  const records = input.records.map((record) => {
    const grade = record?.tea_type;

    if (!SIX_INPUT_TEA_GRADES.includes(grade)) {
      throw new Error(
        "An invalid tea grade was selected."
      );
    }

    if (uniqueGrades.has(grade)) {
      throw new Error(
        `Duplicate tea grade: ${grade}.`
      );
    }

    uniqueGrades.add(grade);

    const normalized = {
      tea_type: grade,
    };

    for (const field of SIX_INPUT_FIELDS) {
      normalized[field.key] =
        validateNumericField(
          record,
          field,
          grade
        );
    }

    return normalized;
  });

  // The FastAPI schema requires the shared weekly
  // exchange rate and festival flag to be consistent
  // across all selected grades.
  const sharedRate = records[0].usd_lkr_rate;
  const sharedFestival = records[0].festival_flag;

  for (const record of records) {
    if (
      Math.abs(
        record.usd_lkr_rate - sharedRate
      ) > 0.001
    ) {
      throw new Error(
        "All selected grades must use the same weekly USD/LKR exchange rate."
      );
    }

    if (
      record.festival_flag !== sharedFestival
    ) {
      throw new Error(
        "All selected grades must use the same festival flag."
      );
    }
  }

  return {
    week_start_date: input.week_start_date,
    records,
  };
}

/**
 * Validate returned four-week demand forecasts.
 */
export function validateSixInputForecastResponse(
  data
) {
  if (
    data?.status !== "success" ||
    data.model !== "six_input_tft" ||
    ![
      "historical_replay",
      "latest_completed_week_forecast",
    ].includes(data.forecast_type) ||
    !Array.isArray(data.selected_grades) ||
    !data.forecasts ||
    typeof data.forecasts !== "object"
  ) {
    throw new Error(
      "Unexpected six-input TFT response."
    );
  }

  const grades = data.selected_grades;

  if (
    grades.length < 1 ||
    grades.length > 5 ||
    new Set(grades).size !== grades.length ||
    grades.some(
      (grade) =>
        !SIX_INPUT_TEA_GRADES.includes(grade)
    ) ||
    Object.keys(data.forecasts).length !==
      grades.length ||
    data.forecast_count !==
      grades.length * SIX_INPUT_FORECAST_WEEKS
  ) {
    throw new Error(
      "Invalid forecast grade selection."
    );
  }

  if (
    !parseDate(data.forecast_origin) ||
    !parseDate(data.forecast_start_date) ||
    !parseDate(data.forecast_end_date) ||
    data.forecast_start_date !==
      addWeeks(data.forecast_origin, 1) ||
    data.forecast_end_date !==
      addWeeks(
        data.forecast_origin,
        SIX_INPUT_FORECAST_WEEKS
      )
  ) {
    throw new Error(
      "Invalid forecast date range."
    );
  }

  if (
    data.forecast_horizon_weeks !==
    SIX_INPUT_FORECAST_WEEKS
  ) {
    throw new Error(
      "Unexpected forecasting horizon."
    );
  }

  for (const grade of grades) {
    const weeks = data.forecasts[grade];

    if (
      !Array.isArray(weeks) ||
      weeks.length !==
        SIX_INPUT_FORECAST_WEEKS
    ) {
      throw new Error(
        `Expected four forecast weeks for ${grade}.`
      );
    }

    weeks.forEach((week, index) => {
      const lower = Number(
        week.lower_demand_kg
      );

      const median = Number(
        week.median_demand_kg
      );

      const upper = Number(
        week.upper_demand_kg
      );

      const expectedWeek = addWeeks(
        data.forecast_origin,
        index + 1
      );

      if (
        week.horizon !== index + 1 ||
        week.week !== expectedWeek ||
        !Number.isFinite(lower) ||
        !Number.isFinite(median) ||
        !Number.isFinite(upper) ||
        lower < 0 ||
        lower > median ||
        median > upper
      ) {
        throw new Error(
          `Invalid forecast for ${grade}, week ${index + 1}.`
        );
      }
    });
  }

  return data;
}

/**
 * Generate a forecast using existing completed
 * factory observations and the frozen six-input TFT.
 *
 * This request does not save weekly observations
 * or forecast runs.
 */
export async function generateSixInputTFTForecast(
  weeklyInput
) {
  const payload = validateSixInputWeeklyBatch(
    weeklyInput
  );

  let response;

  try {
    response = await fetch(
      `${API_BASE_URL}/forecast/six-input/selected`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      }
    );
  } catch {
    throw new Error(
      "Cannot connect to the six-input TFT backend. " +
      "Check that FastAPI is running on port 8000."
    );
  }

  if (!response.ok) {
    let errorData = null;

    try {
      errorData = await response.json();
    } catch {
      // Preserve the default HTTP error.
    }

    throw new Error(
      getApiErrorMessage(
        errorData,
        `Six-input forecast failed (HTTP ${response.status}).`
      )
    );
  }

  const data = await response.json();

  return validateSixInputForecastResponse(
    data
  );
}

/**
 * Format a model date for display.
 */
export function formatSixInputDate(isoDate) {
  const date = parseDate(isoDate);

  if (!date) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/**
 * Format forecast demand in kilograms.
 */
export function formatSixInputDemand(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "N/A";
  }

  return number.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
