
/**
 * Six-Input Factory Observation Service
 *
 * Handles persistent weekly factory observations
 * through the FastAPI backend and MongoDB.
 *
 * Works independently of the existing
 * three-input research forecasting service.
 *
 * The backend is responsible for database
 * transactions, historical protection,
 * duplicate prevention, and persistence.
 */

import {
  validateSixInputWeeklyBatch,
  SIX_INPUT_TEA_GRADES,
} from "./sixInputForecastService";

const API_BASE_URL = (
  import.meta.env.VITE_DEMAND_API_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

const API_PREFIX = "/factory/six-input";

/**
 * Extract readable FastAPI error messages.
 */
function getErrorMessage(data, fallback) {
  if (typeof data?.detail === "string") {
    return data.detail;
  }

  if (Array.isArray(data?.detail)) {
    return data.detail
      .map((item) => item.msg || "Invalid input")
      .join("; ");
  }

  if (typeof data?.message === "string") {
    return data.message;
  }

  return fallback;
}

/**
 * Shared HTTP helper for the factory
 * observation endpoints.
 */
async function factoryRequest(
  endpoint,
  options = {}
) {
  let response;

  try {
    response = await fetch(
      `${API_BASE_URL}${API_PREFIX}${endpoint}`,
      {
        ...options,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...options.headers,
        },
        cache: "no-store",
      }
    );
  } catch {
    throw new Error(
      "Cannot connect to the factory observation " +
      "backend. Check that FastAPI is running."
    );
  }

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      `The backend returned an invalid response ` +
      `(HTTP ${response.status}).`
    );
  }

  if (!response.ok) {
    throw new Error(
      getErrorMessage(
        data,
        `Factory request failed ` +
          `(HTTP ${response.status}).`
      )
    );
  }

  return data;
}

/**
 * Get the protected CSV history bounds
 * and the latest MongoDB observation status.
 */
export async function getSixInputFactoryStatus() {
  const data = await factoryRequest("/status");

  if (
    data?.status !== "success" ||
    typeof data.csv_first_week !== "string" ||
    typeof data.csv_latest_week !== "string" ||
    !Number.isInteger(data.csv_records) ||
    !Number.isInteger(
      data.saved_observation_count
    )
  ) {
    throw new Error(
      "Invalid factory status response."
    );
  }

  return data;
}

/**
 * Read previously saved observations.
 *
 * grade can be omitted to request all grades.
 * limit must be between 1 and 500.
 */
export async function getSixInputObservations({
  grade = null,
  limit = 100,
} = {}) {
  if (
    grade !== null &&
    !SIX_INPUT_TEA_GRADES.includes(grade)
  ) {
    throw new Error(
      "Invalid tea grade."
    );
  }

  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 500
  ) {
    throw new Error(
      "Observation limit must be between 1 and 500."
    );
  }

  const params = new URLSearchParams({
    limit: String(limit),
  });

  if (grade !== null) {
    params.set("grade", grade);
  }

  const data = await factoryRequest(
    `/observations?${params.toString()}`
  );

  if (
    data?.status !== "success" ||
    !Array.isArray(data.records) ||
    data.count !== data.records.length
  ) {
    throw new Error(
      "Invalid stored observation response."
    );
  }

  return data;
}

/**
 * Validate a completed-week batch before
 * sending it to MongoDB through FastAPI.
 *
 * Does not silently alter submitted values.
 */
export function prepareSixInputObservationBatch(
  weeklyInput
) {
  const payload =
    validateSixInputWeeklyBatch(
      weeklyInput
    );

  const weekStart = new Date(
    `${payload.week_start_date}T12:00:00Z`
  );

  const weekEnd = new Date(
    weekStart.getTime()
  );

  weekEnd.setUTCDate(
    weekEnd.getUTCDate() + 6
  );

  const currentDate = new Date();

  const localToday = [
    currentDate.getFullYear(),
    String(
      currentDate.getMonth() + 1
    ).padStart(2, "0"),
    String(
      currentDate.getDate()
    ).padStart(2, "0"),
  ].join("-");

  const weekEndString = weekEnd
    .toISOString()
    .slice(0, 10);

  if (weekEndString >= localToday) {
    throw new Error(
      "The selected reporting week has not " +
      "finished. Only completed factory " +
      "observations may be saved."
    );
  }

  return payload;
}

