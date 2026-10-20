
/**
 * Factory Generate Forecasts Service
 *
 * Generates four-week demand forecasts using the
 * latest completed week's submitted observations.
 *
 * Backend responsibilities:
 * - Validate all five tea grades.
 * - Generate predictions using submitted inputs.
 * - Atomically save observations and forecasts.
 * - Preserve original forecasts and revisions.
 *
 * This service does not modify the historical
 * dataset or retrain the forecasting model.
 */

import {
  EIGHT_INPUT_GRADES,
  EIGHT_INPUT_FIELDS,
  SHARED_WEEKLY_FIELDS,
} from "./eightInputDataService";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000"
).replace(/\/+$/, "");

const GENERATE_ENDPOINT =
  "/factory/eight-input/observations/forecast/generate";

function validateWeek(weekStartDate) {
  if (
    typeof weekStartDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(weekStartDate)
  ) {
    throw new Error(
      "A valid reporting week is required."
    );
  }

  const date = new Date(
    `${weekStartDate}T12:00:00Z`
  );

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !==
      weekStartDate ||
    date.getUTCDay() !== 1
  ) {
    throw new Error(
      "The reporting week must be a valid Monday."
    );
  }
}

function validateRecords(records) {
  if (
    !Array.isArray(records) ||
    records.length !== EIGHT_INPUT_GRADES.length
  ) {
    throw new Error(
      "Observations for all five tea grades are required."
    );
  }

  const byGrade = new Map();

  for (const record of records) {
    if (
      !record ||
      typeof record !== "object" ||
      !EIGHT_INPUT_GRADES.includes(record.tea_type)
    ) {
      throw new Error(
        "Invalid tea-grade observation."
      );
    }

    if (byGrade.has(record.tea_type)) {
      throw new Error(
        `Duplicate observation for ${record.tea_type}.`
      );
    }

    const normalized = {
      tea_type: record.tea_type,
    };

    for (const field of EIGHT_INPUT_FIELDS) {
      const value = record[field];

      if (
        value === "" ||
        value === null ||
        value === undefined ||
        typeof value === "boolean"
      ) {
        throw new Error(
          `${record.tea_type}: ${field} is required.`
        );
      }

      const number = Number(value);

      if (!Number.isFinite(number)) {
        throw new Error(
          `${record.tea_type}: ${field} must be numeric.`
        );
      }

      if (field === "festival_flag") {
        if (number !== 0 && number !== 1) {
          throw new Error(
            "Festival Week must be Yes or No."
          );
        }
      } else if (number < 0) {
        throw new Error(
          `${record.tea_type}: ${field} cannot be negative.`
        );
      }

      normalized[field] = number;
    }

    byGrade.set(record.tea_type, normalized);
  }

  const ordered = EIGHT_INPUT_GRADES.map(
    (grade) => {
      const record = byGrade.get(grade);

      if (!record) {
        throw new Error(
          `Missing observation for ${grade}.`
        );
      }

      return record;
    }
  );

  const first = ordered[0];

  for (const record of ordered.slice(1)) {
    for (const field of SHARED_WEEKLY_FIELDS) {
      const matches =
        field === "festival_flag"
          ? record[field] === first[field]
          : Math.abs(
              record[field] - first[field]
            ) <= 0.001;

      if (!matches) {
        throw new Error(
          `${field} must be the same for all five tea grades.`
        );
      }
    }
  }

  return ordered;
}

function extractErrorMessage(result, status) {
  const detail = result?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => item.msg || String(item))
      .join("; ");
  }

  return (
    result?.message ||
    `Forecast generation failed (${status}).`
  );
}

/**
 * Save observations and generate forecasts.
 *
 * This is a write operation.
 *
 * It must only be called after the operator
 * explicitly clicks Generate Forecasts.
 */
export async function generateAndSaveEightInputForecasts(
  weekStartDate,
  records
) {
  validateWeek(weekStartDate);

  const normalized = validateRecords(records);

  let response;

  try {
    response = await fetch(
      `${API_BASE}${GENERATE_ENDPOINT}`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          week_start_date: weekStartDate,
          records: normalized,
        }),
      }
    );
  } catch {
    throw new Error(
      "Unable to connect to the factory backend. " +
      "Check the backend connection before retrying."
    );
  }

  const result = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      extractErrorMessage(
        result,
        response.status
      )
    );

    error.status = response.status;

    throw error;
  }

  if (
    result.status !== "success" ||
    result.weekly_data?.saved !== true ||
    result.forecast?.finalized !== true ||
    result.forecast?.forecast_generated !== true ||
    result.forecast?.forecast_origin !==
      weekStartDate ||
    !Number.isInteger(result.revision) ||
    result.revision < 0
  ) {
    throw new Error(
      "Forecast saving could not be confirmed. " +
      "Check Forecast History before retrying."
    );
  }

  return result;
}