/**
 * Save one to five tea-grade observations
 * in one request.
 *
 * The backend performs transaction handling
 * and prevents modification of CSV history.
 *
 * This request is intended only for genuine,
 * completed factory observations.
 */
export async function saveSixInputObservations(
  weeklyInput
) {
  const payload =
    prepareSixInputObservationBatch(
      weeklyInput
    );

  const data = await factoryRequest(
    "/observations",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );

  if (
    data?.status !== "success" ||
    data.saved !== true ||
    data.week_start_date !==
      payload.week_start_date ||
    !Array.isArray(data.selected_grades) ||
    data.saved_count !==
      payload.records.length
  ) {
    throw new Error(
      "The backend returned an unexpected " +
      "save confirmation. Check stored records " +
      "before attempting to save again."
    );
  }

  const submittedGrades = new Set(
    payload.records.map(
      (record) => record.tea_type
    )
  );

  const returnedGrades = new Set(
    data.selected_grades
  );

  if (
    returnedGrades.size !==
      submittedGrades.size ||
    [...submittedGrades].some(
      (grade) => !returnedGrades.has(grade)
    )
  ) {
    throw new Error(
      "Saved tea grades do not match the " +
      "submitted records. Verify stored data."
    );
  }

  return data;
}

/**
 * Request the latest recorded observations
 * for a particular grade.
 *
 * Returns the most recent item found within
 * the configured record limit.
 */
export async function getLatestSixInputObservation(
  grade
) {
  const data =
    await getSixInputObservations({
      grade,
      limit: 500,
    });

  if (data.records.length === 0) {
    return null;
  }

  return [...data.records].sort(
    (first, second) =>
      second.week_start_date.localeCompare(
        first.week_start_date
      )
  )[0];
}

/**
 * Check whether a specific grade/week
 * exists among stored MongoDB observations.
 *
 * This helper does not query the original
 * protected CSV dataset.
 */
export async function findStoredSixInputObservation(
  grade,
  weekStartDate
) {
  const data =
    await getSixInputObservations({
      grade,
      limit: 500,
    });

  return (
    data.records.find(
      (record) =>
        record.week_start_date ===
        weekStartDate
    ) || null
  );
}


/**
 * Retrieve the recorded factory observations for
 * a selected reporting week.
 *
 * Data sources:
 * - Protected factory CSV through 2026-10-05
 * - MongoDB for subsequently saved observations
 *
 * This is read-only and does not modify
 * any factory observations or TFT artifacts.
 */
export async function getSixInputHistoricalWeek(
  weekStartDate
) {
  if (
    typeof weekStartDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(weekStartDate)
  ) {
    throw new Error(
      "Select a valid reporting-week date."
    );
  }

  const date = new Date(
    `${weekStartDate}T12:00:00Z`
  );

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== weekStartDate ||
    date.getUTCDay() !== 1
  ) {
    throw new Error(
      "The reporting week must start on Monday."
    );
  }

  const data = await factoryRequest(
    `/history/${encodeURIComponent(weekStartDate)}`
  );

  if (
    data?.status !== "success" ||
    data.week_start_date !== weekStartDate ||
    !Array.isArray(data.records) ||
    !Array.isArray(data.selected_grades) ||
    !Array.isArray(data.missing_grades) ||
    data.record_count !== data.records.length
  ) {
    throw new Error(
      "Invalid factory historical observation response."
    );
  }

  const seenGrades = new Set();

  for (const record of data.records) {
    if (
      !SIX_INPUT_TEA_GRADES.includes(record.tea_type) ||
      seenGrades.has(record.tea_type)
    ) {
      throw new Error(
        "The historical response contains an invalid " +
        "or duplicate tea grade."
      );
    }

    seenGrades.add(record.tea_type);

    for (const field of [
      "demand_kg",
      "production_kg",
      "inventory_kg",
      "usd_lkr_rate",
      "festival_flag",
      "colombo_auction_price_lkr",
    ]) {
      if (
        record[field] === null ||
        record[field] === undefined ||
        !Number.isFinite(Number(record[field]))
      ) {
        throw new Error(
          `Invalid ${field} for ${record.tea_type}.`
        );
      }
    }
  }

  if (
    data.selected_grades.length !== seenGrades.size ||
    data.selected_grades.some(
      (grade) => !seenGrades.has(grade)
    )
  ) {
    throw new Error(
      "Historical grade information is inconsistent."
    );
  }

  return data;
}
